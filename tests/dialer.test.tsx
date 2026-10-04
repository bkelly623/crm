// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";

afterEach(cleanup);

it.each(["disabled", "unconfigured", "ready", "error"])("never hands off calls with token state %s", async (state) => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/twilio/token") {
      if (state === "error") throw new Error("offline");
      return { ok: state === "ready", status: state === "ready" ? 200 : 503 };
    }
    if (url === "/api/dialer/next-lead") return {
      ok: true, status: 200,
      json: async () => ({ lead: { id: "test-lead", businessName: "Offline fixture", contactName: null, phone: "+15005550006", sdrStatus: "no_contact" } }),
    };
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const { container } = await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /Start Dialing|Load Lead/ }));
  const call = await screen.findByRole("button", { name: "Call" });
  fireEvent.click(call);
  expect(open).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/dialer/next-lead"]);
  expect((call as HTMLButtonElement).disabled).toBe(true);
  expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  expect(screen.getByText(/Calling unavailable/)).toBeTruthy();
});
