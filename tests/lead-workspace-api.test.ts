import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findFirst: m.find, findUnique: m.find, update: m.update } } }));
import { GET, PATCH } from "@/app/api/leads/[id]/route";
it.each(["setterId", "closerId"])("blocks rep reassignment through %s", async field => {
  m.find.mockResolvedValue({ id: "lead-1" });
  expect((await PATCH(req({ [field]: null }), params)).status).toBe(403);
  expect(m.update).not.toHaveBeenCalled();
});
it.each([{ businessName: " " }, { email: "invalid" }, { website: "javascript:alert(1)" }, { phone: "abc" }, { sdrStatus: "invented" }, { notes: "x".repeat(20001) }, {}, { dialedCount: 99 }])("validates edits %j", async body => {
  m.find.mockResolvedValue({ id: "lead-1" });
  expect((await PATCH(req(body), params)).status).toBe(400);
  expect(m.update).not.toHaveBeenCalled();
});
it("saves normalized editable fields and Notes under the write scope", async () => {
  m.find.mockResolvedValue({ id: "lead-1" }); m.update.mockResolvedValue({ id: "lead-1" });
  expect((await PATCH(req({ businessName: " New name ", notes: "My notes", website: "https://example.com", email: "", market: "PA" }), params)).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] }, data: { businessName: "New name", notes: "My notes", website: "https://example.com", email: null, market: "PA" } });
});
it("returns a safe retryable error without exposing DB details", async () => {
  m.find.mockResolvedValue({ id: "lead-1" }); m.update.mockRejectedValue(new Error("private database details"));
  const response = await PATCH(req({ notes: "draft" }), params);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
});
it("handles malformed JSON", async () => {
  m.find.mockResolvedValue({ id: "lead-1" });
  expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), params)).status).toBe(400);
});
it("denies anonymous reads and writes before any DB access", async () => {
  m.profile.mockResolvedValue(null);
  expect((await GET(req({}), params)).status).toBe(401);
  expect((await PATCH(req({ notes: "x" }), params)).status).toBe(401);
  expect(m.find).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it.each(["admin", "sales_manager"])("allows %s to reassign existing ownership fields", async role => {
  m.profile.mockResolvedValue({ id: "boss", role }); m.find.mockResolvedValue({ id: "lead-1" });
  expect((await PATCH(req({ setterId: null, closerId: null }), params)).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { setterId: null, closerId: null } });
});
it("returns a safe read failure", async () => {
  m.find.mockRejectedValue(new Error("private database"));
  const response = await GET(req({}), params);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
});
const params = { params: Promise.resolve({ id: "lead-1" }) };
const req = (body: unknown) => new Request("http://localhost/api/leads/lead-1", { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" }); m.find.mockResolvedValue(null); });
it("does not mutate a lead outside the caller's assignment", async () => {
  expect((await PATCH(req({ notes: "Private draft" }), params)).status).toBe(404);
  expect(m.update).not.toHaveBeenCalled();
});
it.each(["client", "hiring_manager", "project_manager"])("denies %s even when assigned", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  m.find.mockResolvedValue({ id: "lead-1", setterId: "rep" });
  expect((await GET(req({}), params)).status).toBe(403);
  expect((await PATCH(req({ notes: "x" }), params)).status).toBe(403);
  expect(m.find).not.toHaveBeenCalled();
});
it.each(["sales_rep", "closer", "hybrid"])("scopes %s reads to either assignment", async role => {
  m.profile.mockResolvedValue({ id: "rep", role });
  await GET(req({}), params);
  expect(m.find.mock.calls[0][0].where).toEqual({ id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] });
});
it.each(["admin", "sales_manager"])("allows %s to read any lead", async role => {
  m.profile.mockResolvedValue({ id: "boss", role }); m.find.mockResolvedValue({ id: "lead-1" });
  expect((await GET(req({}), params)).status).toBe(200);
  expect(m.find.mock.calls[0][0].where).toEqual({ id: "lead-1" });
});
