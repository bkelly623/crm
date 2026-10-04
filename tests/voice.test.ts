import { beforeEach, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/twilio/voice/route";

function request(fields: Record<string, string> = {}) {
  return new Request("http://localhost/api/twilio/voice?TWILIO_CALLING_ENABLED=true", {
    method: "POST",
    headers: { "X-Twilio-Signature": twilio.getExpectedTwilioSignature("offline-synthetic-voice-token", "https://crm.example.test/api/twilio/voice?TWILIO_CALLING_ENABLED=true", { To: process.env.TWILIO_CALLER_ID!, ...fields }) },
    body: new URLSearchParams({ To: "+15005550006", ...fields }),
  });
}

it.each([undefined, ""])("voice denies missing caller ID %s even when enabled", async (callerId) => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_CALLER_ID", callerId);
  expect(await (await POST(request())).text()).toContain("<Hangup/>");
});

it.each<Record<string, string>>([{}, { Record: "true", record: "record-from-answer-dual", recordingEnabled: "true", consent: "true", RecordingStatusCallback: "https://invalid.example" }])("recording stays off despite request %j", async (fields) => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  const response = await POST(request(fields));
  const xml = await response.text();
  expect(xml).toContain("<Hangup/>");
  expect(xml).not.toContain("<Dial");
  expect(xml).not.toMatch(/recordingStatusCallback|<Record|<Start|record-from-answer/);
});

it("does not parse malformed input while disabled", async () => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", undefined);
  const response = await POST(new Request("http://localhost/api/twilio/voice", { method: "POST", body: "not-form-data" }));
  expect(await response.text()).toContain("<Hangup/>");
});

it("does not dial with no destination even when enabled", async () => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  const xml = await (await POST(request({ To: "" }))).text();
  expect(xml).not.toContain("<Dial");
  expect(xml).not.toMatch(/<Record|record-from-answer/);
});

beforeEach(() => {
  vi.stubEnv("TWILIO_AUTH_TOKEN", "offline-synthetic-voice-token");
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
  vi.stubEnv("TWILIO_CALLER_ID", "+15005550006");
});

it.each([undefined, "", "false", "1", "TRUE", " true "])("voice denies flag %s with hangup-only TwiML", async (flag) => {
  vi.stubEnv("TWILIO_CALLING_ENABLED", flag);
  vi.stubEnv("NEXT_PUBLIC_TWILIO_CALLING_ENABLED", "true");
  const response = await POST(request({ TWILIO_CALLING_ENABLED: "true" }));
  expect(response.headers.get("content-type")).toBe("text/xml");
  expect(await response.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
});
