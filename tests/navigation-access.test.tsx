// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UserRole } from "@prisma/client";
import { getNavForRole, SALES_REP_NAV, ADMIN_EXTRA_NAV } from "@/lib/nav";
import { Sidebar } from "@/components/layout/sidebar";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({}) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
afterEach(cleanup);
it.each([...Object.values(UserRole), "unknown"])("%s has unique role-appropriate accessible destinations and Home", role => {
  const nav = getNavForRole(role);
  const sales = ["admin", "sales_manager", "sales_rep", "closer", "hybrid"].includes(role);
  const manager = ["admin", "sales_manager"].includes(role);
  const labels = nav.map(item => item.label);
  expect(new Set(nav.map(item => item.href)).size).toBe(nav.length);
  expect(labels).toContain("Home"); expect(labels).toContain("Settings");
  if (!sales) expect(labels).toEqual(["Home", "Settings"]);
  else { expect(labels).toContain("Dialer"); expect(labels).toContain("Appointments"); expect(labels).toContain("Leaderboard"); expect(labels).toContain("Sequences (planned)"); }
  expect(labels.includes("Reports")).toBe(manager); expect(labels.includes("Team")).toBe(manager);
  render(<Sidebar nav={nav} userRole={role} userName="Test" userEmail="test@example.test" />);
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const links = within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link");
  expect(links.map(link => link.textContent)).toEqual(labels);
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
});
it("Sidebar applies declared item roles even with an unfiltered caller", () => {
  render(<Sidebar nav={[...SALES_REP_NAV, ...ADMIN_EXTRA_NAV]} userRole="client" userName="Test" userEmail="test@example.test" />);
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(within(screen.getByRole("navigation")).getAllByRole("link").map(link => link.textContent)).toEqual(["Home", "Settings"]);
});
