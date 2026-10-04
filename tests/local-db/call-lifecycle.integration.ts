import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import RequestClient from "twilio/lib/base/RequestClient";
import twilio from "twilio";
import { POST as voice } from "@/app/api/twilio/voice/route";
import { POST as statusRoute } from "@/app/api/twilio/status/route";
function signed(path: string, fields: Record<string, string>) {
  const url = `https://crm.example.test/api/twilio/${path}`;
  return new Request(url, { method: "POST", body: new URLSearchParams(fields), headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature("synthetic", url, fields) } });
}
import { assertLocalUrl } from "./guard";
vi.mock("server-only", () => ({}));
import { prisma } from "@/lib/prisma";
import { issueCallIntent, bindCallIntent } from "@/lib/twilio/call-intents";
import * as lifecycle from "@/lib/twilio/call-lifecycle";
const db = new PrismaClient({ datasourceUrl: assertLocalUrl(process.env.POSTGRES_PRISMA_URL!) });
const user = randomUUID(), lead = randomUUID();
const accountSid = "AC" + "0".repeat(32), callerIdSid = "PN" + "1".repeat(32);
const parent = "CA" + "a".repeat(32), child = "CA" + "b".repeat(32);
let verified = false, baseline: unknown;
let intentId: string;
async function snapshot() {
  const tables = ["profiles", "leads", "tasks", "calls", "smart_views", "org_settings", "tags", "lead_tags", "lead_lists", "lead_list_memberships", "call_intents", "call_intent_leases"];
  return Promise.all(tables.map(table => db.$queryRaw(Prisma.sql`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${Prisma.raw(`"${table}"`)} t`)));
}
beforeAll(async () => {
  for (const client of [db, prisma]) expect(await client.$queryRaw`SELECT current_database() AS db, inet_server_port() AS port`).toEqual([{ db: "crm_local_staging", port: 5432 }]);
  baseline = await snapshot(); verified = true;
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", "+12025550102");
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  vi.spyOn(RequestClient.prototype, "request").mockResolvedValue({ statusCode: 200, headers: {}, body: { account_sid: accountSid, sid: callerIdSid, phone_number: "+12025550101", capabilities: { voice: true } } });
  await db.profile.create({ data: { id: user, email: `${user}@example.invalid`, role: "sales_rep" } });
  await db.lead.create({ data: { id: lead, businessName: "Lifecycle synthetic fixture", phone: "+12025550102", setterId: user } });
});
afterAll(async () => {
  try {
    if (verified) {
      await db.callIntentLease.deleteMany({ where: { userId: user } });
      await db.callIntent.deleteMany({ where: { userId: user } });
      await db.call.deleteMany({ where: { userId: user } });
      await db.lead.deleteMany({ where: { id: lead } });
      await db.profile.deleteMany({ where: { id: user } });
      expect(await snapshot()).toEqual(baseline);
      console.info("LOCAL_LIFECYCLE_CLEANUP_PASS: all 12 table counts/content digests preserved");
    }
  } finally { await Promise.all([db.$disconnect(), prisma.$disconnect()]); vi.restoreAllMocks(); vi.unstubAllEnvs(); }
});
it("serializes duplicate child events, counts once and releases only after BOTH legs terminal", async () => {
  intentId = (await issueCallIntent(user, { leadId: lead, callerIdSid })).id;
  await bindCallIntent({ intentId, from: `client:${user}`, accountSid, parentCallSid: parent });
  const event = { intentId, accountSid, callSid: child, parentCallSid: parent, status: "completed", duration: "17" };
  await Promise.all([lifecycle.applyCallEvent(event), lifecycle.applyCallEvent(event)]);
  expect(await db.call.count({ where: { userId: user } })).toBe(1);
  expect(await db.call.findUnique({ where: { twilioCallSid: child } })).toMatchObject({ leadId: lead, userId: user, status: "completed", durationSeconds: 17 });
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(1);
  expect(await db.callIntentLease.findUnique({ where: { intentId } })).not.toBeNull();
  await lifecycle.applyCallEvent({ ...event, status: "ringing", duration: undefined });
  expect(await db.call.findUnique({ where: { twilioCallSid: child } })).toMatchObject({ status: "completed", durationSeconds: 17 });
  await Promise.all([1, 2].map(() => lifecycle.applyCallEvent({ accountSid, callSid: parent, status: "completed" })));
  expect(await db.callIntentLease.findUnique({ where: { intentId } })).toBeNull();
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(1);
  expect((await db.callIntent.findUniqueOrThrow({ where: { id: intentId } })).finishedAt).toBeInstanceOf(Date);
});
it("signed voice consumes once, fetches current owned caller and never trusts raw destination or recording", async () => {
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
  const issued = await issueCallIntent(user, { leadId: lead, callerIdSid });
  const fields = { AccountSid: accountSid, CallSid: "CA" + "c".repeat(32), From: `client:${user}`, IntentId: issued.id, To: "+12025550199", CallerID: "+12025550198", Record: "true" };
  const before = vi.mocked(RequestClient.prototype.request).mock.calls.length;
  const response = await voice(signed("voice", fields));
  expect(response.status).toBe(200);
  const xml = await response.text();
  expect(xml).toContain("<Dial");
  expect(xml).toContain('callerId="+12025550101"');
  expect(xml).toContain('record="do-not-record"');
  expect(xml).toContain(">+12025550102</Number>");
  expect(xml).not.toContain(fields.To);
  expect(xml).not.toContain(fields.CallerID);
  expect(xml).toContain(`intentId=${issued.id}`);
  expect(vi.mocked(RequestClient.prototype.request).mock.calls.length).toBe(before + 1);
  expect(await db.callIntent.findUnique({ where: { id: issued.id } })).toMatchObject({ state: "bound", parentCallSid: fields.CallSid });
  expect(await (await voice(signed("voice", fields))).text()).not.toContain("<Dial");
});
it("signed child/action callbacks use only intent/account/parent-child authority; parent terminal is still required", async () => {
  const row = await db.callIntent.findFirstOrThrow({ where: { userId: user, finishedAt: null, state: "bound" } });
  const childSid = "CA" + "d".repeat(32);
  const fields = { AccountSid: accountSid, CallSid: childSid, ParentCallSid: row.parentCallSid!, CallStatus: "in-progress", leadId: "forged", userId: randomUUID() };
  expect((await statusRoute(signed(`status?intentId=${row.id}&event=child`, fields))).status).toBe(200);
  expect(await db.call.findUnique({ where: { twilioCallSid: childSid } })).toMatchObject({ leadId: lead, userId: user, status: "in_progress" });
  const action = { AccountSid: accountSid, CallSid: row.parentCallSid!, DialCallSid: childSid, DialCallStatus: "completed", DialCallDuration: "21" };
  const result = await statusRoute(signed(`status?intentId=${row.id}&event=action`, action));
  expect(await result.text()).toContain("<Hangup/>");
  expect(await db.callIntentLease.findUnique({ where: { intentId: row.id } })).not.toBeNull();
  expect((await statusRoute(signed("status", { AccountSid: accountSid, CallSid: row.parentCallSid!, CallStatus: "completed" }))).status).toBe(200);
  expect(await db.callIntentLease.findUnique({ where: { intentId: row.id } })).toBeNull();
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(2);
});
it("REST reconciliation recovers lost child callbacks with exact resource identity and never POSTs to Twilio", async () => {
  const issued = await issueCallIntent(user, { leadId: lead, callerIdSid });
  const parentSid = "CA" + "e".repeat(32), childSid = "CA" + "f".repeat(32);
  await bindCallIntent({ intentId: issued.id, from: `client:${user}`, accountSid, parentCallSid: parentSid });
  vi.mocked(RequestClient.prototype.request).mockImplementation(async options => {
    expect(options.method).toBe("get");
    expect(options.uri).toContain(`/Accounts/${accountSid}/Calls`);
    const childResource = { sid: childSid, account_sid: accountSid, parent_call_sid: parentSid, status: "completed", duration: "32", to: "+12025550102", from: "+12025550101" };
    const body = options.uri.endsWith(`${parentSid}.json`)
      ? { sid: parentSid, account_sid: accountSid, parent_call_sid: null, status: "completed", from: `client:${user}` }
      : { calls: [childResource], next_page_uri: null };
    return { statusCode: 200, headers: {}, body };
  });
  await lifecycle.reconcileCallIntent(user, issued.id);
  expect(await db.callIntentLease.findUnique({ where: { intentId: issued.id } })).toBeNull();
  expect(await db.call.findUnique({ where: { twilioCallSid: childSid } })).toMatchObject({ status: "completed", durationSeconds: 32, leadId: lead, userId: user });
  expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).dialedCount).toBe(3);
});
it("status readback exposes terminal proof only to its owner, including lost-browser latest recovery", async () => {
  const { readIntentStatus } = await import("@/lib/twilio/intent-status");
  const current = await readIntentStatus(user);
  expect(current).toMatchObject({ state: "terminal", locked: false, canStartNewIntent: true, leadId: lead, recording: "do-not-record" });
  expect(current).not.toHaveProperty("destination");
  expect(await readIntentStatus(randomUUID(), current!.id)).toBeNull();
  expect(await readIntentStatus(user, current!.id)).toEqual(current);
});
it("reconciliation expires only never-bound issued reservations using the PostgreSQL clock", async () => {
  vi.mocked(RequestClient.prototype.request).mockResolvedValue({ statusCode: 200, headers: {}, body: { account_sid: accountSid, sid: callerIdSid, phone_number: "+12025550101", capabilities: { voice: true } } });
  const issued = await issueCallIntent(user, { leadId: lead, callerIdSid });
  await db.callIntent.update({ where: { id: issued.id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  const before = vi.mocked(RequestClient.prototype.request).mock.calls.length;
  await lifecycle.reconcileCallIntent(user, issued.id);
  expect(await db.callIntent.findUnique({ where: { id: issued.id } })).toMatchObject({ state: "expired", parentCallSid: null });
  expect(await db.callIntentLease.findUnique({ where: { intentId: issued.id } })).toBeNull();
  expect(vi.mocked(RequestClient.prototype.request).mock.calls.length).toBe(before);
});
it("queued child events persist as initiated calls without inventing a terminal result", async () => {
  const issued = await issueCallIntent(user, { leadId: lead, callerIdSid });
  const parentSid = "CA" + "1".repeat(32), childSid = "CA" + "2".repeat(32);
  await bindCallIntent({ intentId: issued.id, from: `client:${user}`, accountSid, parentCallSid: parentSid });
  await lifecycle.applyCallEvent({ accountSid, intentId: issued.id, parentCallSid: parentSid, callSid: childSid, status: "queued" });
  expect(await db.call.findUnique({ where: { twilioCallSid: childSid } })).toMatchObject({ status: "initiated", endedAt: null, durationSeconds: null });
  expect(await db.callIntentLease.findUnique({ where: { intentId: issued.id } })).not.toBeNull();
});
