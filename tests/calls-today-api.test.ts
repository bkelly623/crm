import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { call: { count: m.count } } }));
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
it("fresh endpoint returns scoped persisted counts without cache or client actor/day parameters", async () => {
  m.profile.mockResolvedValue({ id: "actor", role: "closer", timezone: "America/New_York" });
  m.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  const { GET } = await import("@/app/api/calls/today/route");
  const first = await GET();
  expect(first.headers.get("cache-control")).toContain("no-store");
  expect(await first.json()).toMatchObject({ count: 0, timezone: "America/New_York", day: "2026-10-05" });
  expect(await (await GET()).json()).toMatchObject({ count: 1 });
  expect(m.count).toHaveBeenLastCalledWith({ where: { userId: "actor", lead: { OR: [{ setterId: "actor" }, { closerId: "actor" }] }, startedAt: { gte: new Date("2026-10-05T04:00:00Z"), lt: new Date("2026-10-06T04:00:00Z") } } });
});
it.each([null, "client", "hiring_manager", "project_manager", "unknown"])("denies %s without querying calls", async role => {
  m.profile.mockResolvedValue(role ? { id: "actor", role } : null);
  const { GET } = await import("@/app/api/calls/today/route");
  expect((await GET()).status).toBe(role ? 403 : 401);
  expect(m.count).not.toHaveBeenCalled();
});
it("query failure is not reported as a fabricated zero", async () => {
  m.profile.mockResolvedValue({ id: "actor", role: "admin", timezone: "UTC" }); m.count.mockRejectedValue(new Error("private database error"));
  const { GET } = await import("@/app/api/calls/today/route");
  const response = await GET(); expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Call count unavailable" });
});
