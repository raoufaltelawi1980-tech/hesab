import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { renderWithProviders } from "@/test/Providers";

function stubFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ForgotPasswordForm", () => {
  it("posts the email, hits the forgot-password route and shows a uniform message", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchOnce({ message: "if registered, a link is on its way" }, 202);

    renderWithProviders(<ForgotPasswordForm />, { token: null });

    await user.type(screen.getByLabelText(/البريد الإلكتروني/), "a@b.com");
    await user.click(screen.getByRole("button", { name: "إرسال الرابط" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/إذا كان البريد مسجّلًا/));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/forgot-password");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com" });
  });

  it("renders in English after switching locale", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />, { token: null });

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("surfaces a network failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    renderWithProviders(<ForgotPasswordForm />, { token: null });

    await user.type(screen.getByLabelText(/البريد الإلكتروني/), "a@b.com");
    await user.click(screen.getByRole("button", { name: "إرسال الرابط" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر الاتصال بالخادم");
  });
});
