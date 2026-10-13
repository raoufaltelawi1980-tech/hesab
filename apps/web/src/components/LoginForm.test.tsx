import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";
import { renderWithProviders } from "@/test/Providers";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: push, push }),
}));

function stubFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("LoginForm", () => {
  it("submits credentials and stores the returned token", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchOnce({
      accessToken: "tok-abc",
      refreshToken: "ref-abc",
      user: { id: "u1", email: "a@b.com" },
    });

    renderWithProviders(<LoginForm />, { token: null });

    await user.type(screen.getByLabelText(/البريد الإلكتروني/), "a@b.com");
    await user.type(screen.getByLabelText(/كلمة المرور/), "secret123");
    await user.click(screen.getByRole("button", { name: "دخول" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/ledgers"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/login");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "secret123" });
    expect(window.localStorage.getItem("hesab.token")).toBe("tok-abc");
  });

  it("surfaces an authentication failure", async () => {
    const user = userEvent.setup();
    stubFetchOnce({ message: "Invalid credentials" }, 401);

    renderWithProviders(<LoginForm />, { token: null });

    await user.type(screen.getByLabelText(/البريد الإلكتروني/), "a@b.com");
    await user.type(screen.getByLabelText(/كلمة المرور/), "wrong");
    await user.click(screen.getByRole("button", { name: "دخول" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("انتهت الجلسة، سجّل الدخول مجددًا");
    expect(window.localStorage.getItem("hesab.token")).toBeNull();
  });

  it("switches to English and flips the document direction", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />, { token: null });

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "العربية" }));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.documentElement.lang).toBe("ar");
  });

  it("redirects an already-signed-in user away from login", async () => {
    renderWithProviders(<LoginForm />, { token: "existing-token" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/ledgers"));
  });
});