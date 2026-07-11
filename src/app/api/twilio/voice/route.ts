import twilio from "twilio";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const to = formData.get("To")?.toString();

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (!to) {
    response.say("No phone number provided.");
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const dial = response.dial({
    callerId: process.env.TWILIO_CALLER_ID || undefined,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${appUrl}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  });

  dial.number(to);

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
