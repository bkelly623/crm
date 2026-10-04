import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { salesLeadScope } from "@/lib/leads/access";
import { ownedVoiceNumber } from "./number-inventory";

// Conservative formatting normalization, not a claim of routability/consent.
// Explicit country code required; no inferred country, extensions or vanity IDs.
function destination(phone: string | null) {
  if (!phone || !/^\+[0-9 ()-]+$/.test(phone)) throw new Error("Invalid destination");
  const normalized = phone.replace(/[ ()-]/g, "");
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) throw new Error("Invalid destination");
  return normalized;
}
function allowlist() {
  if (process.env.TWILIO_CALLING_ENABLED !== "true") throw new Error("Disabled");
  const numbers = (process.env.TWILIO_TEST_RECIPIENT_ALLOWLIST ?? "").split(",");
  if (numbers.length > 100 || numbers.some(n => !/^\+[1-9][0-9]{7,14}$/.test(n))) throw new Error("Test allowlist required");
  return numbers;
}
// Signed voice consumer: caller MUST authenticate provider fields first.
// Inventory is fetched immediately before consumption, never from a UI cache.
// Bound leases have no TTL release; unknown provider state must hold the queue.
export async function bindCallIntent(binding: { intentId: string; from: string; accountSid: string; parentCallSid: string }) {
  const permitted = allowlist();
  if (!/^[0-9a-f-]{36}$/.test(binding.intentId) || !/^client:[0-9a-f-]{36}$/.test(binding.from) ||
      !/^CA[0-9a-fA-F]{32}$/.test(binding.parentCallSid) || binding.accountSid !== process.env.TWILIO_ACCOUNT_SID) throw new Error("Invalid binding");
  const userId = binding.from.slice(7);
  const intent = await prisma.callIntent.findUnique({ where: { id: binding.intentId } });
  if (!intent || intent.userId !== userId || intent.state !== "issued" || intent.accountSid !== binding.accountSid || !permitted.includes(intent.destination)) throw new Error("Invalid binding");
  const caller = await ownedVoiceNumber(intent.callerIdSid);
  if (caller.accountSid !== intent.accountSid || caller.phoneNumber !== intent.callerNumber) throw new Error("Caller changed");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${intent.leadId} FOR UPDATE`;
    const profile = await tx.profile.findUnique({ where: { id: userId } });
    const scope = profile && salesLeadScope(profile);
    const lead = scope && await tx.lead.findFirst({ where: { AND: [scope, { id: intent.leadId, segment: "active" }] } });
    if (!lead || destination(lead.phone) !== intent.destination || !allowlist().includes(intent.destination)) throw new Error("Revoked");
    if (await tx.callIntent.findUnique({ where: { childCallSid: binding.parentCallSid } })) throw new Error("Conflicting leg");
    const rows = await tx.$queryRaw<{ id: string }[]>`
      UPDATE call_intents i SET state = 'bound', parent_call_sid = ${binding.parentCallSid}
      WHERE i.id = ${binding.intentId}::uuid AND i.user_id = ${userId}::uuid
        AND i.account_sid = ${binding.accountSid} AND i.state = 'issued'
        AND i.parent_call_sid IS NULL AND i.expires_at > clock_timestamp()
        AND EXISTS (SELECT 1 FROM call_intent_leases l WHERE l.intent_id = i.id)
      RETURNING i.id`;
    if (rows.length !== 1) throw new Error("Unavailable or replayed");
    return { id: rows[0].id, destination: intent.destination, callerNumber: intent.callerNumber };
  });
}

export async function issueCallIntent(userId: string, input: { leadId: string; callerIdSid: string }) {
  const permitted = allowlist();
  // Role and lead are checked again under DB locks after the inventory read.
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  const scope = profile && salesLeadScope(profile);
  if (!scope || !await prisma.lead.findFirst({ where: { AND: [scope, { id: input.leadId, segment: "active" }] } })) throw new Error("Forbidden");
  const caller = await ownedVoiceNumber(input.callerIdSid);
  return prisma.$transaction(async tx => {
    // Fixed lock order: user then lead. No provider networking while holding locks.
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${input.leadId} FOR UPDATE`;
    const current = await tx.profile.findUnique({ where: { id: userId } });
    const currentScope = current && salesLeadScope(current);
    if (!currentScope) throw new Error("Forbidden");
    const lead = await tx.lead.findFirst({ where: { AND: [currentScope, { id: input.leadId, segment: "active" }] } });
    if (!lead) throw new Error("Forbidden");
    const to = destination(lead.phone);
    if (!permitted.includes(to) || !allowlist().includes(to)) throw new Error("Not a test recipient");
    // Only never-bound intents may expire. Conditional UPDATE row locks arbitrate
    // against binding; delete leases for exactly the rows this transaction expired.
    const expired = await tx.$queryRaw<{ id: string }[]>`
      UPDATE call_intents SET state = 'expired'
      WHERE state = 'issued' AND parent_call_sid IS NULL AND expires_at <= clock_timestamp()
        AND (user_id = ${userId}::uuid OR lead_id = ${lead.id}) RETURNING id`;
    if (expired.length) await tx.callIntentLease.deleteMany({ where: { intentId: { in: expired.map(row => row.id) } } });
    if (await tx.callIntentLease.findFirst({ where: { OR: [{ userId }, { leadId: lead.id }] } })) throw new Error("Reserved");
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + 60000);
    await tx.callIntent.create({ data: {
      id, userId, leadId: lead.id, destination: to, accountSid: caller.accountSid,
      callerIdSid: caller.sid, callerNumber: caller.phoneNumber, createdAt: now, expiresAt,
      lease: { create: {} },
    } });
    return { id, expiresAt };
  });
}
