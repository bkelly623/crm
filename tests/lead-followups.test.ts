import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.find }, task: { create: m.create, updateMany: m.update } } }));
import { POST, PATCH } from "@/app/api/tasks/route";
const body = { leadId: "lead-1", note: " Follow up ", dueAt: "2026-10-10T13:00:00.000Z" };
const request = (data: unknown) => new Request("http://localhost/api/tasks", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.find.mockResolvedValue({ id: "lead-1" }); m.create.mockResolvedValue({ id: "task-1" }); m.update.mockResolvedValue({ count: 1 }); });
it("checks scoped lead access before creating a self-owned follow-up", async () => {
  expect((await POST(request({ ...body, userId: "other" }))).status).toBe(201);
  expect(m.find).toHaveBeenCalledWith({ where: { id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] }, select: { id: true } });
  expect(m.create).toHaveBeenCalledWith({ data: { note: "Follow up", dueAt: new Date(body.dueAt), user: { connect: { id: "rep" } }, lead: { connect: { id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] } }, status: "open" } });
});
it("rejects creation against inaccessible/missing leads", async () => {
  m.find.mockResolvedValue(null); expect((await POST(request(body))).status).toBe(404); expect(m.create).not.toHaveBeenCalled();
});
it.each(["client", "hiring_manager", "project_manager"])("denies %s task access", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  expect((await POST(request(body))).status).toBe(403);
  expect((await PATCH(request({ id: "clx1234560000abcd123456789", status: "completed" }))).status).toBe(403);
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it.each([{ ...body, note: " " }, { ...body, note: "a".repeat(2001) }, { ...body, dueAt: "not-a-date" }, { ...body, leadId: "" }, null])("rejects invalid follow-up %#", async value => {
  expect((await POST(request(value))).status).toBe(400); expect(m.create).not.toHaveBeenCalled();
});
it("does not silently trim a lead identifier", async () => {
  expect((await POST(request({ ...body, leadId: " lead-1 " }))).status).toBe(400);
  expect(m.find).not.toHaveBeenCalled();
});
it("denies anonymous creation", async () => {
  m.profile.mockResolvedValue(null); expect((await POST(request(body))).status).toBe(401); expect(m.create).not.toHaveBeenCalled();
});
it("keeps update DB failures safe", async () => {
  m.update.mockRejectedValue(new Error("private database"));
  const response = await PATCH(request({ id: "clx1234560000abcd123456789", status: "completed" }));
  expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
});
it("handles malformed JSON", async () => { expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400); });
it("returns safe DB errors", async () => { m.create.mockRejectedValue(new Error("private")); expect((await POST(request(body))).status).toBe(500); });
it.each(["sales_rep", "admin"])("keeps task owner AND lead scope on %s updates", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  await PATCH(request({ id: "clx1234560000abcd123456789", status: "completed", userId: "other" }));
  expect(m.update).toHaveBeenCalledWith({ where: { id: "clx1234560000abcd123456789", userId: "rep", lead: role === "admin" ? {} : { OR: [{ setterId: "rep" }, { closerId: "rep" }] } }, data: { status: "completed" } });
});
