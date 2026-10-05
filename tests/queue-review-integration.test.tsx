// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ profile: vi.fn(), find: vi.fn(), update: vi.fn(), list: vi.fn(), lists: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.find, update: m.update }, leadList: { findFirst: m.list, findMany: m.lists } } }));
import { GET as next } from "@/app/api/dialer/next-lead/route";
import { PATCH } from "@/app/api/leads/[id]/route";
import { GET as catalog } from "@/app/api/lead-organizers/[kind]/route";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";
import { fixtureLead, matches } from "./support/lead-query-fixture";
afterEach(cleanup);
const listId = "cm123456789012345678901234";
beforeEach(() => {
  vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" });
  m.list.mockResolvedValue({ id: listId }); m.lists.mockResolvedValue([{ id: listId, name: "Prospects", leads: [] }]);
});
function transport() {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const req = new Request(`http://localhost${url}`, init);
    if (url.startsWith("/api/dialer/next-lead")) return next(req);
    if (url.startsWith("/api/lead-organizers/lists")) return catalog(req, { params: Promise.resolve({ kind: "lists" }) });
    if (init?.method === "PATCH") return PATCH(req, { params: Promise.resolve({ id: decodeURIComponent(url.split("/").at(-1)!) }) });
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetcher); return fetcher;
}
it("real handlers progress through authorized named-list members once and finish empty", async () => {
  const links = { lists: [{ listId, list: { ownerId: "rep" } }] };
  const rows = [fixtureLead("one", links), fixtureLead("two", links), fixtureLead("private", { ...links, setterId: null }), fixtureLead("outside")];
  m.find.mockImplementation(({ where }) => Promise.resolve(rows.find(row => matches(row, where)) ?? null));
  m.update.mockImplementation(({ where, data }) => { const row = rows.find(row => matches(row, where)); if (!row) throw new Error(); Object.assign(row, data); return Promise.resolve(row); });
  const fetcher = transport(); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load lists" })); await screen.findByRole("option", { name: "Prospects" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: listId } });
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" })); await screen.findByText("Fixture one");
  fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Fixture two");
  fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("No eligible unreviewed leads in this selection.");
  expect(m.update).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain("exclude=one&exclude=two");
  fireEvent.click(screen.getByRole("button", { name: "End session" }));
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" })); await screen.findByText("No eligible unreviewed leads in this selection.");
});
it("bounds a review session at 100 without evicting exclusions or making an over-limit request", async () => {
  const rows = Array.from({ length: 101 }, (_, i) => fixtureLead(String(i).padStart(3, "0")));
  m.find.mockImplementation(({ where }) => Promise.resolve(rows.find(row => matches(row, where)) ?? null));
  const fetcher = transport(); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" }));
  for (let i = 0; i < 100; i++) {
    await screen.findByText(`Fixture ${String(i).padStart(3, "0")}`);
    fireEvent.click(screen.getByRole("button", { name: "Next Lead" }));
  }
  await screen.findByText(/Review session limit reached/);
  expect(fetcher).toHaveBeenCalledTimes(100);
  expect(screen.queryByText("Fixture 100")).toBeNull();
  expect((screen.getByRole("button", { name: "Load Lead" }) as HTMLButtonElement).disabled).toBe(true);
}, 15000);
it("concurrent save clicks produce one scoped mutation and retain an unsaved selection on failure", async () => {
  m.find.mockResolvedValue(fixtureLead("one")); let reject!: (err: Error) => void;
  m.update.mockImplementation(() => new Promise((_resolve, failure) => { reject = failure; }));
  const fetcher = transport(); await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" })); await screen.findByText("Fixture one");
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "callback_scheduled" } });
  const save = screen.getByRole("button", { name: "Save & Next" }); fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(m.update).toHaveBeenCalledTimes(1));
  reject(new Error("database offline")); await screen.findByRole("alert");
  expect((screen.getByLabelText("Disposition") as HTMLSelectElement).value).toBe("callback_scheduled");
  expect(screen.getByText("Fixture one")).toBeTruthy(); expect(fetcher).toHaveBeenCalledTimes(2);
});
