import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/twilio/webhook", () => ({ authenticateTwilioForm: vi.fn(async () => ({ ok: true, form: new URLSearchParams() })) }));
vi.mock("@/lib/twilio/call-intents", () => ({ bindCallIntent: vi.fn(async () => ({ id: "synthetic-intent", callerNumber: "+15005550006", destination: "+15005550007" })) }));
import { POST } from "@/app/api/twilio/voice/route";
it("bounds every authorized pilot Dial to 120 seconds, 30-second ringing and no recording", async () => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
  const response = await POST(new Request("https://crm.example.test/api/twilio/voice", { method: "POST" }));
  const xml = await response.text();
  expect(xml).toContain('timeLimit="120"');
  expect(xml).toContain('timeout="30"');
  expect(xml).toContain('record="do-not-record"');
  expect(xml).toContain("<Number");
});
