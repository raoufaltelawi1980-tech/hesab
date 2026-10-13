import { ApiError, API_BASE_URL, apiRequest, onUnauthorized } from "@/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  afterEach(() => {
    onUnauthorized(() => {});
    vi.restoreAllMocks();
  });

  it("targets the API root without a version prefix", async () => {
    expect(API_BASE_URL).not.toContain("/api/v1");
  });

  it("sends the bearer token and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/ledgers/l1/transactions/drafts", {
      method: "POST",
      body: { amount: "10.00" },
      token: "tok-123",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/ledgers/l1/transactions/drafts`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ amount: "10.00" });
  });

  it("omits a body for GET requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/ledgers", { token: "t" });

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [400, "validation"],
    [422, "validation"],
    [429, "rateLimit"],
    [500, "server"],
  ])("maps status %i to the %s error kind", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, status)));
    await expect(apiRequest("/ledgers", { token: "t" })).rejects.toMatchObject({ kind });
  });

  it("joins class-validator message arrays into one string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ message: ["amount must be a decimal number", "currencyCode is required"] }, 400),
      ),
    );

    await expect(apiRequest("/ledgers", {})).rejects.toThrow(
      "amount must be a decimal number · currencyCode is required",
    );
  });

  it("reports a transport failure as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed to fetch")));
    await expect(apiRequest("/ledgers", {})).rejects.toMatchObject({ kind: "network" });
  });

  it("notifies the session layer when the token is rejected", async () => {
    const onRejected = vi.fn();
    onUnauthorized(onRejected);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));

    await expect(apiRequest("/ledgers", { token: "stale" })).rejects.toBeInstanceOf(ApiError);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it("tolerates an empty 200 body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(apiRequest("/auth/logout", { method: "POST", token: "t" })).resolves.toBeNull();
  });
});