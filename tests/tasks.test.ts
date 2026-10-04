import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ profile: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { task: { updateMany: mocks.updateMany } } }));
import { PATCH } from "@/app/api/tasks/route";
const id = "clx1234560000abcd123456789";
function request(body: unknown) { return new Request("http://localhost/api/tasks", { method: "PATCH", body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockResolvedValue({ id: "current-user", role: "sales_rep" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});
it.each([{}, { status: "completed" }, ...[null, "", " ", 1, [], {}, { not: null }, "not-a-cuid"].map(id => ({ id, status: "completed" })), ...[undefined, null, "", "invalid", 1, {}, []].map(status => ({ id, status })), null, []])("rejects invalid update %j before any task write", async body => {
  expect((await PATCH(request(body))).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it("rejects malformed JSON before any task write", async () => {
  expect((await PATCH(new Request("http://localhost/api/tasks", { method: "PATCH", body: "{" }))).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it.each(["open", "completed", "canceled"])("updates only the specific owned task to %s", async status => {
  const response = await PATCH(request({ id, status, userId: "other-user" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ updated: 1 });
  expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id, userId: "current-user", lead: { OR: [{ setterId: "current-user" }, { closerId: "current-user" }] } }, data: { status } });
});
it("keeps zero-match updates scoped without retrying a broader write", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  expect(await (await PATCH(request({ id, status: "completed" }))).json()).toEqual({ updated: 0 });
  expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id, userId: "current-user", lead: { OR: [{ setterId: "current-user" }, { closerId: "current-user" }] } }, data: { status: "completed" } });
});
it("denies unauthenticated updates before parsing", async () => {
  mocks.profile.mockResolvedValue(null);
  expect((await PATCH(request(null))).status).toBe(401);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
