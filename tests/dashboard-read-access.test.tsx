import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ profile: vi.fn(), leadCount: vi.fn(), callCount: vi.fn(), taskCount: vi.fn(), tasks: vi.fn(), calls: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: ({ taskCount }: { taskCount: number }) => <div>Badge: {taskCount}</div> }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { count: m.leadCount }, call: { count: m.callCount, findMany: m.calls }, task: { count: m.taskCount, findMany: m.tasks } } }));
import Home from "@/app/dashboard/page";
import Tasks from "@/app/dashboard/tasks/page";
import Calls from "@/app/dashboard/call-history/page";
import Layout from "@/app/dashboard/layout";
type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, val]) => {
    if (key === "AND") return (val as Row[]).every(part => matches(row, part));
    if (key === "OR") return (val as Row[]).some(part => matches(row, part));
    if (val && typeof val === "object") {
      const test = val as Row;
      if ("gte" in test) return (row[key] as Date) >= (test.gte as Date);
      if ("lt" in test) return (row[key] as Date) < (test.lt as Date);
      return matches(row[key] as Row, test);
    }
    return row[key] === val;
  });
}
const leads = [
  { id: "setter", businessName: "Setter fixture", setterId: "actor", closerId: null, segment: "active" },
  { id: "closer", businessName: "Closer fixture", setterId: "other", closerId: "actor", segment: "active" },
  { id: "reassigned", businessName: "REASSIGNED SECRET", setterId: "other", closerId: null, segment: "active" },
  { id: "unassigned", businessName: "UNASSIGNED SECRET", setterId: null, closerId: null, segment: "active" },
];
const tasks = leads.map(lead => ({ id: lead.id, lead, userId: "actor", status: "open", dueAt: new Date(0), note: lead.businessName }));
const calls = leads.map(lead => ({ id: lead.id, leadId: lead.id, lead, userId: "actor", status: "completed", startedAt: new Date() }));
// A visible lead does not grant ownership of another actor's overview activity.
tasks.push({ ...tasks[0], id: "other-task", userId: "other" });
calls.push({ ...calls[0], id: "other-call", userId: "other" });
beforeEach(() => {
  vi.resetAllMocks();
  m.profile.mockResolvedValue({ id: "actor", role: "sales_rep", email: "actor@example.test" });
  m.leadCount.mockImplementation(async ({ where }) => leads.filter(row => matches(row, where)).length);
  m.taskCount.mockImplementation(async ({ where }) => tasks.filter(row => matches(row, where)).length);
  m.callCount.mockImplementation(async ({ where }) => calls.filter(row => matches(row, where)).length);
  m.tasks.mockImplementation(async ({ where }) => tasks.filter(row => matches(row, where)));
  m.calls.mockImplementation(async ({ where }) => calls.filter(row => matches(row, where)));
});
it.each(["sales_rep", "closer", "hybrid", "admin", "sales_manager"])("Home %s totals intersect current lead authorization and activity ownership", async role => {
  m.profile.mockResolvedValue({ id: "actor", role, email: "actor@example.test" });
  const html = renderToStaticMarkup(await Home());
  const expected = ["admin", "sales_manager"].includes(role) ? 4 : 2;
  expect(html.match(new RegExp(`>${expected}</p>`, "g"))).toHaveLength(3);
});
it.each([null, "client", "hiring_manager", "project_manager", "unknown"])("Home %s never queries sales aggregates", async role => {
  m.profile.mockResolvedValue(role ? { id: "actor", role, email: "actor@example.test" } : null);
  const html = renderToStaticMarkup(await Home());
  expect(m.leadCount).not.toHaveBeenCalled(); expect(m.taskCount).not.toHaveBeenCalled(); expect(m.callCount).not.toHaveBeenCalled();
  expect(html).not.toContain('/dashboard/dialer');
  if (role) { expect(html).toContain("Sales tools are not available for this role"); expect(html).toContain('/dashboard/settings'); }
});
it.each(["sales_rep", "closer", "hybrid", "admin", "sales_manager"])("direct activity reads and badge for %s intersect ownership and current assignment", async role => {
  m.profile.mockResolvedValue({ id: "actor", role, email: "actor@example.test" });
  const manager = ["admin", "sales_manager"].includes(role);
  for (const page of [Tasks, Calls]) {
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Setter fixture"); expect(html).toContain("Closer fixture");
    expect(html.includes("REASSIGNED SECRET")).toBe(manager);
    expect(html.includes("UNASSIGNED SECRET")).toBe(manager);
    expect(html.match(/href="\/dashboard\/leads\//g)).toHaveLength(manager ? 4 : 2);
  }
  expect(renderToStaticMarkup(await Layout({ children: null }))).toContain(`Badge: ${manager ? 4 : 2}`);
});
it.each(["sales_rep", "closer", "hybrid"])("%s loses existing task/call context on the next read after reassignment", async role => {
  m.profile.mockResolvedValue({ id: "actor", role, email: "actor@example.test" });
  const before = renderToStaticMarkup(await Tasks()) + renderToStaticMarkup(await Calls());
  expect(before).toContain("Setter fixture");
  leads[0].setterId = "other";
  try {
    const after = renderToStaticMarkup(await Tasks()) + renderToStaticMarkup(await Calls());
    expect(after).not.toContain("Setter fixture"); expect(after).toContain("Closer fixture");
    expect(renderToStaticMarkup(await Layout({ children: null }))).toContain("Badge: 1");
    expect(renderToStaticMarkup(await Home()).match(/>1<\/p>/g)).toHaveLength(3);
  } finally { leads[0].setterId = "actor"; }
});
it.each([null, "client", "hiring_manager", "project_manager", "unknown"])("direct activity reads deny %s without querying lead context or badge", async role => {
  m.profile.mockResolvedValue(role ? { id: "actor", role, email: "actor@example.test" } : null);
  for (const page of [Tasks, Calls]) {
    if (role) await expect(page()).rejects.toThrow();
    else expect(await page()).toBeNull();
  }
  if (role) expect(renderToStaticMarkup(await Layout({ children: null }))).toContain("Badge: 0");
  else await expect(Layout({ children: null })).rejects.toThrow();
  expect(m.tasks).not.toHaveBeenCalled(); expect(m.calls).not.toHaveBeenCalled(); expect(m.taskCount).not.toHaveBeenCalled();
});
