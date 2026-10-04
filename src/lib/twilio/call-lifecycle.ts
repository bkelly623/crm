import "server-only";
import { CallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

export class LifecycleRejected extends Error {}
const ranks: Record<string, number> = { queued: 0, initiated: 1, ringing: 2, "in-progress": 3, completed: 4, busy: 4, "no-answer": 4, failed: 4, canceled: 4 };
export const terminalCallStatus = (status: string | null) => status !== null && ranks[status] === 4;
function advance(previous: string | null, incoming: string) {
  return previous !== null && ranks[previous] >= ranks[incoming] ? previous : incoming;
}
export type CallEvent = { accountSid: string; callSid: string; parentCallSid?: string; intentId?: string; status: string; duration?: string };
const sid = /^CA[0-9a-fA-F]{32}$/;
// Only invoke after authenticating a provider callback or validating REST resource
// identity. Browser payloads NEVER enter this function.
export async function applyCallEvent(event: CallEvent) {
  if (!Object.hasOwn(ranks, event.status) || !sid.test(event.callSid) ||
      !/^AC[0-9a-fA-F]{32}$/.test(event.accountSid) || event.accountSid !== process.env.TWILIO_ACCOUNT_SID ||
      (event.parentCallSid !== undefined && (!sid.test(event.parentCallSid) || event.parentCallSid === event.callSid)) ||
      (event.duration !== undefined && (!/^\d{1,6}$/.test(event.duration) || Number(event.duration) > 604800))) throw new LifecycleRejected("Invalid event");
  const original = await prisma.callIntent.findUnique({ where: { parentCallSid: event.parentCallSid ?? event.callSid } });
  if (!original || original.accountSid !== event.accountSid || original.state !== "bound" ||
      (event.intentId !== undefined && original.id !== event.intentId) ||
      (event.parentCallSid && !event.intentId)) throw new LifecycleRejected("Unassociated event");
  return prisma.$transaction(async tx => {
    // Same lock order as issuance/binding. Serializes accounting and terminal
    // release with racing callbacks, reconciliation and new reservations.
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${original.userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${original.leadId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM call_intents WHERE id = ${original.id}::uuid FOR UPDATE`;
    const intent = await tx.callIntent.findUniqueOrThrow({ where: { id: original.id } });
    let parentStatus = intent.parentStatus, childStatus = intent.childStatus;
    if (event.parentCallSid) {
      if (intent.childCallSid && intent.childCallSid !== event.callSid) throw new LifecycleRejected("Conflicting child");
      if (await tx.callIntent.findUnique({ where: { parentCallSid: event.callSid } })) throw new LifecycleRejected("Conflicting leg");
      childStatus = advance(childStatus, event.status);
      const status = (childStatus === "queued" ? "initiated" : childStatus.replaceAll("-", "_")) as CallStatus;
      if (!intent.childCallSid) {
        await tx.call.create({ data: { leadId: intent.leadId, userId: intent.userId, twilioCallSid: event.callSid,
          status, durationSeconds: terminalCallStatus(childStatus) && event.duration !== undefined ? Number(event.duration) : null,
          endedAt: terminalCallStatus(childStatus) ? new Date() : null } });
        await tx.lead.update({ where: { id: intent.leadId }, data: { dialedCount: { increment: 1 } } });
      } else {
        const call = await tx.call.findUniqueOrThrow({ where: { twilioCallSid: intent.childCallSid } });
        await tx.call.update({ where: { id: call.id }, data: {
          status, endedAt: call.endedAt ?? (terminalCallStatus(childStatus) ? new Date() : null),
          durationSeconds: call.durationSeconds ?? (terminalCallStatus(childStatus) && event.status === childStatus && event.duration !== undefined ? Number(event.duration) : null),
        } });
      }
    } else parentStatus = advance(parentStatus, event.status);
    const childCallSid = intent.childCallSid ?? (event.parentCallSid ? event.callSid : null);
    const finishedAt = intent.finishedAt ?? (childCallSid && terminalCallStatus(parentStatus) && terminalCallStatus(childStatus) ? new Date() : null);
    await tx.callIntent.update({ where: { id: intent.id }, data: { parentStatus, childStatus, childCallSid, finishedAt } });
    if (finishedAt) await tx.callIntentLease.deleteMany({ where: { intentId: intent.id } });
    return { id: intent.id };
  });
}

// Authenticated owner-only reconciliation; never provider create/update, retry,
// redirect/pagination following, or speculative no-child terminal inference.
export async function reconcileCallIntent(userId: string, intentId: string) {
  const intent = await prisma.callIntent.findFirst({ where: { id: intentId, userId } });
  if (!intent) throw new LifecycleRejected("Not found");
  if (intent.finishedAt || intent.state === "expired" || intent.state === "canceled") return;
  if (intent.state === "issued") {
    await prisma.$transaction(async tx => {
      // Conditional row lock arbitrates against simultaneous voice consumption;
      // only this transaction's successfully expired row may lose its lease.
      const expired = await tx.$queryRaw<{ id: string }[]>`UPDATE call_intents SET state = 'expired'
        WHERE id = ${intent.id}::uuid AND user_id = ${userId}::uuid AND state = 'issued'
          AND parent_call_sid IS NULL AND expires_at <= clock_timestamp() RETURNING id`;
      if (expired.length) await tx.callIntentLease.deleteMany({ where: { intentId: intent.id } });
    });
    return;
  }
  if (!intent.parentCallSid) throw new LifecycleRejected("Not bound");
  const account = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  if (account !== intent.accountSid || !token || /\s/.test(token)) throw new LifecycleRejected("Unavailable");
  const client = twilio(account, token, { timeout: 10000, autoRetry: false });
  const parent = await client.calls(intent.parentCallSid).fetch();
  if (parent.sid !== intent.parentCallSid || parent.accountSid !== intent.accountSid || parent.parentCallSid ||
      parent.from !== `client:${intent.userId}` || !Object.hasOwn(ranks, parent.status)) throw new LifecycleRejected("Mismatched parent");
  const children = await client.calls.page({ parentCallSid: intent.parentCallSid, pageSize: 2 });
  if (children.nextPageUrl || children.instances.length !== 1) throw new LifecycleRejected("Uncertain children");
  const child = children.instances[0];
  if (!sid.test(child.sid) || child.sid === parent.sid || child.accountSid !== intent.accountSid ||
      child.parentCallSid !== parent.sid || child.to !== intent.destination || child.from !== intent.callerNumber ||
      (intent.childCallSid && child.sid !== intent.childCallSid) || !Object.hasOwn(ranks, child.status)) throw new LifecycleRejected("Mismatched child");
  if ((terminalCallStatus(intent.parentStatus) && intent.parentStatus !== parent.status) ||
      (terminalCallStatus(intent.childStatus) && intent.childStatus !== child.status)) throw new LifecycleRejected("Contradictory provider state");
  await applyCallEvent({ accountSid: intent.accountSid, intentId, parentCallSid: parent.sid, callSid: child.sid,
    status: child.status, duration: child.duration == null ? undefined : child.duration });
  await applyCallEvent({ accountSid: intent.accountSid, intentId, callSid: parent.sid, status: parent.status });
}

