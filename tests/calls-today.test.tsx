import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ profile: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { call: { count: m.count }, lead: { count: vi.fn(async () => 0) }, task: { count: vi.fn(async () => 0) } } }));
import Home from "@/app/dashboard/page";
import { callDayWindow, getCallsToday } from "@/lib/calls/today";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it.each([
  ["2026-03-08T12:00:00Z", "America/New_York", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"],
  ["2026-11-01T12:00:00Z", "America/New_York", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"],
  ["2026-10-05T00:00:00Z", "Asia/Kathmandu", "2026-10-04T18:15:00.000Z", "2026-10-05T18:15:00.000Z"],
  ["2026-10-05T12:00:00Z", "invalid zone", "2026-10-05T00:00:00.000Z", "2026-10-06T00:00:00.000Z"],
])("calendar bounds %s in %s", (now, timezone, start, end) => {
  const window = callDayWindow(new Date(now), timezone);
  expect(window.start.toISOString()).toBe(start); expect(window.end.toISOString()).toBe(end);
  if (timezone === "invalid zone") expect(window.timezone).toBe("UTC");
});
it.each(["sales_rep", "closer", "hybrid", "admin", "sales_manager"])("%s counts persisted attempts exactly once within half-open dates and current scope", async role => {
  const now = new Date("2026-10-05T12:00:00Z");
  const rows = [
    { time: "2026-10-05T03:59:59.999Z", userId: "actor", setterId: "actor", closerId: null },
    { time: "2026-10-05T04:00:00Z", userId: "actor", setterId: "actor", closerId: "actor" },
    { time: "2026-10-06T03:59:59.999Z", userId: "actor", setterId: "other", closerId: "actor" },
    { time: "2026-10-06T04:00:00Z", userId: "actor", setterId: "actor", closerId: null },
    { time: "2026-10-05T12:00:00Z", userId: "other", setterId: "actor", closerId: null },
    { time: "2026-10-05T12:00:00Z", userId: "actor", setterId: "other", closerId: null },
    { time: "2026-10-05T12:00:00Z", userId: "actor", setterId: null, closerId: null },
  ];
  m.count.mockImplementation(async ({ where }) => rows.filter(row => {
    const assignment = !where.lead.OR || where.lead.OR.some((predicate: Record<string, string>) => Object.entries(predicate).every(([k, v]) => row[k as "setterId" | "closerId"] === v));
    return assignment && row.userId === where.userId && new Date(row.time) >= where.startedAt.gte && new Date(row.time) < where.startedAt.lt;
  }).length);
  expect((await getCallsToday({ id: "actor", role, timezone: "America/New_York" }, now)).count).toBe(["admin", "sales_manager"].includes(role) ? 4 : 2);
});
it("Home excludes three calls from yesterday in actor timezone even when server date is unchanged", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
  m.profile.mockResolvedValue({ id: "actor", role: "sales_rep", email: "fixture@example.test", timezone: "America/New_York" });
  const calls = ["2026-10-05T00:30:00Z", "2026-10-05T01:00:00Z", "2026-10-05T03:59:59Z"].map(t => new Date(t));
  m.count.mockImplementation(async ({ where }) => calls.filter(t => t >= where.startedAt.gte && (!where.startedAt.lt || t < where.startedAt.lt)).length);
  const html = renderToStaticMarkup(await Home());
  expect(html).toMatch(/Your calls today[^]*?>0<\/p>/);
  expect(html).not.toMatch(/>3<\/p>/);
  expect(m.count.mock.calls[0][0].where).toEqual({ userId: "actor", lead: { OR: [{ setterId: "actor" }, { closerId: "actor" }] }, startedAt: { gte: new Date("2026-10-05T04:00:00Z"), lt: new Date("2026-10-06T04:00:00Z") } });
});
