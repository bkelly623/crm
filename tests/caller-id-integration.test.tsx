// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn() }));
const { page } = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("twilio", () => ({ default: vi.fn(() => ({ incomingPhoneNumbers: { page } })) }));
import { getCurrentProfile } from "@/lib/auth";
import { GET } from "@/app/api/dialer/numbers/route";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC" + "0".repeat(32));
  vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic-token");
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "rep", role: "sales_rep" } as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.startsWith("/api/dialer/numbers")) throw new Error("Unexpected request");
    return GET(new Request(`https://crm.test${url}`));
  }));
});
it("component dispatches through real authorized route and adapter without provider networking", async () => {
  page.mockResolvedValue({ instances: [{ accountSid: "AC" + "0".repeat(32), sid: "PN" + "1".repeat(32), phoneNumber: "+12025550101", friendlyName: "Demo office", capabilities: { voice: true } }], nextPageUrl: null });
  await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load numbers" }));
  await screen.findByRole("option", { name: /Demo office/ });
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: "PN" + "1".repeat(32) } });
  expect(screen.getByText("Selected caller ID: +12025550101")).toBeTruthy();
  expect(page).toHaveBeenCalledExactlyOnceWith({ pageNumber: 0, pageSize: 50 });
});
it.each(["client", "missing-config"])("real route rejection %s is an unavailable UI, not a fabricated number", async mode => {
  if (mode === "client") vi.mocked(getCurrentProfile).mockResolvedValue({ id: "client", role: "client" } as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>);
  else vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load numbers" }));
  expect((await screen.findByRole("alert")).textContent).toContain("inventory unavailable");
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).value).toBe("");
  expect(page).not.toHaveBeenCalled();
});
