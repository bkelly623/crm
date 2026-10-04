import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ profile: vi.fn(), leads: vi.fn(), views: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findMany: m.leads }, smartView: { findMany: m.views } } }));
import LeadsPage from "@/app/dashboard/leads/page";
import DialerPage from "@/app/dashboard/dialer/page";
beforeEach(() => { vi.resetAllMocks(); m.leads.mockResolvedValue([]); m.views.mockResolvedValue([]); });
it.each([null, "client", "hiring_manager", "project_manager", "unknown"])("both server pages deny %s before querying", async role => {
  m.profile.mockResolvedValue(role ? { id: "rep", role } : null);
  await expect(LeadsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  await expect(DialerPage()).rejects.toThrow();
  expect(m.leads).not.toHaveBeenCalled(); expect(m.views).not.toHaveBeenCalled();
});
it("dialer describes review, not credential-enabled live calling", async () => {
  m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" });
  const html = renderToStaticMarkup(await DialerPage());
  expect(html).toContain("Lead review queue"); expect(html).not.toContain("when credentials are set");
  expect(html).toContain("server-authorized manual calls");
  expect(html).not.toContain("pilot calls");
  expect(html).not.toContain("Approved pilot recipients only");
  expect(html).toContain("Eligible authorized leads only");
  expect(html).toContain("one-hour call limit");
});
