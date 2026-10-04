import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import RequestClient from "twilio/lib/base/RequestClient";
import twilio from "twilio";
import { assertLocalUrl } from "./guard";
vi.mock("server-only", () => ({}));
import { prisma } from "@/lib/prisma";
import { issueCallIntent, bindCallIntent } from "@/lib/twilio/call-intents";
import { applyCallEvent, reconcileCallIntent } from "@/lib/twilio/call-lifecycle";
import { readIntentStatus } from "@/lib/twilio/intent-status";
import { POST as voice } from "@/app/api/twilio/voice/route";
const db = new PrismaClient({ datasourceUrl: assertLocalUrl(process.env.POSTGRES_PRISMA_URL!) });
const user = randomUUID(), lead = randomUUID();
const accountSid = "AC" + "0".repeat(32), callerIdSid = "PN" + "1".repeat(32);
const parent = "CA" + "3".repeat(32), child = "CA" + "4".repeat(32);
let id: string, baseline: unknown, verified = false;
const inventory = { statusCode: 200, headers: {}, body: { account_sid: accountSid, sid: callerIdSid, phone_number: "+12025550101", capabilities: { voice: true } } };
async function snapshot() {
  const tables = ["profiles", "leads", "tasks", "calls", "smart_views", "org_settings", "tags", "lead_tags", "lead_lists", "lead_list_memberships", "call_intents", "call_intent_leases"];
  return Promise.all(tables.map(table => db.$queryRaw(Prisma.sql`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${Prisma.raw(`"${table}"`)} t`)));
}
async function clean() {
  await db.callIntentLease.deleteMany({ where: { userId: user } });
  await db.callIntent.deleteMany({ where: { userId: user } });
  await db.call.deleteMany({ where: { userId: user } });
}
beforeAll(async () => {
  for (const client of [db, prisma]) expect(await client.$queryRaw`SELECT current_database() AS db, inet_server_port() AS port`).toEqual([{ db: "crm_local_staging", port: 5432 }]);
  baseline = await snapshot(); verified = true;
  vi.spyOn(RequestClient.prototype, "request");
  await db.profile.create({ data: { id: user, email: `${user}@example.invalid`, role: "sales_rep" } });
  await db.lead.create({ data: { id: lead, businessName: "Lifecycle guard synthetic fixture", phone: "+12025550102", setterId: user } });
});
beforeEach(async () => {
  await clean();
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true"); vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", "+12025550102");
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic"); vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
  vi.mocked(RequestClient.prototype.request).mockReset().mockResolvedValue(inventory);
  await db.lead.update({ where: { id: lead }, data: { dialedCount: 0, sdrStatus: "no_contact" } });
  id = (await issueCallIntent(user, { leadId: lead, callerIdSid })).id;
});
afterAll(async () => {
  try {
    if (verified) {
      await clean(); await db.lead.deleteMany({ where: { id: lead } }); await db.profile.deleteMany({ where: { id: user } });
      expect(await snapshot()).toEqual(baseline);
      console.info("LOCAL_LIFECYCLE_GUARDS_CLEANUP_PASS: all 12 table counts/content digests preserved");
    }
  } finally { await Promise.all([db.$disconnect(), prisma.$disconnect()]); vi.restoreAllMocks(); vi.unstubAllEnvs(); }
});
const bind = () => bindCallIntent({ intentId: id, from: `client:${user}`, accountSid, parentCallSid: parent });
const childEvent = (status = "completed") => ({ intentId: id, accountSid, parentCallSid: parent, callSid: child, status });
function rest(options: { parentStatus?: string; childStatus?: string; children?: number; next?: boolean; bad?: string } = {}) {
  vi.mocked(RequestClient.prototype.request).mockImplementation(async request => {
    expect(request.method).toBe("get");
    expect(request.uri).toMatch(new RegExp(`/Accounts/${accountSid}/Calls(?:/${parent})?\\.json$`));
    const resource: Record<string, unknown> = { sid: child, account_sid: accountSid, parent_call_sid: parent, status: options.childStatus ?? "completed", duration: "11", to: "+12025550102", from: "+12025550101" };
    if (options.bad) resource[options.bad] = "mismatch";
    const body = request.uri.endsWith(`${parent}.json`)
      ? { sid: parent, account_sid: accountSid, from: `client:${user}`, parent_call_sid: null, status: options.parentStatus ?? "completed" }
      : { calls: Array.from({ length: options.children ?? 1 }, () => resource), next_page_uri: options.next ? "/must-never-follow" : null };
    return { statusCode: 200, headers: {}, body };
  });
}
it.each(["busy", "no-answer", "failed", "canceled", "completed"])("parent-first %s terminal callbacks remain locked until child proof, then count exactly once", async status => {
  await bind();
  await applyCallEvent({ accountSid, callSid: parent, status: "completed" });
  expect(await readIntentStatus(user, id)).toMatchObject({ state: "uncertain", locked: true, canStartNewIntent: false });
  await expect(issueCallIntent(user, { leadId: lead, callerIdSid })).rejects.toThrow();
  await Promise.all([1, 2, 3].map(() => applyCallEvent(childEvent(status))));
  expect(await readIntentStatus(user, id)).toMatchObject({ state: "terminal", locked: false, canStartNewIntent: true });
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(1);
  const next = await issueCallIntent(user, { leadId: lead, callerIdSid });
  await applyCallEvent(childEvent(status));
  expect(await db.callIntentLease.findUnique({ where: { intentId: next.id } })).not.toBeNull();
  expect(await readIntentStatus(user, id)).toMatchObject({ canStartNewIntent: false, locked: true });
});
it.each([
  { accountSid: "AC" + "9".repeat(32) }, { parentCallSid: "CA" + "9".repeat(32) }, { intentId: randomUUID() },
  { status: "unknown" }, { status: "in_progress" }, { status: "constructor" }, { duration: "-1" }, { duration: "1.5" }, { duration: "12seconds" }, { duration: "9999999" }, { callSid: parent }, { intentId: undefined },
])("rejects mismatched/invalid callback authority without call or accounting writes %j", async bad => {
  await bind();
  await expect(applyCallEvent({ ...childEvent(), ...bad })).rejects.toThrow();
  expect(await db.call.count({ where: { userId: user } })).toBe(0);
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(0);
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it.each([{ children: 0 }, { children: 2 }, { next: true }, ...["account_sid", "parent_call_sid", "sid", "to", "from", "status"].map(bad => ({ bad }))])("REST ambiguity cannot release a bound intent %j", async options => {
  await bind(); rest(options);
  await expect(reconcileCallIntent(user, id)).rejects.toThrow();
  expect(await db.call.count({ where: { userId: user } })).toBe(0);
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it("concurrent REST reconciliation and callbacks produce one account entry with calling disabled", async () => {
  await bind(); rest(); vi.stubEnv("TWILIO_CALLING_ENABLED", "false");
  await Promise.all([reconcileCallIntent(user, id), applyCallEvent(childEvent()), applyCallEvent({ accountSid, callSid: parent, status: "completed" })]);
  expect(await db.call.count({ where: { userId: user } })).toBe(1);
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(1);
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: false, state: "terminal" });
});
it.each(["timeout", "account", "eligibility", "number", "voice", "disabled"])("fresh voice authority fails closed after issuance: %s", async mode => {
  if (mode === "timeout") vi.mocked(RequestClient.prototype.request).mockRejectedValue(new Error("timeout"));
  if (mode === "account") vi.mocked(RequestClient.prototype.request).mockResolvedValue({ ...inventory, body: { ...inventory.body, account_sid: "AC" + "9".repeat(32) } });
  if (mode === "number") vi.mocked(RequestClient.prototype.request).mockResolvedValue({ ...inventory, body: { ...inventory.body, phone_number: "+12025550199" } });
  if (mode === "voice") vi.mocked(RequestClient.prototype.request).mockResolvedValue({ ...inventory, body: { ...inventory.body, capabilities: { voice: false } } });
  if (mode === "eligibility") await db.lead.update({ where: { id: lead }, data: { sdrStatus: "dnc" } });
  if (mode === "disabled") vi.stubEnv("TWILIO_CALLING_ENABLED", "TRUE");
  const fields = { IntentId: id, AccountSid: accountSid, From: `client:${user}`, CallSid: parent };
  const url = "https://crm.example.test/api/twilio/voice";
  const response = await voice(new Request(url, { method: "POST", body: new URLSearchParams(fields), headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature("synthetic", url, fields) } }));
  expect(await response.text()).not.toContain("<Dial");
  expect(await db.callIntent.findUnique({ where: { id } })).toMatchObject({ state: "issued", parentCallSid: null });
});
it("expired bound lease cannot be released by clock or missing provider child", async () => {
  await bind();
  await db.callIntent.update({ where: { id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  rest({ children: 0 });
  await expect(reconcileCallIntent(user, id)).rejects.toThrow();
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it("reconciliation cannot treat an older terminal child event as proof against current active REST state", async () => {
  await bind(); await applyCallEvent(childEvent()); rest({ childStatus: "in-progress" });
  await expect(reconcileCallIntent(user, id)).rejects.toThrow();
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it("database terminal constraint rejects NULL parent status as missing proof", async () => {
  await bind();
  await expect(db.$transaction(async tx => {
    await tx.$executeRaw`UPDATE call_intents SET child_call_sid=${child}, child_status='completed', finished_at=clock_timestamp() WHERE id=${id}::uuid`;
    throw new Error("CHECK_NOT_ENFORCED"); // force rollback even on RED
  })).rejects.toMatchObject({ code: "P2010" });
});
it.each([{ parentStatus: "in-progress", childStatus: "completed" }, { parentStatus: "completed", childStatus: "in-progress" }, { parentStatus: "in-progress", childStatus: "ringing" }])("REST requires both legs terminal, not browser disconnect: %j", async options => {
  await bind(); rest(options);
  await reconcileCallIntent(user, id);
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it("does not substitute a different child after the first association", async () => {
  await bind(); await applyCallEvent(childEvent("ringing"));
  await expect(applyCallEvent({ ...childEvent(), callSid: "CA" + "5".repeat(32) })).rejects.toThrow();
  expect(await db.call.count({ where: { userId: user } })).toBe(1);
  expect(await db.callIntent.findUnique({ where: { id } })).toMatchObject({ childCallSid: child, childStatus: "ringing", finishedAt: null });
});
it("REST timeout and another owner cannot unlock or query the provider on their behalf", async () => {
  await bind();
  const before = vi.mocked(RequestClient.prototype.request).mock.calls.length;
  await expect(reconcileCallIntent(randomUUID(), id)).rejects.toThrow();
  expect(vi.mocked(RequestClient.prototype.request).mock.calls.length).toBe(before);
  vi.mocked(RequestClient.prototype.request).mockRejectedValue(new Error("timeout"));
  await expect(reconcileCallIntent(user, id)).rejects.toThrow();
  expect(await readIntentStatus(user, id)).toMatchObject({ locked: true, canStartNewIntent: false });
});
it("simultaneous expiry reconciliation and voice binding never revive an expired intent", async () => {
  await db.callIntent.update({ where: { id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  const results = await Promise.allSettled([reconcileCallIntent(user, id), bind()]);
  expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(await readIntentStatus(user, id)).toMatchObject({ state: "expired", locked: false, canStartNewIntent: true });
});
