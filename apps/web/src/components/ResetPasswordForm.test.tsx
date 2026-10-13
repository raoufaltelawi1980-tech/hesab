import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { renderWithProviders } from "@/test/Providers";

function stubFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/reset-password");
  });

  it("submits the token and the new password and reports success", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchOnce({ success: true });

    renderWithProviders(<ResetPasswordForm token="tok-123" />, { token: null });

    await user.type(screen.getByLabelText(/كلمة المرور الجديدة/), "new-secret");
    await user.type(screen.getByLabelText(/تأكيد كلمة المرور/), "new-secret");
    await user.click(screen.getByRole("button", { name: "حفظ كلمة المرور" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("تم تحديث كلمة المرور"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/reset-password");
    expect(JSON.parse(init.body)).toEqual({ token: "tok-123", password: "new-secret" });
  });

  it("reads the token from the URL query string", async () => {
    window.history.pushState({}, "", "/reset-password?token=from-url");
    const user = userEvent.setup();
    const fetchMock = stubFetchOnce({ success: true });

    renderWithProviders(<ResetPasswordForm />, { token: null });
    await waitFor(() => expect(screen.getByLabelText(/كلمة المرور الجديدة/)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/كلمة المرور الجديدة/), "new-secret");
    await user.type(screen.getByLabelText(/تأكيد كلمة المرور/), "new-secret");
    await user.click(screen.getByRole("button", { name: "حفظ كلمة المرور" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      token: "from-url",
      password: "new-secret",
    });
  });

  it("blocks mismatched passwords without calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchOnce({ success: true });

    renderWithProviders(<ResetPasswordForm token="tok-123" />, { token: null });

    await user.type(screen.getByLabelText(/كلمة المرور الجديدة/), "one");
    await user.type(screen.getByLabelText(/تأكيد كلمة المرور/), "two");
    await user.click(screen.getByRole("button", { name: "حفظ كلمة المرور" }));

    expect(await screen.findByText("كلمتا المرور غير متطابقتين")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warns when the recovery link has no token", () => {
    renderWithProviders(<ResetPasswordForm token="" />, { token: null });
    expect(screen.getByRole("alert")).toHaveTextContent("رابط الاستعادة غير مكتمل أو غير صالح");
  });

  it("surfaces an invalid or expired token from the API", async () => {
    const user = userEvent.setup();
    stubFetchOnce({ message: "invalid" }, 400);

    renderWithProviders(<ResetPasswordForm token="bad" />, { token: null });

    await user.type(screen.getByLabelText(/كلمة المرور الجديدة/), "new-secret");
    await user.type(screen.getByLabelText(/تأكيد كلمة المرور/), "new-secret");
    await user.click(screen.getByRole("button", { name: "حفظ كلمة المرور" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("البيانات المُدخلة غير صحيحة");
  });
});
