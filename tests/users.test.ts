import { beforeEach, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
const mocks = vi.hoisted(() => ({ profile: vi.fn(), admin: vi.fn(), createUser: vi.fn(), upsert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.profile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { upsert: mocks.upsert, update: mocks.update } } }));
import { POST, PATCH } from "@/app/api/users/route";
const roles = Object.values(UserRole);
const userId = "00000000-0000-4000-8000-000000000001";
function request(role: string, method = "POST") {
  return new Request("http://localhost/api/users", { method, body: JSON.stringify({ email: "rep@example.invalid", password: "offline-test-only", role, userId }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockReturnValue({ auth: { admin: { createUser: mocks.createUser } } });
  mocks.createUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.upsert.mockResolvedValue({ id: userId });
  mocks.update.mockResolvedValue({ id: userId });
});
it.each(roles.filter(r => r !== "sales_rep"))("manager cannot invite %s", async role => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "sales_manager" });
  expect((await POST(request(role))).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it.each(roles)("admin can invite valid role %s into the server-owned profile", async role => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "admin" });
  expect((await POST(request(role))).status).toBe(201);
  expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ create: { role }, update: { role } });
});
it("manager can invite sales_rep", async () => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "sales_manager" });
  expect((await POST(request("sales_rep"))).status).toBe(201);
  expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ create: { role: "sales_rep" }, update: { role: "sales_rep" } });
});
it.each([...roles.filter(r => !["admin", "sales_manager"].includes(r)), "unknown", null])("denies invitations by %s", async role => {
  mocks.profile.mockResolvedValue(role ? { id: "actor", role } : null);
  expect((await POST(request("sales_rep"))).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it.each(roles.filter(r => r !== "admin"))("retains admin-only existing-profile role changes: %s", async role => {
  mocks.profile.mockResolvedValue({ id: "actor", role });
  expect((await PATCH(request("sales_rep", "PATCH"))).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(roles)("admin may update another profile to %s", async role => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "admin" });
  expect((await PATCH(request(role, "PATCH"))).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: userId }, data: { role } });
});
it("does not advertise a role assignment in editable auth metadata", async () => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "admin" });
  expect((await POST(request("admin"))).status).toBe(201);
  expect(mocks.createUser.mock.calls[0][0].user_metadata).not.toHaveProperty("role");
});
it.each(["POST", "PATCH"])("rejects invalid role with 400 for %s before writes", async method => {
  mocks.profile.mockResolvedValue({ id: "actor", role: "admin" });
  const handler = method === "POST" ? POST : PATCH;
  expect((await handler(request("not-a-role", method))).status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("retains self-demotion denial", async () => {
  mocks.profile.mockResolvedValue({ id: userId, role: "admin" });
  expect((await PATCH(request("sales_rep", "PATCH"))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
