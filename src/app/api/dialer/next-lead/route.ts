import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salesLeadScope } from "@/lib/leads/access";
import { organizerConstraints } from "@/lib/leads/selection";
import { buildLeadWhere } from "@/lib/leads/filters";
import { scalarQuery } from "@/lib/leads/query";
import { leadIdentifier, organizerIdentifier } from "@/lib/leads/organizer-validation";
import { REVIEW_SESSION_LIMIT } from "@/lib/leads/review";
const query = z.object({ listId: organizerIdentifier.optional(), tagId: organizerIdentifier.optional(), smartViewId: organizerIdentifier.optional(), exclude: z.array(leadIdentifier).max(REVIEW_SESSION_LIMIT) }).strict();
const savedFilters = z.object({ segment: z.enum(["active", "won", "trashed", "all"]).optional(), sdrStatus: z.string().max(100).optional(), myLeadsOnly: z.boolean().optional(), setterId: leadIdentifier.optional(), search: z.string().max(300).optional() }).strict();
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return error("Unauthorized", 401);
  const scope = salesLeadScope(profile);
  if (!scope) return error("Forbidden", 403);
  const params = new URL(request.url).searchParams;
  const exclude = params.getAll("exclude"); params.delete("exclude");
  const scalars = scalarQuery(params);
  const parsed = query.safeParse(scalars && { ...scalars, exclude });
  if (!parsed.success) return error("Invalid queue filters", 400);
  try {
    const organizers = await organizerConstraints(profile, parsed.data);
    if (!organizers) return error("Selection not found", 404);
    let filters: z.infer<typeof savedFilters> = {};
    if (parsed.data.smartViewId) {
      const view = await prisma.smartView.findFirst({ where: { id: parsed.data.smartViewId, userId: profile.id } });
      if (!view) return error("Selection not found", 404);
      const valid = savedFilters.safeParse(view.filters);
      if (!valid.success) return error("Invalid saved view", 400);
      filters = valid.data;
    }
    // Explicit filters intersect eligibility and authorization, never replace them.
    const { setterId, myLeadsOnly, sdrStatus, ...rest } = filters;
    const lead = await prisma.lead.findFirst({
      where: { AND: [scope, ...organizers, buildLeadWhere(rest, profile.id),
        ...(setterId ? [{ setterId }] : []), ...(myLeadsOnly ? [{ setterId: profile.id }] : []), ...(sdrStatus ? [{ sdrStatus }] : []),
        { segment: "active", sdrStatus: { in: ["no_contact", "follow_up_needed", "callback_scheduled"] }, phone: { not: null } },
        { phone: { not: "" } }, { id: { notIn: [...new Set(exclude)] } },
        // Persisted recipient outcomes survive refresh/new sessions and span
        // lists/reps. Review/detail and callback tasks remain untouched.
        { calls: { none: { status: { in: ["failed", "busy", "no_answer", "canceled"] }, startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
      ] }, orderBy: { id: "asc" },
    });
    return NextResponse.json({ lead });
  } catch { return error("Could not load queue. Please retry.", 500); }
}
