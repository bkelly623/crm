import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { upsert: mocks.upsert } } }));
import { getCurrentProfile } from "@/lib/auth";

beforeEach(() => { vi.resetAllMocks(); });

it.each(["admin", "sales_manager", "hiring_manager", "closer", "hybrid", "project_manager", "client", "invalid", undefined])("bootstraps safely despite editable role %s", async (role) => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "offline-user", email: "rep@example.invalid", user_metadata: { role, full_name: "Offline Rep" } } } });
  mocks.upsert.mockResolvedValue({ id: "offline-user", role: "sales_rep" });
  await getCurrentProfile();
  expect(mocks.upsert).toHaveBeenCalledWith({ where: { id: "offline-user" }, create: { id: "offline-user", email: "rep@example.invalid", fullName: "Offline Rep", role: "sales_rep" }, update: {} });
});

it("preserves an existing server-assigned profile without migrating roles", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "offline-user", email: "admin@example.invalid", user_metadata: {} } } });
  const existing = { id: "offline-user", role: "admin" };
  mocks.upsert.mockResolvedValue(existing);
  expect(await getCurrentProfile()).toBe(existing);
  expect(mocks.upsert.mock.calls[0][0].update).toEqual({});
});

it("does not bootstrap an unauthenticated request", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  expect(await getCurrentProfile()).toBeNull();
  expect(mocks.upsert).not.toHaveBeenCalled();
});
