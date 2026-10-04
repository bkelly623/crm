// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";
import { getNavForRole } from "@/lib/nav";
import DashboardLayout from "@/app/dashboard/layout";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => navigation }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn(() => { throw new Error("No live authentication in layout tests"); }) }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn(async () => ({ id: "test-rep", fullName: "Test rep", email: "rep@example.test", role: "sales_rep" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: { task: { count: vi.fn(async () => 3) } } }));
afterEach(cleanup);
beforeEach(() => { navigation.pathname = "/dashboard"; });

function sidebar(role = "sales_rep") {
  return <Sidebar nav={getNavForRole(role)} userName="Test rep" userEmail="rep@example.test" userRole={role} taskCount={3} />;
}

describe("mobile navigation", () => {
  it("stacks the phone shell without reserving desktop width and keeps content mounted while toggling", async () => {
    render(await DashboardLayout({ children: <textarea aria-label="Draft" defaultValue="Keep my notes" /> }));
    const main = screen.getByRole("main");
    const shell = main.parentElement!;
    expect(shell.classList.contains("flex-col")).toBe(true);
    expect(shell.classList.contains("lg:flex-row")).toBe(true);
    expect(main.classList.contains("min-w-0")).toBe(true);
    const sidebarElement = screen.getByRole("complementary");
    expect(sidebarElement.classList.contains("w-[17rem]")).toBe(false);
    expect(sidebarElement.classList.contains("lg:w-[17rem]")).toBe(true);
    const draft = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(draft, { target: { value: "Unsaved local draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
    expect((draft as HTMLTextAreaElement).value).toBe("Unsaved local draft");
  });
  it.each(["admin", "sales_manager", "sales_rep", "closer", "hybrid", "hiring_manager", "project_manager", "client"])("retains each %s destination once in the shared mobile/desktop panel", (role) => {
    render(sidebar(role));
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual([...new Set(getNavForRole(role).map(item => item.href))]);
    if (["admin", "sales_manager", "sales_rep", "closer", "hybrid"].includes(role)) expect(screen.getByRole("link", { name: "Follow-ups 3" })).toBeTruthy();
    else expect(screen.queryByRole("link", { name: "Follow-ups 3" })).toBeNull();
  });

  it("identifies the current destination and provides touch-sized navigation controls", () => {
    render(sidebar());
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    for (const link of screen.getAllByRole("link")) expect(link.classList.contains("min-h-11")).toBe(true);
    expect(screen.getByRole("button", { name: "Sign out" }).classList.contains("min-h-11")).toBe(true);
  });
  it("returns keyboard focus to the toggle when Escape closes navigation", () => {
    render(sidebar());
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    const link = screen.getByRole("link", { name: "Leads" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });
  it("closes after selecting the current route", () => {
    render(sidebar());
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    const link = screen.getByRole("link", { name: "Home" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on pathname changes without remounting the sidebar", () => {
    const view = render(sidebar());
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    navigation.pathname = "/dashboard/leads";
    view.rerender(sidebar());
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
  it("provides a labelled disclosure toggle controlling the collapsed panel", () => {
    render(sidebar());
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(panel).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel!.classList.contains("hidden")).toBe(true);
    expect(panel!.classList.contains("lg:flex")).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("Close navigation");
    expect(panel!.classList.contains("hidden")).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
