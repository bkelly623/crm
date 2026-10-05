// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";
afterEach(cleanup);
const first = { sid: "PN" + "1".repeat(32), phoneNumber: "+12025550101", friendlyName: "Demo office" };
const second = { sid: "PN" + "2".repeat(32), phoneNumber: "+12025550102", friendlyName: "Demo branch" };
const reply = (numbers = [first, second], nextPage: number | null = null, truncated = false) => Response.json({ numbers, nextPage, hasMore: nextPage !== null || truncated, truncated });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
it.each([401, 403, 502, 503])("shows safe inventory error %s and allows retry without selecting a fallback", async status => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ numbers: [], error: "private-provider-detail" }, { status })).mockResolvedValueOnce(reply());
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  click("Load numbers");
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Number inventory unavailable. Reload to retry; remembered selection is not verified.");
  expect(screen.queryByText(/private-provider-detail/)).toBeNull();
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).value).toBe("");
  click("Reload numbers"); await screen.findByRole("option", { name: /Demo office/ });
  expect(screen.queryByRole("alert")).toBeNull();
});
it("paginates without false empty/stale results and clears selection only after a complete reload", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply([], 1)).mockResolvedValueOnce(reply([second]))
    .mockResolvedValueOnce(reply([first], 1)).mockResolvedValueOnce(reply([first]));
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  click("Load numbers"); await screen.findByRole("button", { name: "More numbers" });
  expect(screen.queryByText("No owned voice-capable numbers available.")).toBeNull();
  click("More numbers"); await screen.findByRole("option", { name: /Demo branch/ });
  expect(fetcher.mock.calls[1][0]).toBe("/api/dialer/numbers?page=1");
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: second.sid } });
  click("Reload numbers"); await screen.findByRole("button", { name: "More numbers" });
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).value).toBe(second.sid);
  expect(screen.getByText("Remembered selection not yet verified in this inventory. Load remaining pages or choose a listed number.")).toBeTruthy();
  click("More numbers"); await screen.findByText("Selected number is no longer available. Choose another number.");
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).value).toBe("");
  expect(screen.getAllByRole("option", { name: /Demo office/ })).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: first.sid } });
  expect(screen.queryByRole("alert")).toBeNull();
});
it("serializes inventory requests and leaves review controls independent", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  click("Load numbers");
  expect(screen.getByRole("status").textContent).toBe("Loading number inventory…");
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Loading numbers…" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Load Lead" }) as HTMLButtonElement).disabled).toBe(false);
  finish(reply()); await screen.findByRole("option", { name: /Demo office/ });
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).disabled).toBe(false);
});
it("retains but marks an unavailable selected number unverified after a network error", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply()).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(reply([first]));
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  click("Load numbers"); await screen.findByRole("option", { name: /Demo office/ });
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: first.sid } });
  click("Reload numbers"); await screen.findByRole("alert");
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).value).toBe(first.sid);
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).disabled).toBe(true);
  click("Reload numbers"); await screen.findByText(`Selected caller ID: ${first.phoneNumber}`);
  await waitFor(() => expect((screen.getByLabelText("Call from") as HTMLSelectElement).disabled).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
});
it.each([false, true])("distinguishes an empty catalog from bounded truncation=%s", async truncated => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply([], null, truncated)));
  await renderReviewDialer(<DialerPanel smartViews={[]} />); click("Load numbers");
  await screen.findByText(truncated ? "Inventory limit reached; more provider numbers exist. Ask an administrator to review the catalog." : "No owned voice-capable numbers available.");
  expect(screen.queryByRole("button", { name: "More numbers" })).toBeNull();
});
it.each([{ numbers: [] }, { numbers: [{ ...first, sid: "forged" }], nextPage: null, hasMore: false, truncated: false }, { numbers: [], nextPage: "http://evil.test", hasMore: true, truncated: false }])("rejects malformed inventory responses", async body => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  await renderReviewDialer(<DialerPanel smartViews={[]} />); click("Load numbers");
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Number inventory unavailable. Reload to retry; remembered selection is not verified.");
});
it("requires manual selection, displays the chosen phone, and preserves review progress", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/dialer/numbers")) return reply();
    if (url.startsWith("/api/lead-organizers/lists")) return Response.json({ items: [{ id: "list-a", name: "Prospects" }], nextCursor: null });
    if (url.startsWith("/api/dialer/next-lead")) return Response.json({ lead: url.includes("exclude=lead-a") ? null : { id: "lead-a", businessName: "Demo lead", phone: "+12025550103", sdrStatus: "no_contact" } });
    throw new Error("Unexpected request " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  await renderReviewDialer(<DialerPanel smartViews={[]} />);
  const selector = screen.getByLabelText("Call from") as HTMLSelectElement;
  expect(selector.value).toBe(""); expect(fetcher).not.toHaveBeenCalled();
  click("Load numbers"); await screen.findByRole("option", { name: /Demo office/ });
  expect(selector.value).toBe("");
  fireEvent.change(selector, { target: { value: first.sid } });
  expect(screen.getByText(`Selected caller ID: ${first.phoneNumber}`)).toBeTruthy();
  click("Load lists"); await screen.findByRole("option", { name: "Prospects" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: "list-a" } });
  click("Load Lead"); await screen.findByText("Demo lead");
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  fireEvent.change(selector, { target: { value: second.sid } });
  expect(screen.getByText("Demo lead")).toBeTruthy();
  expect((screen.getByLabelText("Named list") as HTMLSelectElement).value).toBe("list-a");
  expect((screen.getByLabelText("Disposition") as HTMLSelectElement).value).toBe("follow_up_needed");
  expect((screen.getByRole("button", { name: "Call" }) as HTMLButtonElement).disabled).toBe(true);
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  click("Next Lead"); await screen.findByText(/No eligible unreviewed/);
  expect(selector.value).toBe(second.sid);
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("listId=list-a&exclude=lead-a"))).toBe(true);
  click("End session"); expect(selector.value).toBe(second.sid);
});
