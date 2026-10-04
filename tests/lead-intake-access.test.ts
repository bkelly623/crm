import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { create: m.create }, $transaction: m.transaction } }));
import { POST as create } from "@/app/api/leads/route";
import { POST as upload } from "@/app/api/leads/import/route";
beforeEach(() => { vi.resetAllMocks(); m.create.mockResolvedValue({ id: "created" }); m.transaction.mockImplementation(async rows => Promise.all(rows)); });
for (const [name, handler] of [["create", create], ["import", upload]] as const) {
  function request() {
    if (name === "create") return new Request("http://local/api/leads", { method: "POST", body: JSON.stringify({ businessName: "Synthetic" }) });
    const form = new FormData(); form.set("file", new File(["business_name\nSynthetic"], "test.csv"));
    return new Request("http://local/api/leads/import", { method: "POST", body: form });
  }
  it.each([null, "client", "hiring_manager", "project_manager", "unknown"])(`${name} denies %s before reading input or writing`, async role => {
    m.profile.mockResolvedValue(role ? { id: "actor", role } : null);
    const req = request(); const json = vi.spyOn(req, "json"); const form = vi.spyOn(req, "formData");
    expect((await handler(req)).status).toBe(role ? 403 : 401);
    expect(json).not.toHaveBeenCalled(); expect(form).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each(["admin", "sales_manager", "sales_rep", "closer", "hybrid"])(`${name} permits %s and assigns to actor`, async role => {
    m.profile.mockResolvedValue({ id: "actor", role });
    expect((await handler(request())).status).toBe(name === "create" ? 201 : 200);
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessName: "Synthetic", setterId: "actor" }) });
  });
}
