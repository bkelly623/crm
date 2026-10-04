import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSalesManager, salesLeadScope } from "@/lib/leads/access";
import { leadIdentifier, membershipBody, organizerKind } from "@/lib/leads/organizer-validation";
type Context = { params: Promise<{ id: string; kind: string }> };
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
async function change(request: Request, { params }: Context, selected: boolean) {
  const profile = await getCurrentProfile();
  if (!profile) return error("Unauthorized", 401);
  const scope = salesLeadScope(profile);
  if (!scope) return error("Forbidden", 403);
  const raw = await params;
  const id = leadIdentifier.safeParse(raw.id);
  const kind = organizerKind.safeParse(raw.kind);
  const body = membershipBody.safeParse(await request.json().catch(() => null));
  if (!id.success || !kind.success || !body.success) return error("Invalid membership request", 400);
  const { organizerId } = body.data;
  const listScope = isSalesManager(profile) ? {} : { ownerId: profile.id };
  try {
    const lead = await prisma.lead.findFirst({ where: { ...scope, id: id.data }, select: { id: true } });
    if (!lead) return error("Not found", 404);
    const organizer = kind.data === "tags"
      ? await prisma.tag.findFirst({ where: { id: organizerId }, select: { id: true } })
      : await prisma.leadList.findFirst({ where: { ...listScope, id: organizerId }, select: { id: true } });
    if (!organizer) return error("Not found", 404);
    if (!selected) {
      // Top-level deleteMany supports relation predicates; nested deleteMany is scalar-only.
      // Zero deleted links is a successful idempotent removal, not an existence leak.
      if (kind.data === "tags") await prisma.leadTag.deleteMany({ where: { leadId: id.data, tagId: organizerId, lead: scope } });
      else await prisma.leadListMembership.deleteMany({ where: { leadId: id.data, listId: organizerId, lead: scope, list: listScope } });
      return NextResponse.json({ selected: false });
    }
    const tag = { connect: { id: organizerId } };
    const list = { connect: { ...listScope, id: organizerId } };
    const data: Prisma.LeadUpdateInput = kind.data === "tags"
      ? { tags: { upsert: { where: { leadId_tagId: { leadId: id.data, tagId: organizerId } }, create: { tag }, update: { tag } } } }
      : { lists: { upsert: { where: { leadId_listId: { leadId: id.data, listId: organizerId } }, create: { list }, update: { list } } } };
    // Parent write repeats lead assignment. Both upsert branches recheck list ownership.
    // Links never create/copy a master Lead.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await prisma.lead.update({ where: { ...scope, id: id.data }, data, select: { id: true } });
        return NextResponse.json({ selected });
      } catch (e) {
        // Nested upserts can race on the composite PK. Retry the scoped operation once.
        if (selected && attempt === 0 && e && typeof e === "object" && "code" in e && e.code === "P2002") continue;
        throw e;
      }
    }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") return error("Not found", 404);
    return error("Could not change membership. Please retry.", 500);
  }
  return error("Could not change membership. Please retry.", 500);
}
export async function PUT(request: Request, context: Context) { return change(request, context, true); }
export async function DELETE(request: Request, context: Context) { return change(request, context, false); }
