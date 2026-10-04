import { NextResponse } from "next/server";
import { authenticateTwilioForm } from "@/lib/twilio/webhook";
import { applyCallEvent, LifecycleRejected } from "@/lib/twilio/call-lifecycle";

export async function POST(request: Request) {
  const authenticated = await authenticateTwilioForm(request);
  if (!authenticated.ok) return NextResponse.json({ error: "Webhook rejected" }, { status: authenticated.status });
  const field = (name: string) => authenticated.form.get(name)?.toString() ?? "";
  const query = new URL(request.url).searchParams;
  const kind = query.get("event");
  const intentId = query.get("intentId") ?? undefined;
  const action = kind === "action";
  const reply = (status: number) => action
    ? new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', { status, headers: { "Content-Type": "text/xml" } })
    : NextResponse.json(status === 200 ? { ok: true } : { error: "Webhook rejected" }, { status });
  if (query.getAll("event").length > 1 || query.getAll("intentId").length > 1 ||
      (kind !== null && kind !== "child" && kind !== "action") ||
      (kind && (!intentId || !/^[0-9a-f-]{36}$/.test(intentId)))) return reply(422);
  try {
    await applyCallEvent({
      accountSid: field("AccountSid"), intentId,
      callSid: action ? field("DialCallSid") : field("CallSid"),
      parentCallSid: action ? field("CallSid") : kind === "child" ? field("ParentCallSid") : undefined,
      status: action ? field("DialCallStatus") : field("CallStatus"),
      duration: authenticated.form.has(action ? "DialCallDuration" : "CallDuration") ? field(action ? "DialCallDuration" : "CallDuration") : undefined,
    });
    return reply(200);
  } catch (error) {
    // Continue processing verified terminal callbacks even when calling is off.
    // Persistence failure is retryable; deterministic bad authority isn't.
    return reply(error instanceof LifecycleRejected ? 422 : 503);
  }
}
