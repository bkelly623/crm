// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";
import { OrganizerSelect } from "@/components/leads/organizer-select";
afterEach(cleanup);
it("catalog pagination preserves selection and reload clears stale selection only after a complete catalog", async () => {
  const change = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ items: [{ id: listId, name: "First" }], nextCursor: listId }))
    .mockResolvedValueOnce(Response.json({ items: [{ id: tagId, name: "Last" }], nextCursor: null }))
    .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }));
  vi.stubGlobal("fetch", fetcher);
  render(<OrganizerSelect kind="lists" value={tagId} onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Load lists" }));
  await screen.findByRole("option", { name: "First" }); expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "More lists" }));
  await screen.findByRole("option", { name: "Last" }); expect(change).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[1][0]).toBe(`/api/lead-organizers/lists?after=${listId}`);
  fireEvent.click(screen.getByRole("button", { name: "Reload lists" }));
  await waitFor(() => expect(change).toHaveBeenCalledWith(""));
  expect(screen.getByRole("alert").textContent).toContain("no longer available");
});
it("catalog failures are visible and retryable without losing a selection", async () => {
  const change = vi.fn(); vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ items: [{ id: listId, name: "Restored" }], nextCursor: null })));
  render(<OrganizerSelect kind="lists" value={listId} onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Load lists" })); await screen.findByRole("alert");
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load lists" })); await screen.findByRole("option", { name: "Restored" });
});
it("ignores a queue response when an in-flight catalog reload invalidates its selection", async () => {
  let resolveCatalog!: (res: Response) => void;
  let resolveQueue!: (res: Response) => void;
  const catalog = new Promise<Response>(resolve => { resolveCatalog = resolve; });
  const queue = new Promise<Response>(resolve => { resolveQueue = resolve; });
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ items: [{ id: listId, name: "My list" }], nextCursor: null })).mockReturnValueOnce(catalog).mockReturnValueOnce(queue);
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load lists" })); await screen.findByRole("option", { name: "My list" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: listId } });
  fireEvent.click(screen.getByRole("button", { name: "Reload lists" }));
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" }));
  await act(async () => resolveCatalog(Response.json({ items: [], nextCursor: null })));
  await act(async () => resolveQueue(Response.json({ lead: lead("stale") })));
  expect((screen.getByLabelText("Named list") as HTMLSelectElement).value).toBe("");
  expect(screen.queryByText("Business stale")).toBeNull();
});
const listId = "cm123456789012345678901234";
const tagId = "cm123456789012345678901235";
const lead = (id: string) => ({ id, businessName: `Business ${id}`, sdrStatus: "no_contact", phone: "123", contactName: null });
it("selects named list/tag intersection and clears the old lead when selection changes", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("lead-organizers/lists")) return Response.json({ items: [{ id: listId, name: "My prospects" }], nextCursor: null });
    if (url.includes("lead-organizers/tags")) return Response.json({ items: [{ id: tagId, name: "Priority" }], nextCursor: null });
    return Response.json({ lead: lead("one") });
  });
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load lists" }));
  await screen.findByRole("option", { name: "My prospects" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: listId } });
  fireEvent.click(screen.getByRole("button", { name: "Load tags" }));
  fireEvent.change(await screen.findByLabelText("Tag"), { target: { value: tagId } });
  await screen.findByRole("option", { name: "Priority" });
  fireEvent.change(screen.getByLabelText("Tag"), { target: { value: tagId } });
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" }));
  await screen.findByText("Business one");
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain(`listId=${listId}&tagId=${tagId}`);
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: "" } });
  expect(screen.queryByText("Business one")).toBeNull();
});
it("Save & Next excludes reviewed leads within a session, even with unchanged disposition", async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return Response.json({ lead: lead("one") });
    return Response.json({ lead: lead(url.includes("exclude=one") ? "two" : "one") });
  });
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" })); await screen.findByText("Business one");
  fireEvent.click(screen.getByRole("button", { name: "Save & Next" }));
  await screen.findByText("Business two");
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain("exclude=one");
});
it("save failure retains review and disposition; pause blocks progression", async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? Response.json({ error: "Save failed" }, { status: 500 }) : Response.json({ lead: lead("one") }));
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" })); await screen.findByText("Business one");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect((screen.getByRole("button", { name: "Save & Next" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  fireEvent.click(screen.getByRole("button", { name: "Save & Next" }));
  await screen.findByRole("alert"); expect(screen.getByText("Business one")).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("clears invalid stale selection on queue rejection without loading all leads", async () => {
  const fetcher = vi.fn(async () => Response.json({ error: "Selection not found" }, { status: 404 }));
  vi.stubGlobal("fetch", fetcher); await renderReviewDialer(<DialerPanel smartViews={[{ id: listId, name: "Old view" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" }));
  await screen.findByRole("alert");
  await waitFor(() => expect((screen.getByLabelText("SmartView") as HTMLSelectElement).value).toBe(""));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
