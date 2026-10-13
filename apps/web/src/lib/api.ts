export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";

export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "validation"
  | "rateLimit"
  | "network"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly details: unknown;

  constructor(kind: ApiErrorKind, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.details = details;
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rateLimit";
  if (status >= 500) return "server";
  return "unknown";
}

let unauthorizedHandler: (() => void) | null = null;

/** Lets the session layer clear state when the API rejects the token. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("network", 0, "network", cause);
  }

  const text = await response.text();
  const payload = text.length > 0 ? safeParse(text) : null;

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    const message =
      extractMessage(payload) ?? `Request failed with status ${response.status}`;
    if (kind === "unauthorized") unauthorizedHandler?.();
    throw new ApiError(kind, response.status, message, payload);
  }

  return payload as T;
}

export type UploadOptions = {
  token?: string | null;
  signal?: AbortSignal;
  fields?: Record<string, string>;
};

/**
 * Posts a `multipart/form-data` body. `Content-Type` is left to the browser so
 * the boundary is generated correctly; errors map exactly like `apiRequest`.
 */
export async function apiUpload<T>(
  path: string,
  file: Blob,
  filename: string,
  options: UploadOptions = {},
): Promise<T> {
  const form = new FormData();
  form.append("file", file, filename);
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    if (value) form.append(key, value);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      signal: options.signal,
      body: form,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("network", 0, "network", cause);
  }

  const text = await response.text();
  const payload = text.length > 0 ? safeParse(text) : null;

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    const message =
      extractMessage(payload) ?? `Request failed with status ${response.status}`;
    if (kind === "unauthorized") unauthorizedHandler?.();
    throw new ApiError(kind, response.status, message, payload);
  }

  return payload as T;
}

function safeParse(text: string): unknown {  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * Nest returns `message` as a string for thrown exceptions, and as an array
 * of validation messages when a DTO fails class-validator.
 */
function extractMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && message.every((m) => typeof m === "string")) {
    return message.join(" · ");
  }
  return undefined;
}