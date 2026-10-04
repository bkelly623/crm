import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), many: vi.fn(), first: vi.fn(), list: vi.fn(), tag: vi.fn(), view: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findMany: m.many, findFirst: m.first }, leadList: { findFirst: m.list }, tag: { findFirst: m.tag }, smartView: { findFirst: m.view } } }));
import { GET as leads } from "@/app/api/leads/route";
import { GET as queue } from "@/app/api/dialer/next-lead/route";
import { fixtureLead, matches } from "./support/lead-query-fixture";
const listId = "cm123456789012345678901234";
const tagId = "cm123456789012345678901235";
it.each([leads, queue])("requires an accessible list and intersects tag/list/lead scope", async handler => {
  m.list.mockResolvedValue(null);
  expect((await handler(request(`listId=${listId}`))).status).toBe(404);
  expect(m.many).not.toHaveBeenCalled(); expect(m.first).not.toHaveBeenCalled();
  m.list.mockResolvedValue({ id: listId }); m.tag.mockResolvedValue({ id: tagId });
  expect((await handler(request(`listId=${listId}&tagId=${tagId}`))).status).toBe(200);
  expect(m.list).toHaveBeenLastCalledWith({ where: { id: listId, ownerId: "rep" }, select: { id: true } });
  const query = (handler === leads ? m.many : m.first).mock.calls[0][0];
  expect(query.where.AND).toContainEqual({ lists: { some: { listId, list: { ownerId: "rep" } } } });
  expect(query.where.AND).toContainEqual({ tags: { some: { tagId } } });
});
it.each(["admin", "sales_manager"])("%s may select another owner's list", async role => {
  m.profile.mockResolvedValue({ id: "boss", role }); m.list.mockResolvedValue({ id: listId });
  await leads(request(`listId=${listId}`));
  expect(m.list).toHaveBeenCalledWith({ where: { id: listId }, select: { id: true } });
});
it.each(["segment=bogus", "listId=bad", "tagId=bad", "q=" + "x".repeat(301), "myLeads=yes", "after=%20lead", "ownerId=other", "q=a&q=b"])("list rejects invalid query %s before DB", async q => {
  expect((await leads(request(q))).status).toBe(400); expect(m.many).not.toHaveBeenCalled();
});
it("paginates by immutable unique ID with lookahead and preserves empty lists", async () => {
  m.list.mockResolvedValue({ id: listId });
  m.many.mockResolvedValueOnce(Array.from({ length: 51 }, (_, i) => ({ id: `lead-${i}` })));
  const first = await (await leads(request(`listId=${listId}`))).json();
  expect(first.leads).toHaveLength(50); expect(first.nextCursor).toBe("lead-49");
  expect(m.many.mock.calls[0][0]).toMatchObject({ take: 51, orderBy: { id: "asc" } });
  const next = await (await leads(request(`listId=${listId}&after=lead-49`))).json();
  expect(next).toEqual({ leads: [], nextCursor: null });
  expect(m.many.mock.calls[1][0].where.AND).toContainEqual({ id: { gt: "lead-49" } });
});
it.each([leads, queue])("returns anonymous denial and generic storage failure", async handler => {
  m.profile.mockResolvedValue(null); expect((await handler(request())).status).toBe(401);
  m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.list.mockRejectedValue(new Error("secret db"));
  const res = await handler(request(`listId=${listId}`)); expect(res.status).toBe(500); expect(await res.text()).not.toContain("secret db");
});
it.each(["listId=bad", "tagId=bad", "smartViewId=bad", "exclude=", "exclude=%20lead", "exclude=" + "x".repeat(201), "extra=1", "listId=" + listId + "&listId=" + listId, Array.from({ length: 101 }, (_, i) => `exclude=lead-${i}`).join("&")])("queue rejects invalid/bounded input %s", async q => {
  expect((await queue(request(q))).status).toBe(400); expect(m.first).not.toHaveBeenCalled();
});
it("queue excludes reviewed IDs and keeps eligibility separate from explicit filters", async () => {
  m.view.mockResolvedValue({ filters: { segment: "all", sdrStatus: "dnc", setterId: "other", myLeadsOnly: true } });
  const res = await queue(request(`smartViewId=${listId}&exclude=one&exclude=two`));
  expect(res.status).toBe(200);
  expect(m.first.mock.calls[0][0]).toMatchObject({ orderBy: { id: "asc" } });
  const and = m.first.mock.calls[0][0].where.AND;
  expect(and).toContainEqual({ id: { notIn: ["one", "two"] } });
  expect(and).toContainEqual({ segment: "active", sdrStatus: { in: ["no_contact", "follow_up_needed", "callback_scheduled"] }, phone: { not: null } });
  expect(and).toContainEqual({ setterId: "rep" });
  expect(and).toContainEqual({ setterId: "other" });
  expect(and).toContainEqual({ sdrStatus: "dnc" });
});
it("fails closed for absent or malformed saved views instead of falling back", async () => {
  m.view.mockResolvedValue(null); expect((await queue(request(`smartViewId=${listId}`))).status).toBe(404);
  m.view.mockResolvedValue({ filters: { setterId: 42 } }); expect((await queue(request(`smartViewId=${listId}`))).status).toBe(400);
  expect(m.first).not.toHaveBeenCalled();
});
it.each(["sales_rep", "closer", "hybrid"])("%s receives only assigned intersection members from fixture query evaluation", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  const links = { lists: [{ listId, list: { ownerId: "rep" } }], tags: [{ tagId }] };
  const rows = [fixtureLead("allowed", { ...links, setterId: null, closerId: "rep" }), fixtureLead("unassigned", { ...links, setterId: null }), fixtureLead("other", { ...links, setterId: "other" }), fixtureLead("wrong-tag", { ...links, tags: [] }), fixtureLead("wrong-list", { ...links, lists: [] })];
  m.list.mockResolvedValue({ id: listId }); m.tag.mockResolvedValue({ id: tagId });
  m.many.mockImplementation(({ where }) => Promise.resolve(rows.filter(row => matches(row, where))));
  m.first.mockImplementation(({ where }) => Promise.resolve(rows.find(row => matches(row, where)) ?? null));
  const query = `listId=${listId}&tagId=${tagId}`;
  expect((await (await leads(request(query))).json()).leads.map((row: { id: string }) => row.id)).toEqual(["allowed"]);
  expect((await (await queue(request(query))).json()).lead.id).toBe("allowed");
  expect((await (await queue(request(query + "&exclude=allowed"))).json()).lead).toBeNull();
  expect((await (await leads(request(query + "&q=other"))).json()).leads).toEqual([]);
});
it("queue excludes nonreviewable statuses, non-active leads and missing phones even for managers", async () => {
  m.profile.mockResolvedValue({ id: "boss", role: "admin" });
  const rows = ["appointment_booked", "dnc", "wrong_number", "not_interested", "unknown"].map(status => fixtureLead(status, { sdrStatus: status }));
  rows.push(fixtureLead("won", { segment: "won" }), fixtureLead("trashed", { segment: "trashed" }), fixtureLead("no-phone", { phone: null }), fixtureLead("blank-phone", { phone: "" }));
  m.first.mockImplementation(({ where }) => Promise.resolve(rows.find(row => matches(row, where)) ?? null));
  expect((await (await queue(request())).json()).lead).toBeNull();
});
it.each([leads, queue])("unknown tag fails closed instead of broadening selection", async handler => {
  m.tag.mockResolvedValue(null); expect((await handler(request(`tagId=${tagId}`))).status).toBe(404);
  expect(m.many).not.toHaveBeenCalled(); expect(m.first).not.toHaveBeenCalled();
});
const request = (q = "") => new Request(`http://localhost/api/test?${q}`);
beforeEach(() => { vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.many.mockResolvedValue([]); m.first.mockResolvedValue(null); });
it.each(["client", "hiring_manager", "project_manager", "unknown"])("denies %s on list and queue before DB", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  expect((await leads(request())).status).toBe(403);
  expect((await queue(request())).status).toBe(403);
  expect(m.many).not.toHaveBeenCalled(); expect(m.first).not.toHaveBeenCalled();
});
it.each(["sales_rep", "closer", "hybrid"])("intersects %s assignment with search instead of overwriting OR", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  await leads(request("q=other")); await queue(request());
  for (const mock of [m.many, m.first]) expect(mock.mock.calls[0][0].where.AND).toContainEqual({ OR: [{ setterId: "rep" }, { closerId: "rep" }] });
});
