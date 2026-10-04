import { beforeEach, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/twilio/voice/route";
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn() }));
import { getCurrentProfile } from "@/lib/auth";
import { GET } from "@/app/api/twilio/token/route";
beforeEach(() => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_CALLER_ID", "+12025550101");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
});
it("never enables legacy raw To dialing even with exact flag and valid signature", async () => {
  const fields = { To: "+12025550102", CallerID: "+12025550103", IntentId: "invented", From: "client:invented" };
  const result = await POST(new Request("https://crm.example.test/api/twilio/voice", { method: "POST", body: new URLSearchParams(fields), headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature("synthetic", "https://crm.example.test/api/twilio/voice", fields) } }));
  expect(await result.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
});
it.each(["client", "hiring_manager", "project_manager"])("denies token role %s", async role => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "user", role } as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>);
  expect((await GET()).status).toBe(403);
});
