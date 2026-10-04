import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ profile: vi.fn(), status: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.profile }));
vi.mock("@/lib/twilio/intent-status", () => ({ readIntentStatus: mocks.status }));
vi.mock("@/lib/twilio/call-lifecycle", () => ({ reconcileCallIntent: mocks.reconcile }));
import { GET } from "@/app/api/dialer/intents/[id]/route";
import { POST } from "@/app/api/dialer/intents/[id]/reconcile/route";
import { GET as latest } from "@/app/api/dialer/intents/route";
vi.mock("@/lib/twilio/call-intents", () => ({ issueCallIntent: vi.fn() }));
const id = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };
const req = () => new Request(`https://crm.example.test/api/dialer/intents/${id}`);
beforeEach(() => {
  vi.clearAllMocks(); mocks.profile.mockResolvedValue({ id: "owner", role: "sales_rep" });
  mocks.status.mockResolvedValue({ id, state: "uncertain", locked: true, canStartNewIntent: false });
  mocks.reconcile.mockResolvedValue(undefined);
});
it("GET and reconciliation are authenticated owner scoped and private no-store even with calling disabled", async () => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "false");
  for (const handler of [GET, POST]) {
    const response = await handler(req(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ intent: { id, locked: true, canStartNewIntent: false } });
  }
  expect(mocks.status).toHaveBeenCalledWith("owner", id);
  expect(mocks.reconcile).toHaveBeenCalledExactlyOnceWith("owner", id);
});
it.each([GET, POST])("denies missing profile, unsupported role and malformed ids before service access", async handler => {
  mocks.profile.mockResolvedValue(null);
  expect((await handler(req(), context)).status).toBe(401);
  mocks.profile.mockResolvedValue({ id: "owner", role: "client" });
  expect((await handler(req(), context)).status).toBe(403);
  mocks.profile.mockResolvedValue({ id: "owner", role: "admin" });
  expect((await handler(req(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.reconcile).not.toHaveBeenCalled();
});
it.each([GET, POST])("returns indistinguishable 404 for another owner's or missing intent", async handler => {
  mocks.status.mockResolvedValue(null);
  expect((await handler(req(), context)).status).toBe(404);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("latest recovery is owner scoped and handles no previous intent", async () => {
  expect((await latest()).status).toBe(200);
  expect(mocks.status).toHaveBeenCalledWith("owner");
  mocks.status.mockResolvedValue(null);
  expect(await (await latest()).json()).toEqual({ intent: null });
  mocks.profile.mockResolvedValue(null);
  expect((await latest()).status).toBe(401);
});
it("provider failure never returns unlocked success or provider diagnostics", async () => {
  mocks.reconcile.mockRejectedValue(new Error("secret provider details"));
  const response = await POST(req(), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "Call state remains uncertain" });
});
