import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ profile: vi.fn(), lead: vi.fn(), inventory: vi.fn(), query: vi.fn(), create: vi.fn(), lease: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => ({ id: "actor", role: "admin" }) }));
vi.mock("@/lib/twilio/number-inventory", () => ({ ownedVoiceNumber: mocks.inventory }));
vi.mock("@/lib/twilio/intent-status", () => ({ readIntentStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { profile: { findUnique: mocks.profile }, lead: { findFirst: mocks.lead }, $queryRaw: mocks.query, callIntent: { create: mocks.create }, callIntentLease: { findFirst: mocks.lease, deleteMany: vi.fn() } };
  return { prisma: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } };
});
import { POST } from "@/app/api/dialer/intents/route";
const req = () => new Request("https://crm.example.test/api/dialer/intents", { method: "POST", body: JSON.stringify({ leadId: "lead", callerIdSid: "PN" + "1".repeat(32) }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", "+12025550102");
  mocks.profile.mockResolvedValue({ id: "actor", role: "admin" });
  mocks.lead.mockResolvedValue({ id: "lead", phone: "+12025550103" });
  mocks.inventory.mockResolvedValue({ sid: "PN" + "1".repeat(32), accountSid: "AC" + "0".repeat(32), phoneNumber: "+12025550101" });
  mocks.query.mockResolvedValue([]);
});
it("identifies invalid destination without persisting intent or leaking destination", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.lead.mockResolvedValue({ id: "lead", phone: "invalid-private-destination" });
    const response = await POST(req());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Call reservation unavailable" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith("call_reservation_failed", { stage: "destination_format" });
  } finally { warn.mockRestore(); }
});
it("identifies inventory failure without logging raw provider credentials, identifiers or messages", async () => {
  mocks.inventory.mockRejectedValue(new Error("private-provider-token phone lead actor"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect((await POST(req())).status).toBe(409);
    expect(warn).toHaveBeenCalledExactlyOnceWith("call_reservation_failed", { stage: "caller_inventory" });
  } finally { warn.mockRestore(); }
});
