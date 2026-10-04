import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import twilio from "twilio";
import { getCurrentProfile } from "@/lib/auth";
import { POST as issueRoute } from "@/app/api/dialer/intents/route";
import { POST as voice } from "@/app/api/twilio/voice/route";
import RequestClient from "twilio/lib/base/RequestClient";
import { assertLocalUrl } from "./guard";
vi.mock("server-only", () => ({}));
import { prisma } from "@/lib/prisma";
import * as intents from "@/lib/twilio/call-intents";
const db = new PrismaClient({ datasourceUrl: assertLocalUrl(process.env.POSTGRES_PRISMA_URL!) });
const users = [randomUUID(), randomUUID()];
const leads = [randomUUID(), randomUUID()];
const accountSid = "AC" + "0".repeat(32), callerIdSid = "PN" + "1".repeat(32);
let verified = false;
let baseline: unknown;
async function snapshot() {
  const tables = ["profiles", "leads", "tasks", "calls", "smart_views", "org_settings", "tags", "lead_tags", "lead_lists", "lead_list_memberships", "call_intents", "call_intent_leases"];
  return Promise.all(tables.map(table => db.$queryRaw(Prisma.sql`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${Prisma.raw(`"${table}"`)} t`)));
}
beforeAll(async () => {
  for (const client of [db, prisma]) expect(await client.$queryRaw`SELECT current_database() AS db, inet_server_port() AS port`).toEqual([{ db: "crm_local_staging", port: 5432 }]);
  baseline = await snapshot();
  verified = true;
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", "+12025550102");
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  vi.spyOn(RequestClient.prototype, "request").mockResolvedValue({ statusCode: 200, headers: {}, body: { account_sid: accountSid, sid: callerIdSid, phone_number: "+12025550101", capabilities: { voice: true } } });
  for (const id of users) await db.profile.create({ data: { id, email: `${id}@example.invalid`, role: "sales_manager" } });
  for (const id of leads) await db.lead.create({ data: { id, businessName: "Intent synthetic fixture", phone: "+1 (202) 555-0102", setterId: users[0] } });
});
afterAll(async () => {
  try {
    if (verified) {
      await db.callIntentLease.deleteMany({ where: { userId: { in: users } } });
      await db.callIntent.deleteMany({ where: { userId: { in: users } } });
      await db.lead.deleteMany({ where: { id: { in: leads } } });
      await db.profile.deleteMany({ where: { id: { in: users } } });
      expect(await db.callIntent.count({ where: { userId: { in: users } } })).toBe(0);
      expect(await snapshot()).toEqual(baseline);
      console.info("LOCAL_INTENTS_CLEANUP_PASS: all 12 table counts/content digests equal pre-run baseline");
    }
  } finally { await Promise.all([db.$disconnect(), prisma.$disconnect()]); vi.restoreAllMocks(); vi.unstubAllEnvs(); }
});
it("persists authoritative normalized destination and revalidated caller binding with exclusive lease", async () => {
  const result = await intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid });
  expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  const row = await db.callIntent.findUniqueOrThrow({ where: { id: result.id }, include: { lease: true } });
  expect(row).toMatchObject({ userId: users[0], leadId: leads[0], destination: "+12025550102", callerIdSid, callerNumber: "+12025550101", accountSid, state: "issued", parentCallSid: null, lease: { userId: users[0], leadId: leads[0] } });
  expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(60000);
});
it("binds a single-use intent to client identity/account/parent SID and rejects replay", async () => {
  const row = await db.callIntent.findFirstOrThrow({ where: { userId: users[0], state: "issued" } });
  const binding = { intentId: row.id, from: `client:${users[0]}`, accountSid, parentCallSid: "CA" + "2".repeat(32) };
  await expect(intents.bindCallIntent({ ...binding, from: `client:${users[1]}` })).rejects.toThrow();
  await expect(intents.bindCallIntent({ ...binding, accountSid: "AC" + "3".repeat(32) })).rejects.toThrow();
  const races = await Promise.allSettled([intents.bindCallIntent(binding), intents.bindCallIntent(binding)]);
  expect(races.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.callIntent.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ state: "bound", parentCallSid: binding.parentCallSid });
  await expect(intents.bindCallIntent(binding)).rejects.toThrow();
});
it("expires only unbound reservations, freeing both unique slots without reviving old intents", async () => {
  const result = await intents.issueCallIntent(users[1], { leadId: leads[1], callerIdSid });
  await db.callIntent.update({ where: { id: result.id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  await expect(intents.bindCallIntent({ intentId: result.id, from: `client:${users[1]}`, accountSid, parentCallSid: "CA" + "4".repeat(32) })).rejects.toThrow();
  const fresh = await intents.issueCallIntent(users[1], { leadId: leads[1], callerIdSid });
  expect(fresh.id).not.toBe(result.id);
  expect(await db.callIntent.findUniqueOrThrow({ where: { id: result.id } })).toMatchObject({ state: "expired" });
  expect(await db.callIntentLease.findUnique({ where: { intentId: result.id } })).toBeNull();
});
it("never TTL-releases a bound call, including after nominal intent expiry", async () => {
  const bound = await db.callIntent.findFirstOrThrow({ where: { userId: users[0], state: "bound" } });
  await db.callIntent.update({ where: { id: bound.id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow();
  expect(await db.callIntentLease.findUnique({ where: { intentId: bound.id } })).not.toBeNull();
  expect((await db.callIntent.findUniqueOrThrow({ where: { id: bound.id } })).state).toBe("bound");
});

// Characterization of guards/constraints introduced with the tracer slices above.
async function resetReservations() {
  await db.callIntentLease.deleteMany({ where: { userId: { in: users } } });
  await db.callIntent.deleteMany({ where: { userId: { in: users } } });
}
it.each(["same-user", "same-lead", "same-both"])("real PostgreSQL race has exactly one winner: %s", async mode => {
  await resetReservations();
  const a = { user: users[0], lead: leads[0] };
  const b = { user: mode === "same-lead" ? users[1] : users[0], lead: mode === "same-user" ? leads[1] : leads[0] };
  const outcomes = await Promise.allSettled([a, b].map(x => intents.issueCallIntent(x.user, { leadId: x.lead, callerIdSid })));
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.callIntent.count({ where: { userId: { in: users } } })).toBe(1);
  expect(await db.callIntentLease.count({ where: { userId: { in: users } } })).toBe(1);
});
it.each([undefined, "", "+12025550103", "*", " +12025550102", "+12025550102,"])("legacy missing/nonmatching/malformed allowlist does not restrict authorized leads %s", async value => {
  await resetReservations();
  vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", value);
  try { await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).resolves.toMatchObject({ id: expect.any(String) }); }
  finally { vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", "+12025550102"); }
  expect(await db.callIntent.count({ where: { userId: { in: users } } })).toBe(1);
});
it.each([null, "2025550102", "+12025550102 ext 9", "client:other", "+02025550102", "+1202"])("denies ambiguous or malformed stored destination %s", async phone => {
  await resetReservations();
  await db.lead.update({ where: { id: leads[0] }, data: { phone } });
  try { await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow(); }
  finally { await db.lead.update({ where: { id: leads[0] }, data: { phone: "+12025550102" } }); }
});
it("rechecks DB role/assignment/active segment rather than trusting the authenticated profile snapshot", async () => {
  await resetReservations();
  await db.profile.update({ where: { id: users[0] }, data: { role: "sales_rep" } });
  await db.lead.update({ where: { id: leads[0] }, data: { setterId: users[1] } });
  await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow();
  await db.lead.update({ where: { id: leads[0] }, data: { setterId: users[0], segment: "won" } });
  await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow();
  await db.lead.update({ where: { id: leads[0] }, data: { segment: "active" } });
  await db.profile.update({ where: { id: users[0] }, data: { role: "client" } });
  await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow();
  await db.profile.update({ where: { id: users[0] }, data: { role: "sales_manager" } });
});
it("refuses issuance after role revocation during the inventory fetch", async () => {
  await resetReservations();
  vi.mocked(RequestClient.prototype.request).mockImplementationOnce(async () => {
    await db.profile.update({ where: { id: users[0] }, data: { role: "client" } });
    return { statusCode: 200, headers: {}, body: { account_sid: accountSid, sid: callerIdSid, phone_number: "+12025550101", capabilities: { voice: true } } };
  });
  try { await expect(intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid })).rejects.toThrow(); }
  finally { await db.profile.update({ where: { id: users[0] }, data: { role: "sales_manager" } }); }
});
it("rejects binding when a lead is reassigned or destination changes after issuance", async () => {
  await resetReservations();
  await db.profile.update({ where: { id: users[0] }, data: { role: "sales_rep" } });
  const issued = await intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid });
  const binding = { intentId: issued.id, from: `client:${users[0]}`, accountSid, parentCallSid: "CA" + "5".repeat(32) };
  await db.lead.update({ where: { id: leads[0] }, data: { setterId: users[1] } });
  await expect(intents.bindCallIntent(binding)).rejects.toThrow();
  await db.lead.update({ where: { id: leads[0] }, data: { setterId: users[0], phone: "+12025550103" } });
  await expect(intents.bindCallIntent(binding)).rejects.toThrow();
  await db.lead.update({ where: { id: leads[0] }, data: { phone: "+12025550102" } });
  await db.profile.update({ where: { id: users[0] }, data: { role: "sales_manager" } });
});
it("actual API persists an intent and signed voice consumes it for the stored destination only", async () => {
  await resetReservations();
  vi.mocked(getCurrentProfile).mockResolvedValue(await db.profile.findUniqueOrThrow({ where: { id: users[0] } }));
  const req = () => new Request("http://localhost/api/dialer/intents", { method: "POST", body: JSON.stringify({ leadId: leads[0], callerIdSid }) });
  const response = await issueRoute(req());
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body).toMatchObject({ callingAvailable: true, recording: "do-not-record" });
  expect((await issueRoute(req())).status).toBe(409);
  vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://crm.example.test");
  vi.stubEnv("TWILIO_CALLER_ID", "+12025550101");
  const fields = { IntentId: body.intent.id, From: `client:${users[0]}`, AccountSid: accountSid, CallSid: "CA" + "6".repeat(32), To: "+12025550199" };
  const url = "https://crm.example.test/api/twilio/voice";
  const result = await voice(new Request(url, { method: "POST", body: new URLSearchParams(fields), headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature("synthetic", url, fields) } }));
  const xml = await result.text();
  expect(xml).toContain("<Dial");
  expect(xml).toContain('record="do-not-record"');
  expect(xml).not.toContain(fields.To);
  expect(await db.callIntent.findUniqueOrThrow({ where: { id: body.intent.id } })).toMatchObject({ state: "bound", parentCallSid: fields.CallSid });
});
it("expiry/rebinding race cannot revive an expired intent", async () => {
  await resetReservations();
  const issued = await intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid });
  await db.callIntent.update({ where: { id: issued.id }, data: { createdAt: new Date("2020-01-01Z"), expiresAt: new Date("2020-01-02Z") } });
  const outcomes = await Promise.allSettled([
    intents.bindCallIntent({ intentId: issued.id, from: `client:${users[0]}`, accountSid, parentCallSid: "CA" + "7".repeat(32) }),
    intents.issueCallIntent(users[0], { leadId: leads[0], callerIdSid }),
  ]);
  expect(outcomes.map(x => x.status)).toEqual(["rejected", "fulfilled"]);
  expect(await db.callIntent.findUniqueOrThrow({ where: { id: issued.id } })).toMatchObject({ state: "expired", parentCallSid: null });
});
it("new tables are RLS enabled and retain original core native timestamp type", async () => {
  expect(await db.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename IN ('call_intents','call_intent_leases') AND rowsecurity`).toEqual([{ count: 2 }]);
  expect(await db.$queryRaw`SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='created_at'`).toEqual([{ udt_name: "timestamptz" }]);
});

