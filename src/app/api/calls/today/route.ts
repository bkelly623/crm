import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { getCallsToday } from "@/lib/calls/today";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (!salesLeadScope(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    return NextResponse.json(await getCallsToday(profile), { headers });
  } catch {
    return NextResponse.json({ error: "Call count unavailable" }, { status: 503, headers });
  }
}
