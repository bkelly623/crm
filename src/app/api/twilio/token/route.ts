import twilio from "twilio";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      {
        error: "Twilio not configured",
        missing: {
          TWILIO_ACCOUNT_SID: !accountSid,
          TWILIO_API_KEY: !apiKey,
          TWILIO_API_SECRET: !apiSecret,
          TWILIO_TWIML_APP_SID: !twimlAppSid,
        },
      },
      { status: 503 },
    );
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity: profile.id,
  });

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    }),
  );

  return NextResponse.json({
    token: token.toJwt(),
    identity: profile.id,
  });
}
