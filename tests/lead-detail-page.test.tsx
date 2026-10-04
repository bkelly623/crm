import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const m = vi.hoisted(() => ({ profile: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.find, findUnique: m.find } } }));
import Page from "@/app/dashboard/leads/[id]/page";
const params = { params: Promise.resolve({ id: "lead-1" }) };
const lead = { id: "lead-1", businessName: "Fixture", sdrStatus: "no_contact", segment: "active", notes: "Actual existing note", tasks: [], calls: [] };
beforeEach(() => { vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.find.mockResolvedValue(lead); });
it.each(["client", "hiring_manager", "project_manager", "unknown"])("server render denies %s without querying leads", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  await expect(Page(params)).rejects.toThrow(); expect(m.find).not.toHaveBeenCalled();
});
it("server render denies unauthenticated users", async () => {
  m.profile.mockResolvedValue(null); await expect(Page(params)).rejects.toThrow(); expect(m.find).not.toHaveBeenCalled();
});
it("server render enforces assignment and hides missing or inaccessible records", async () => {
  m.find.mockResolvedValue(null); await expect(Page(params)).rejects.toThrow();
  expect(m.find.mock.calls[0][0].where).toEqual({ id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] });
});
it.each(["sales_rep", "admin", "sales_manager"])("renders editable workspace for authorized %s without inert calling buttons", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>{await Page(params)}</AppRouterContext.Provider>);
  expect(html).toContain("Actual existing note"); expect(html).toContain("Save lead"); expect(html).toContain("Add follow-up");
  expect(html).not.toContain("Book Appointment"); expect(html).not.toContain('href="tel:');
  expect(m.find.mock.calls[0][0].where).toEqual(role === "sales_rep" ? { id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] } : { id: "lead-1" });
});
