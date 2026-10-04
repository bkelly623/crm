import twilio from "twilio";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";

export async function GET() {
  // Server-only kill switch, not authorization to enable live calling.
  if (process.env.TWILIO_CALLING_ENABLED !== "true") {
    return NextResponse.json({ error: "Outbound calling disabled" }, { status: 503 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!salesLeadScope(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
