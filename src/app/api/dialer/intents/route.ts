import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { issueCallIntent } from "@/lib/twilio/call-intents";
import { readIntentStatus } from "@/lib/twilio/intent-status";
const input = z.object({
  leadId: z.string().min(1).max(200).refine(v => v === v.trim()),
  callerIdSid: z.string().regex(/^PN[0-9a-fA-F]{32}$/),
}).strict();
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  if (!salesLeadScope(profile)) return json({ error: "Forbidden" }, 403);
  try { return json({ intent: await readIntentStatus(profile.id) }, 200); }
  catch { return json({ error: "Call state unavailable" }, 503); }
}
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  if (!salesLeadScope(profile)) return json({ error: "Forbidden" }, 403);
  if (process.env.TWILIO_CALLING_ENABLED !== "true") return json({ error: "Outbound calling disabled" }, 503);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid intent request" }, 400);
  try {
    const intent = await issueCallIntent(profile.id, parsed.data);
    return json({ intent, callingAvailable: true, recording: "do-not-record" }, 201);
  } catch {
    // Includes conflict, revoked access, allowlist/config/provider/DB failures.
    // Never leak lead existence, provider diagnostics or credentials.
    return json({ error: "Call reservation unavailable" }, 409);
  }
}
