import { NextResponse } from "next/server";
import { authenticateTwilioForm } from "@/lib/twilio/webhook";

export async function POST(request: Request) {
  const authenticated = await authenticateTwilioForm(request);
  if (!authenticated.ok) return NextResponse.json({ error: "Webhook rejected" }, { status: authenticated.status });
  // No approved per-call consent authority exists. A signature or recording URL
  // alone is not consent. Never attach, fetch, transcribe or expose this audio.
  return NextResponse.json({ error: "Recording not authorized" }, { status: 403 });
}
