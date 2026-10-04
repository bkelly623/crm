// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const m = vi.hoisted(() => ({ profile: vi.fn(), many: vi.fn(), list: vi.fn(), tag: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findMany: m.many }, leadList: { findFirst: m.list }, tag: { findFirst: m.tag } } }));
import Page from "@/app/dashboard/leads/page";
import { GET } from "@/app/api/leads/route";
afterEach(cleanup);
const listId = "cm123456789012345678901234";
const tagId = "cm123456789012345678901235";
const row = (id: string) => ({ id, businessName: `Business ${id}`, sdrStatus: "no_contact", source: "manual" });
beforeEach(() => { vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.many.mockResolvedValue([]); m.list.mockResolvedValue({ id: listId }); m.tag.mockResolvedValue({ id: tagId }); });
async function mount(params = {}) { render(<AppRouterContext.Provider value={router}>{await Page({ searchParams: Promise.resolve(params) })}</AppRouterContext.Provider>); }
it("phone-friendly filters preserve search/segment/list/tag on pagination; applying resets cursor", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("lead-organizers")) return Response.json({ items: [{ id: url.includes("lists") ? listId : tagId, name: "Selected" }], nextCursor: null });
    return GET(new Request(`http://localhost${url}`));
  });
  vi.stubGlobal("fetch", fetcher); await mount();
  await screen.findByText("No leads in this view");
  fireEvent.change(screen.getByLabelText("Search leads"), { target: { value: "plumber" } });
  fireEvent.change(screen.getByLabelText("Segment"), { target: { value: "all" } });
  for (const [kind, label, id] of [["lists", "Named list", listId], ["tags", "Tag", tagId]]) {
    fireEvent.click(screen.getByRole("button", { name: `Load ${kind}` }));
    await waitFor(() => expect((screen.getByLabelText(label) as HTMLSelectElement).options.length).toBe(2));
    fireEvent.change(screen.getByLabelText(label), { target: { value: id } });
  }
  m.many.mockResolvedValueOnce(Array.from({ length: 51 }, (_, i) => row(`lead-${i}`)));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" })); await screen.findByText("Business lead-0");
  expect(screen.getByLabelText("Search leads").className).toContain("min-h-11");
  m.many.mockResolvedValueOnce([row("next")]);
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); await screen.findByText("Business next");
  const params = new URL(`http://localhost${fetcher.mock.calls.at(-1)?.[0]}`).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ q: "plumber", segment: "all", listId, tagId, after: "lead-49" });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" })); await screen.findByText("No leads in this view");
  expect(fetcher.mock.calls.at(-1)?.[0]).not.toContain("after=");
});
it("refreshes results when the server page refreshes after lead creation without losing applied filters", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => GET(new Request(`http://localhost${url}`))));
  const view = render(<AppRouterContext.Provider value={router}>{await Page({ searchParams: Promise.resolve({ q: "new" }) })}</AppRouterContext.Provider>);
  await screen.findByText("No leads in this view");
  m.many.mockResolvedValueOnce([row("new")]);
  view.rerender(<AppRouterContext.Provider value={router}>{await Page({ searchParams: Promise.resolve({ q: "new" }) })}</AppRouterContext.Provider>);
  await screen.findByText("Business new");
  expect((screen.getByLabelText("Search leads") as HTMLInputElement).value).toBe("new");
});
it("navigation to different URL filters replaces the current query", async () => {
  const fetcher = vi.fn((url: string) => GET(new Request(`http://localhost${url}`))); vi.stubGlobal("fetch", fetcher);
  const view = render(<AppRouterContext.Provider value={router}>{await Page({ searchParams: Promise.resolve({ q: "old" }) })}</AppRouterContext.Provider>);
  await screen.findByText("No leads in this view");
  view.rerender(<AppRouterContext.Provider value={router}>{await Page({ searchParams: Promise.resolve({ q: "new" }) })}</AppRouterContext.Provider>);
  await waitFor(() => expect(fetcher.mock.calls.at(-1)?.[0]).toContain("q=new"));
});
it("renders safe load errors with retry and never mislabels failure as empty", async () => {
  m.many.mockRejectedValueOnce(new Error("private db"));
  vi.stubGlobal("fetch", vi.fn((url: string) => GET(new Request(`http://localhost${url}`))));
  await mount(); await screen.findByRole("alert");
  expect(screen.queryByText("No leads in this view")).toBeNull(); expect(screen.queryByText(/private db/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("No leads in this view");
});
