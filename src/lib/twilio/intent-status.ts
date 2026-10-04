import "server-only";
import { prisma } from "@/lib/prisma";
import { terminalCallStatus } from "./call-lifecycle";

export async function readIntentStatus(userId: string, id?: string) {
  // Status ownership is intentionally stricter than manager lead scope. The
  // owner's in-flight call remains visible after reassignment, without PII.
  const active = await prisma.callIntentLease.findUnique({ where: { userId } });
  const intent = await prisma.callIntent.findFirst({ where: { userId, ...(id || active ? { id: id ?? active!.intentId } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  if (!intent) return null;
  const terminal = Boolean(intent.finishedAt && terminalCallStatus(intent.parentStatus) && terminalCallStatus(intent.childStatus) && intent.childCallSid);
  const state = terminal ? "terminal" : intent.state !== "bound" ? intent.state :
    terminalCallStatus(intent.parentStatus) || terminalCallStatus(intent.childStatus) ? "uncertain" :
    intent.childStatus === "in-progress" ? "connected" : intent.childStatus === "ringing" ? "ringing" :
    intent.childStatus ? "dialing" : "uncertain";
  const locked = Boolean(active);
  return { id: intent.id, leadId: intent.leadId, state, expiresAt: intent.expiresAt,
    parentStatus: intent.parentStatus, childStatus: intent.childStatus, finishedAt: intent.finishedAt,
    locked, canStartNewIntent: !locked && (terminal || intent.state === "expired" || intent.state === "canceled"),
    recording: "do-not-record" as const };
}
