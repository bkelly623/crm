import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), lead: vi.fn(), inventory: vi.fn(), query: vi.fn(), create: vi.fn(), intent: vi.fn(), lease: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.auth }));
vi.mock("@/lib/twilio/number-inventory", () => ({ ownedVoiceNumber: m.inventory }));
vi.mock("@/lib/twilio/intent-status", () => ({ readIntentStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { profile: { findUnique: m.profile }, lead: { findFirst: m.lead }, $queryRaw: m.query,
    callIntent: { create: m.create, findUnique: m.intent }, callIntentLease: { findFirst: m.lease, deleteMany: vi.fn() } };
  return { prisma: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } };
});
import twilio from "twilio";
import { POST as issue } from "@/app/api/dialer/intents/route";
import { POST as voice } from "@/app/api/twilio/voice/route";
import { bindCallIntent, issueCallIntent } from "@/lib/twilio/call-intents";
const user = "00000000-0000-4000-8000-000000000001";
const leadId = "real-lead-synthetic-fixture";
const accountSid = "AC" + "0".repeat(32), callerIdSid = "PN" + "1".repeat(32);
const phone = "+15005550007", callerNumber = "+15005550006";
const now = new Date("2030-01-01T00:00:00Z");
const intentId = "00000000-0000-4000-8000-000000000002", parent = "CA" + "2".repeat(32);
const binding = { intentId, from: `client:${user}`, accountSid, parentCallSid: parent };
const reserved = { id: intentId, userId: user, leadId, accountSid, callerIdSid, callerNumber, destination: phone, state: "issued" };
function prepareBinding() {
  m.intent.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id === intentId ? reserved : null);
  m.query.mockImplementation(async (sql: TemplateStringsArray) => sql.join("").includes("SET state = 'bound'") ? [{ id: intentId }] : sql.join("").includes("SELECT clock_timestamp()") ? [{ now }] : []);
  vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic-not-a-real-secret");
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
}
function voiceRequest(extra: Record<string, string> = {}, signed = true) {
  const url = "https://crm.example.test/api/twilio/voice";
  const fields = { IntentId: intentId, From: binding.from, AccountSid: accountSid, CallSid: parent, ...extra };
  return new Request(url, { method: "POST", body: new URLSearchParams(fields), headers: { "x-twilio-signature": signed ? twilio.getExpectedTwilioSignature("synthetic-not-a-real-secret", url, fields) : "invalid" } });
}
const request = () => new Request("https://crm.example.test/api/dialer/intents", { method: "POST", body: JSON.stringify({ leadId, callerIdSid }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid);
  m.auth.mockResolvedValue({ id: user, role: "sales_rep" });
  m.profile.mockResolvedValue({ id: user, role: "sales_rep" });
  m.lead.mockResolvedValue({ id: leadId, phone });
  m.inventory.mockResolvedValue({ accountSid, sid: callerIdSid, phoneNumber: callerNumber });
  m.lease.mockResolvedValue(null);
  m.query.mockImplementation(async (sql: TemplateStringsArray) => sql.join("").includes("SELECT clock_timestamp()") ? [{ now }] : []);
});
// Existing protections characterized without any real DB/provider calls.
it.each([undefined, "", "false", "TRUE", "1", " true "])("global flag %s denies direct issuance, binding and signed voice", async flag => {
  prepareBinding();
  vi.stubEnv("TWILIO_CALLING_ENABLED", flag);
  await expect(issueCallIntent(user, { leadId, callerIdSid })).rejects.toThrow("Disabled");
  await expect(bindCallIntent(binding)).rejects.toThrow("Disabled");
  expect((await issue(request())).status).toBe(503);
  expect(await (await voice(voiceRequest())).text()).not.toContain("<Dial");
  expect(m.inventory).not.toHaveBeenCalled();
});
it.each(["issuance", "binding"])("rechecks global switch after inventory during %s", async path => {
  prepareBinding();
  m.inventory.mockImplementationOnce(async () => {
    vi.stubEnv("TWILIO_CALLING_ENABLED", "false");
    return { accountSid, sid: callerIdSid, phoneNumber: callerNumber };
  });
  await expect(path === "issuance" ? issueCallIntent(user, { leadId, callerIdSid }) : bindCallIntent(binding)).rejects.toThrow("Disabled");
  expect(m.create).not.toHaveBeenCalled();
});
it.each(["initial", "transaction"])("revoked %s lead access denies reservation", async phase => {
  if (phase === "initial") m.lead.mockResolvedValue(null);
  else m.lead.mockResolvedValueOnce({ id: leadId, phone }).mockResolvedValueOnce(null);
  expect((await issue(request())).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled();
});
it.each([null, "client", "hiring_manager", "project_manager"])("current DB profile %s cannot issue or bind", async role => {
  prepareBinding();
  m.profile.mockResolvedValue(role ? { id: user, role } : null);
  await expect(issueCallIntent(user, { leadId, callerIdSid })).rejects.toThrow();
  await expect(bindCallIntent(binding)).rejects.toThrow();
  expect(m.create).not.toHaveBeenCalled();
});
it.each(["dnc", "wrong_number", "not_interested", "appointment_booked", "unknown", "won", "trashed", "reassigned"])("scope excludes %s leads at issuance and voice consumption", async state => {
  prepareBinding();
  // Evaluate the production predicate, not an unconditional empty mock.
  m.lead.mockImplementation(async ({ where }) => {
    const [scope, filter] = where.AND;
    const fixture = { id: leadId, phone, segment: ["won", "trashed"].includes(state) ? state : "active", sdrStatus: ["won", "trashed", "reassigned"].includes(state) ? "no_contact" : state, setterId: state === "reassigned" ? "other" : user, closerId: null };
    const assigned = scope.OR.some((part: { setterId?: string; closerId?: string }) => part.setterId === fixture.setterId || part.closerId === fixture.closerId);
    return assigned && fixture.segment === filter.segment && (!filter.sdrStatus || filter.sdrStatus.in.includes(fixture.sdrStatus)) ? fixture : null;
  });
  const outcomes = await Promise.allSettled([issueCallIntent(user, { leadId, callerIdSid }), bindCallIntent(binding)]);
  expect(outcomes.map(result => result.status)).toEqual(["rejected", "rejected"]);
  expect(m.create).not.toHaveBeenCalled();
});
it.each([null, "5550102", "client:other", "+15005550007 ext 2"])("malformed stored phone %s denies issuance", async bad => {
  m.lead.mockResolvedValue({ id: leadId, phone: bad });
  expect((await issue(request())).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled();
});
it("an existing user/lead lease prevents another reservation", async () => {
  m.lease.mockResolvedValue({ intentId });
  expect((await issue(request())).status).toBe(409);
  expect(m.lease).toHaveBeenCalledWith({ where: { OR: [{ userId: user }, { leadId }] } });
  expect(m.create).not.toHaveBeenCalled();
});
it("inventory failure prevents issuance and binding", async () => {
  prepareBinding(); m.inventory.mockRejectedValue(new Error("unavailable"));
  await expect(issueCallIntent(user, { leadId, callerIdSid })).rejects.toThrow();
  await expect(bindCallIntent(binding)).rejects.toThrow();
  expect(m.create).not.toHaveBeenCalled();
});
it.each([{ from: "client:00000000-0000-4000-8000-000000000009" }, { accountSid: "AC" + "9".repeat(32) }, { parentCallSid: "bad" }, { intentId: "bad" }])("binding association %j is rejected", async bad => {
  prepareBinding();
  await expect(bindCallIntent({ ...binding, ...bad })).rejects.toThrow();
  expect(m.inventory).not.toHaveBeenCalled();
});
it("invalid signature cannot consume an otherwise authorized intent", async () => {
  prepareBinding();
  const response = await voice(voiceRequest({}, false));
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("<Dial");
  expect(m.inventory).not.toHaveBeenCalled();
});
it.each(["phone", "caller-number", "caller-account", "replay", "expired-or-leaseless"])("voice revalidation rejects %s", async mode => {
  prepareBinding();
  if (mode === "phone") m.lead.mockResolvedValue({ id: leadId, phone: "+15005550009" });
  if (mode === "caller-number") m.inventory.mockResolvedValue({ accountSid, phoneNumber: "+15005550009" });
  if (mode === "caller-account") m.inventory.mockResolvedValue({ accountSid: "AC" + "9".repeat(32), phoneNumber: callerNumber });
  if (mode === "replay") m.intent.mockResolvedValue({ ...reserved, state: "bound" });
  if (mode === "expired-or-leaseless") m.query.mockResolvedValue([]);
  expect(await (await voice(voiceRequest())).text()).not.toContain("<Dial");
});
it.each([undefined, "", "+15005550008", "not-a-list"])("signed voice consumes an authorized lead independent of legacy recipient config %s", async legacy => {
  prepareBinding();
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", legacy);
  const response = await voice(voiceRequest({ To: "+15005550009", CallerID: "+15005550008", recording: "true" }));
  const xml = await response.text();
  expect(xml).toContain("<Dial");
  expect(xml).toContain(`callerId="${callerNumber}"`);
  expect(xml).toContain(`>${phone}</Number>`);
  expect(xml).toContain('record="do-not-record"');
  expect(xml).toContain(`intentId=${intentId}`);
  expect(xml).not.toContain("+15005550009");
  expect(m.inventory).toHaveBeenCalledExactlyOnceWith(callerIdSid);
});
it.each([undefined, "", "+15005550008", "not-a-list"])("reserves an authorized active lead without depending on legacy recipient config %s", async legacy => {
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", legacy);
  const response = await issue(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ callingAvailable: true, recording: "do-not-record" });
  expect(m.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ userId: user, leadId, destination: phone, accountSid, callerIdSid, callerNumber, createdAt: now, expiresAt: new Date(now.getTime() + 60000), lease: { create: {} } }) });
  expect(m.lead).toHaveBeenCalledTimes(2);
  for (const [arg] of m.lead.mock.calls) expect(arg.where).toEqual({ AND: [{ OR: [{ setterId: user }, { closerId: user }] }, { id: leadId, segment: "active", sdrStatus: { in: ["no_contact", "follow_up_needed", "callback_scheduled"] } }] });
});
