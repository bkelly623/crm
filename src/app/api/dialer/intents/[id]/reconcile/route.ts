import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { readIntentStatus } from "@/lib/twilio/intent-status";
import { reconcileCallIntent } from "@/lib/twilio/call-lifecycle";
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  if (!salesLeadScope(profile)) return json({ error: "Forbidden" }, 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return json({ error: "Invalid intent" }, 400);
  try {
    if (!await readIntentStatus(profile.id, id)) return json({ error: "Not found" }, 404);
    await reconcileCallIntent(profile.id, id);
    return json({ intent: await readIntentStatus(profile.id, id) }, 200);
  } catch { return json({ error: "Call state remains uncertain" }, 409); }
}
