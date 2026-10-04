import { beforeEach, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
import { POST as status } from "@/app/api/twilio/status/route";
import { POST as recording } from "@/app/api/twilio/recording/route";
import { POST as voice } from "@/app/api/twilio/voice/route";

const db = vi.hoisted(() => ({
  call: { upsert: vi.fn(), updateMany: vi.fn() },
  lead: { update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const token = "offline-synthetic-webhook-token";
const origin = "https://crm.example.test";
const fields = { CallSid: "CAoffline", CallStatus: "completed", CallDuration: "12", leadId: "synthetic-lead", userId: "synthetic-user", RecordingUrl: "https://recordings.example.test/offline", To: "+15005550006" };
function signed(route: string, options: { signature?: string; signedUrl?: string; url?: string; body?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const path = `/api/twilio/${route}?tag=a%2Fb&tag=c`;
  return new Request(options.url ?? `http://internal.test${path}`, {
    method: "POST",
    headers: { "X-Twilio-Signature": options.signature ?? twilio.getExpectedTwilioSignature(token, options.signedUrl ?? origin + path, fields), ...options.headers },
    body: new URLSearchParams(options.body ?? fields),
  });
}
function noWrites() {
  expect(db.call.upsert).not.toHaveBeenCalled();
  expect(db.call.updateMany).not.toHaveBeenCalled();
  expect(db.lead.update).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_AUTH_TOKEN", token);
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", origin);
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_CALLER_ID", "+15005550006");
});

it.each([undefined, "", " ", " padded "])("fails closed for absent/invalid token %s", async (value) => {
  vi.stubEnv("TWILIO_AUTH_TOKEN", value);
  expect((await status(signed("status"))).status).toBe(503);
  noWrites();
});
it.each([undefined, "", " ", "not-a-url", "http://crm.example.test", "https://user:pass@crm.example.test", "https://crm.example.test/base", "https://crm.example.test?x=1", "https://crm.example.test#x", " https://crm.example.test "])("fails closed for absent/invalid canonical URL %s", async (value) => {
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", value);
  expect((await status(signed("status"))).status).toBe(503);
  noWrites();
});
it.each(["https:crm.example.test", "https://crm.example.test/../", "https://crm.example.test?", "https://crm.example.test#", "https://crm.example.test\\path"])("rejects noncanonical configuration instead of silently repairing %s", async (value) => {
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", value);
  expect((await status(signed("status"))).status).toBe(503);
  noWrites();
});
it("accepts a canonical origin with trailing slash", async () => {
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", origin + "/");
  expect((await status(signed("status"))).status).toBe(422);
});

it.each(["CallSid", "leadId", "To", "Extra"])("rejects duplicate form field %s rather than authenticating last and consuming first", async (key) => {
  const request = signed("status");
  const body = new URLSearchParams({ ...fields, [key]: "last" });
  body.append(key, "last");
  request.headers.set("x-twilio-signature", twilio.getExpectedTwilioSignature(token, origin + "/api/twilio/status?tag=a%2Fb&tag=c", { ...fields, [key]: "last" }));
  const duplicate = new Request(request.url, { method: "POST", headers: request.headers, body });
  expect((await status(duplicate)).status).toBe(400);
  noWrites();
});
it.each(["application/json", "text/plain", "multipart/form-data; boundary=offline", "application/x-www-form-urlencoded-evil"])("rejects non-form content type %s", async (contentType) => {
  const request = signed("status", { headers: { "content-type": contentType } });
  expect((await status(request)).status).toBe(415);
  noWrites();
});
it("rejects an unreadable form without DB access", async () => {
  const request = signed("status");
  await request.text();
  expect((await status(request)).status).toBe(400);
  noWrites();
});
it("accepts UTF-8 form fields including additional provider parameters", async () => {
  expect((await status(signed("status", { headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } }))).status).toBe(422);
});

const routes = [ ["status", status], ["recording", recording], ["voice", voice] ] as const;
for (const [route, handler] of routes) {
  it.each([
    { signature: "" },
    { signature: "bad-signature" },
    { body: { ...fields, To: "+15005550007" } },
    { body: { ...fields, ExtraProviderField: "not-signed" } },
    { signedUrl: origin + `/api/twilio/${route}?tag=changed` },
    { signedUrl: origin + "/api/twilio/wrong?tag=a%2Fb&tag=c" },
    { signedUrl: `https://evil.example/api/twilio/${route}?tag=a%2Fb&tag=c`, headers: { host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https", forwarded: "host=evil.example;proto=https" } },
  ])(`${route} rejects absent/invalid/tampered signatures %j`, async (options) => {
    const response = await handler(signed(route, options));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("<Dial");
    noWrites();
  });
  it(`${route} rejects a missing signature header`, async () => {
    const request = signed(route);
    request.headers.delete("x-twilio-signature");
    expect((await handler(request)).status).toBe(403);
    noWrites();
  });
  it(`${route} rejects tampering with an association field`, async () => {
    const response = await handler(signed(route, { body: { ...fields, leadId: "different-lead", RecordingUrl: "https://evil.example/recording" } }));
    expect(response.status).toBe(403);
    noWrites();
  });
  it(`${route} rejects differently valued duplicate fields`, async () => {
    const request = signed(route);
    const body = new URLSearchParams(fields);
    body.append("leadId", "different-lead");
    expect((await handler(new Request(request.url, { method: "POST", headers: request.headers, body }))).status).toBe(400);
    noWrites();
  });
  it(`${route} validates against canonical URL despite untrusted request authority and forwarded headers`, async () => {
    const response = await handler(signed(route, { headers: { host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "http", forwarded: "host=evil.example;proto=http" } }));
    expect(response.status).toBe(route === "recording" ? 403 : route === "status" ? 422 : 200);
    if (route === "voice") {
      expect(await response.text()).toContain("<Hangup/>");
      noWrites();
    }
  });
  it.each(["TWILIO_AUTH_TOKEN", "TWILIO_WEBHOOK_BASE_URL"])(`${route} denies missing %s`, async (name) => {
    vi.stubEnv(name, undefined);
    const response = await handler(signed(route));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("<Dial");
    noWrites();
  });
}
it("rejects even signed recording attachment without approved consent authority", async () => {
  expect((await recording(signed("recording"))).status).toBe(403);
  noWrites();
});

it("authenticates decoded Unicode, plus signs and every extra provider field", async () => {
  const params = { ...fields, ExtraProviderField: "café + space & =", constructor: "ordinary-field", ["__proto__"]: "literal" };
  const path = "/api/twilio/status?z=%2F&space=a+b&space=a%20b";
  const request = new Request("http://internal.test" + path, {
    method: "POST",
    headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature(token, origin + path, params) },
    body: new URLSearchParams(params),
  });
  expect((await status(request)).status).toBe(422);
  noWrites();
});

it("rejects invalid status signatures before any DB mutation", async () => {
  expect((await status(signed("status", { signature: "invalid" }))).status).toBe(403);
  noWrites();
});
it("a valid signature never authorizes legacy lead/user association writes", async () => {
  expect((await status(signed("status"))).status).toBe(422);
  noWrites();
});
