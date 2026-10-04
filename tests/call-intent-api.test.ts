import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.auth }));
vi.mock("@/lib/twilio/call-intents", () => ({ issueCallIntent: mocks.reserve }));
import { POST } from "@/app/api/dialer/intents/route";
const input = { leadId: "lead-1", callerIdSid: "PN" + "1".repeat(32) };
const req = (body: unknown = input) => new Request("http://localhost/api/dialer/intents", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: "rep", role: "sales_rep" }); vi.stubEnv("TWILIO_CALLING_ENABLED", "true"); });
it("issues a single-use intent for the signed controlled-pilot voice path", async () => {
  mocks.reserve.mockResolvedValue({ id: "issued-id", expiresAt: new Date("2030-01-01Z") });
  const response = await POST(req());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ intent: { id: "issued-id", expiresAt: "2030-01-01T00:00:00.000Z" }, callingAvailable: true, recording: "do-not-record" });
  expect(mocks.reserve).toHaveBeenCalledWith("rep", input);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each([undefined, "false", "TRUE", "1", " true "])("refuses calling flag %s", async flag => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", flag);
  expect((await POST(req())).status).toBe(503); expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each([null, { id: "x", role: "client" }])("denies actor %j", async actor => {
  mocks.auth.mockResolvedValue(actor);
  expect((await POST(req())).status).toBe(actor ? 403 : 401); expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each([{ To: "+12025550101" }, { callerId: "+12025550102" }, { userId: "other" }, { recording: true }, { consent: true }, { callerIdSid: "PNwrong" }, { leadId: " " }])("rejects arbitrary client fields %j", async extra => {
  expect((await POST(req({ ...input, ...extra }))).status).toBe(400); expect(mocks.reserve).not.toHaveBeenCalled();
});
