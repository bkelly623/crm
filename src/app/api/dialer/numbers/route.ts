import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { InventoryUnavailable, ownedVoiceNumbers } from "@/lib/twilio/number-inventory";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  if (!salesLeadScope(profile)) return json({ error: "Forbidden" }, 403);
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "page") || params.getAll("page").length > 1 ||
      (params.has("page") && !/^(0|[1-9][0-9]?)$/.test(params.get("page")!))) return json({ error: "Invalid inventory page" }, 400);
  try { return json(await ownedVoiceNumbers(Number(params.get("page") ?? "0"))); }
  catch (e) { return json({ error: "Number inventory unavailable" }, e instanceof InventoryUnavailable ? 503 : 502); }
}
