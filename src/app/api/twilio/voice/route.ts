import twilio from "twilio";
import { authenticateTwilioForm } from "@/lib/twilio/webhook";
import { bindCallIntent } from "@/lib/twilio/call-intents";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = new twilio.twiml.VoiceResponse();
  const reply = (status = 200) => new NextResponse(response.toString(), { status, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } });
  if (process.env.TWILIO_CALLING_ENABLED !== "true") { response.hangup(); return reply(); }
  const authenticated = await authenticateTwilioForm(request);
  if (!authenticated.ok) { response.hangup(); return reply(authenticated.status); }
  const field = (name: string) => authenticated.form.get(name)?.toString() ?? "";
  try {
    // Only provider identity plus the opaque intent. To/CallerID/leadId/userId/
    // recording parameters are deliberately ignored, even if signed.
    const bound = await bindCallIntent({ intentId: field("IntentId"), from: field("From"), accountSid: field("AccountSid"), parentCallSid: field("CallSid") });
    const base = new URL(process.env.TWILIO_WEBHOOK_BASE_URL!).origin;
    const callback = `${base}/api/twilio/status?intentId=${bound.id}`;
    response.dial({ callerId: bound.callerNumber, record: "do-not-record", timeout: 30, timeLimit: 120,
      action: `${callback}&event=action`, method: "POST" }).number({
      statusCallback: `${callback}&event=child`, statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    }, bound.destination);
  } catch {
    // A lost response after consumption never permits replay or TTL unlock.
    // Reconciliation must resolve provider state; never auto-redial.
    response.hangup();
  }
  return reply();
}
