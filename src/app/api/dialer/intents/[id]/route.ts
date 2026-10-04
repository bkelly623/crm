import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { readIntentStatus } from "@/lib/twilio/intent-status";
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  if (!salesLeadScope(profile)) return json({ error: "Forbidden" }, 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return json({ error: "Invalid intent" }, 400);
  try {
    const intent = await readIntentStatus(profile.id, id);
    return intent ? json({ intent }, 200) : json({ error: "Not found" }, 404);
  } catch { return json({ error: "Call state unavailable" }, 503); }
}
