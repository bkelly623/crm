import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), leadFind: vi.fn(), leadUpdate: vi.fn(), listFind: vi.fn(), tagFind: vi.fn(), listDelete: vi.fn(), tagDelete: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.leadFind, update: m.leadUpdate }, leadList: { findFirst: m.listFind }, tag: { findFirst: m.tagFind }, leadTag: { deleteMany: m.tagDelete }, leadListMembership: { deleteMany: m.listDelete } } }));
import { PUT, DELETE } from "@/app/api/leads/[id]/organizers/[kind]/route";
const one = "clx1234560000abcd123456789", two = "clx1234560000abcd123456780";
const ctx = (kind = "lists", id = "lead-1") => ({ params: Promise.resolve({ kind, id }) });
const req = (organizerId = one) => new Request("http://localhost", { method: "PUT", body: JSON.stringify({ organizerId }) });
beforeEach(() => {
  vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" });
  m.leadFind.mockResolvedValue({ id: "lead-1" }); m.listFind.mockResolvedValue({ id: one }); m.tagFind.mockResolvedValue({ id: one });
});
it.each([null, { id: "rep", role: "client" }, { id: "rep", role: "hiring_manager" }, { id: "rep", role: "project_manager" }, { id: "rep", role: "unknown" }])("denies membership changes for %j", async actor => {
  m.profile.mockResolvedValue(actor);
  for (const kind of ["tags", "lists"]) for (const action of [PUT, DELETE]) expect((await action(req(), ctx(kind))).status).toBe(actor ? 403 : 401);
  expect(m.leadUpdate).not.toHaveBeenCalled(); expect(m.leadFind).not.toHaveBeenCalled();
});
it.each(["sales_rep", "closer", "hybrid"])("denies %s on an inaccessible master lead", async role => {
  m.profile.mockResolvedValue({ id: "rep", role }); m.leadFind.mockResolvedValue(null);
  for (const action of [PUT, DELETE]) expect((await action(req(), ctx())).status).toBe(404);
  expect(m.leadUpdate).not.toHaveBeenCalled();
  expect(m.leadFind.mock.calls[0][0].where).toEqual({ id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] });
});
it("does not leak or mutate another owner's list", async () => {
  m.listFind.mockResolvedValue(null);
  for (const action of [PUT, DELETE]) expect((await action(req(), ctx())).status).toBe(404);
  expect(m.listFind.mock.calls[0][0].where).toEqual({ id: one, ownerId: "rep" });
  expect(m.leadUpdate).not.toHaveBeenCalled();
});
it.each(["admin", "sales_manager"])("permits %s to manage another owner's lists", async role => {
  m.profile.mockResolvedValue({ id: "boss", role });
  expect((await PUT(req(), ctx())).status).toBe(200);
  expect(m.listFind.mock.calls[0][0].where).toEqual({ id: one });
  expect(m.leadUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "lead-1" }, data: { lists: { upsert: { create: { list: { connect: { id: one } } } } } } });
});
it("adds/removes shared tags idempotently without list ownership", async () => {
  expect((await PUT(req(), ctx("tags"))).status).toBe(200);
  expect(m.leadUpdate.mock.calls[0][0].data).toEqual({ tags: { upsert: { where: { leadId_tagId: { leadId: "lead-1", tagId: one } }, create: { tag: { connect: { id: one } } }, update: { tag: { connect: { id: one } } } } } });
  for (let i = 0; i < 2; i++) expect((await DELETE(req(), ctx("tags"))).status).toBe(200);
  expect(m.tagDelete).toHaveBeenCalledWith({ where: { leadId: "lead-1", tagId: one, lead: { OR: [{ setterId: "rep" }, { closerId: "rep" }] } } });
  expect(m.listFind).not.toHaveBeenCalled();
  m.tagFind.mockResolvedValue(null); expect((await PUT(req(), ctx("tags"))).status).toBe(404);
});
it.each(["bad", ` ${one}`, `${one} `, ""])("rejects malformed organizer ID %j without repair", async id => {
  expect((await PUT(req(id), ctx())).status).toBe(400); expect(m.leadUpdate).not.toHaveBeenCalled();
});
it("rejects malformed JSON, unexpected keys and invalid path identifiers", async () => {
  expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{" }), ctx())).status).toBe(400);
  expect((await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ organizerId: one, ownerId: "other" }) }), ctx())).status).toBe(400);
  expect((await DELETE(req(), ctx("other"))).status).toBe(400);
  expect((await DELETE(req(), ctx("lists", " lead-1"))).status).toBe(400);
  expect(m.leadUpdate).not.toHaveBeenCalled();
});
it("retries one unique race but never treats a failed write as success", async () => {
  m.leadUpdate.mockRejectedValueOnce({ code: "P2002" }).mockResolvedValue({ id: "lead-1" });
  expect((await PUT(req(), ctx())).status).toBe(200); expect(m.leadUpdate).toHaveBeenCalledTimes(2);
  m.leadUpdate.mockRejectedValue({ code: "P2002" });
  expect((await PUT(req(), ctx())).status).toBe(500); expect(m.leadUpdate).toHaveBeenCalledTimes(4);
});
it("returns not found if write-time access changes and hides internal failures", async () => {
  m.leadUpdate.mockRejectedValue({ code: "P2025" }); expect((await PUT(req(), ctx())).status).toBe(404);
  m.listDelete.mockRejectedValue(new Error("private database details"));
  const response = await DELETE(req(), ctx()); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
});
it("keeps one master lead in two lists and makes repeated add/remove idempotent", async () => {
  const memberships = new Set<string>();
  // Stateful DB boundary: inspect the actual nested-write contract. Not a live SQL proof.
  m.leadUpdate.mockImplementation(async ({ where, data }) => {
    expect(where).toEqual({ id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] });
    if (data.lists.upsert) {
      const operation = data.lists.upsert;
      expect(operation.where.leadId_listId.leadId).toBe("lead-1");
      expect(operation.create.list.connect).toEqual({ id: operation.where.leadId_listId.listId, ownerId: "rep" });
      expect(operation.update.list.connect).toEqual(operation.create.list.connect);
      memberships.add(operation.where.leadId_listId.listId);
    }
    return { id: "lead-1" };
  });
  m.listDelete.mockImplementation(async ({ where }) => {
    expect(where).toEqual({ leadId: "lead-1", listId: one, lead: { OR: [{ setterId: "rep" }, { closerId: "rep" }] }, list: { ownerId: "rep" } });
    memberships.delete(where.listId); return { count: 1 };
  });
  for (const id of [one, one, two, two]) expect((await PUT(req(id), ctx())).status).toBe(200);
  expect([...memberships].sort()).toEqual([one, two].sort());
  for (let i = 0; i < 2; i++) expect((await DELETE(req(one), ctx())).status).toBe(200);
  expect([...memberships]).toEqual([two]);
});
