// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ profile: vi.fn(), leadFind: vi.fn(), leadUpdate: vi.fn(), tagFind: vi.fn(), listFind: vi.fn(), tagOne: vi.fn(), listOne: vi.fn(), tagCreate: vi.fn(), listCreate: vi.fn(), tagDelete: vi.fn(), listDelete: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.leadFind, update: m.leadUpdate }, tag: { findMany: m.tagFind, findFirst: m.tagOne, create: m.tagCreate }, leadList: { findMany: m.listFind, findFirst: m.listOne, create: m.listCreate }, leadTag: { deleteMany: m.tagDelete }, leadListMembership: { deleteMany: m.listDelete } } }));
import { GET, POST } from "@/app/api/lead-organizers/[kind]/route";
import { PUT, DELETE } from "@/app/api/leads/[id]/organizers/[kind]/route";
import { LeadWorkspace } from "@/components/leads/lead-workspace";
const tag = { id: "clx1234560000abcd123456789", name: "High Priority", leads: [] };
const list = { id: "clx1234560000abcd123456780", name: "Pennsylvania", leads: [] };
const lead = { id: "lead-1", businessName: "Fixture business", contactName: null, phone: null, email: null, website: null, revenue: null, location: null, industry: null, sicCode: null, market: null, type: null, sdrStatus: "no_contact", segment: "active" as const, notes: "Saved notes" };
beforeEach(() => {
  vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.leadFind.mockResolvedValue(lead); m.leadUpdate.mockResolvedValue(lead);
  m.tagFind.mockResolvedValue([tag]); m.listFind.mockResolvedValue([list]); m.tagOne.mockResolvedValue(tag); m.listOne.mockResolvedValue(list);
  m.tagDelete.mockResolvedValue({ count: 1 }); m.listDelete.mockResolvedValue({ count: 1 });
  m.tagCreate.mockResolvedValue({ id: "clx1234560000abcd123456781", name: "New tag" });
  m.listCreate.mockResolvedValue({ id: "clx1234560000abcd123456782", name: "New list" });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const request = new Request(`http://localhost${url}`, init);
    const parsed = new URL(request.url); const kind = parsed.pathname.split("/").pop()!;
    if (parsed.pathname.startsWith("/api/lead-organizers/")) return (init?.method === "POST" ? POST : GET)(request, { params: Promise.resolve({ kind }) });
    if (parsed.pathname.startsWith("/api/leads/lead-1/organizers/")) return (init?.method === "PUT" ? PUT : DELETE)(request, { params: Promise.resolve({ kind, id: "lead-1" }) });
    throw new Error("Unexpected network request");
  });
});
afterEach(cleanup);
function open() {
  render(<LeadWorkspace lead={lead} initialTasks={[]} currentUserId="rep" />);
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Unsaved promise" } });
  fireEvent.click(screen.getByRole("button", { name: "Edit tags and lists" }));
}
it.each(["tag", "list"])("creates a %s through the catalog route without changing lead fields", async kind => {
  open(); await screen.findByRole("button", { name: "Add tag High Priority" });
  fireEvent.change(screen.getByLabelText(`New ${kind} name`), { target: { value: `New ${kind}` } });
  fireEvent.click(screen.getByRole("button", { name: `Create ${kind}` }));
  await screen.findByRole("button", { name: kind === "tag" ? "Add tag New tag" : "Add to list New list" });
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Unsaved promise");
  expect(m.leadUpdate).not.toHaveBeenCalled();
});
it("shows pending membership state, retains selection on failure and retries safely", async () => {
  open(); const add = await screen.findByRole("button", { name: "Add tag High Priority" });
  let fail!: (error: Error) => void;
  m.leadUpdate.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  fireEvent.click(add);
  await waitFor(() => expect(add).toHaveProperty("disabled", true));
  expect(screen.getByText("Saving tags…")).toBeTruthy();
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail(new Error("private failure"));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Remove tag High Priority" })).toBeNull();
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Unsaved promise");
  fireEvent.click(screen.getByRole("button", { name: "Add tag High Priority" }));
  await screen.findByRole("button", { name: "Remove tag High Priority" });
});
it("retains create input on conflict, validates blank names and disables pending form", async () => {
  open(); await screen.findByRole("button", { name: "Add tag High Priority" });
  fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
  await screen.findByRole("alert"); expect(m.tagCreate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("New tag name"), { target: { value: "High Priority" } });
  let fail!: (error: object) => void;
  m.tagCreate.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create tag" })).toHaveProperty("disabled", true));
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail({ code: "P2002" });
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("already exists"));
  expect(screen.getByLabelText("New tag name")).toHaveProperty("value", "High Priority");
  fireEvent.change(screen.getByLabelText("New tag name"), { target: { value: "New tag" } });
  fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
  await screen.findByRole("button", { name: "Add tag New tag" });
  expect(screen.getByLabelText("New tag name")).toHaveProperty("value", "");
});
it("shows lazy loading and retryable catalog errors without breaking the lead form", async () => {
  let fail!: (error: Error) => void;
  m.tagFind.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  open(); expect(screen.getByText("Loading tags…")).toBeTruthy();
  await waitFor(() => expect(fail).toBeTypeOf("function")); fail(new Error("schema not applied"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Reload tags" }));
  await screen.findByRole("button", { name: "Add tag High Priority" });
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Unsaved promise");
});
it("loads the next bounded catalog page and uses phone-sized controls", async () => {
  const first = Array.from({ length: 51 }, (_, i) => ({ ...tag, id: `c${String(i).padStart(24, "0")}`, name: `Tag ${i}` }));
  m.tagFind.mockResolvedValueOnce(first).mockResolvedValueOnce([first[50]]);
  open(); fireEvent.click(await screen.findByRole("button", { name: "More tags" }));
  await screen.findByRole("button", { name: "Add tag Tag 50" });
  expect(screen.getAllByRole("button", { name: /^Add tag Tag/ })).toHaveLength(51);
  expect(m.tagFind.mock.calls[1][0].where.id).toEqual({ gt: first[49].id });
  for (const input of document.querySelectorAll("input, select, button")) expect(input.className).toContain("min-h-11");
  expect(screen.getByText(/Lists organize leads only; dialing is not connected/)).toBeTruthy();
});
it("edits tag/list memberships through real routes without discarding unsaved lead edits", async () => {
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Add tag High Priority" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add to list Pennsylvania" }));
  expect(await screen.findByRole("button", { name: "Remove tag High Priority" })).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Remove from list Pennsylvania" }));
  await screen.findByRole("button", { name: "Add to list Pennsylvania" });
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Unsaved promise");
  expect(m.tagOne).toHaveBeenCalled(); expect(m.listDelete).toHaveBeenCalled();
});
