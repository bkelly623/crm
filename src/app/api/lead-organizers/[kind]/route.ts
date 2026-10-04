import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSalesManager, salesLeadScope } from "@/lib/leads/access";
import { catalogQuery, organizerKind, organizerName } from "@/lib/leads/organizer-validation";
type Context = { params: Promise<{ kind: string }> };
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export async function GET(request: Request, { params }: Context) {
  const profile = await getCurrentProfile();
  if (!profile) return error("Unauthorized", 401);
  const scope = salesLeadScope(profile);
  if (!scope) return error("Forbidden", 403);
  const kind = organizerKind.safeParse((await params).kind);
  const query = catalogQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!kind.success || !query.success) return error("Invalid catalog request", 400);
  const { leadId, after } = query.data;
  try {
    if (leadId && !await prisma.lead.findFirst({ where: { ...scope, id: leadId }, select: { id: true } })) return error("Not found", 404);
    const select = { id: true, name: true, ...(leadId ? { leads: { where: { leadId, lead: scope }, select: { leadId: true } } } : {}) } as const;
    const page = { take: 51, orderBy: { id: "asc" as const }, select };
    const cursor = after ? { id: { gt: after } } : {};
    const rows = kind.data === "tags"
      ? await prisma.tag.findMany({ ...page, where: cursor })
      : await prisma.leadList.findMany({ ...page, where: { ...cursor, ...(!isSalesManager(profile) ? { ownerId: profile.id } : {}) } });
    return NextResponse.json({ items: rows.slice(0, 50).map(row => ({ id: row.id, name: row.name, selected: !!row.leads?.length })), nextCursor: rows.length > 50 ? rows[49].id : null });
  } catch { return error("Could not load tags or lists. Please retry.", 500); }
}
export async function POST(request: Request, { params }: Context) {
  const profile = await getCurrentProfile();
  if (!profile) return error("Unauthorized", 401);
  if (!salesLeadScope(profile)) return error("Forbidden", 403);
  const kind = organizerKind.safeParse((await params).kind);
  if (!kind.success) return error("Invalid organizer kind", 400);
  const parsed = organizerName(kind.data).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Enter a valid name (tag: 60 characters; list: 80).", 400);
  const data = { name: parsed.data.name, nameKey: parsed.data.name.toLowerCase() };
  const select = { id: true, name: true };
  try {
    const item = kind.data === "tags"
      ? await prisma.tag.create({ data, select })
      : await prisma.leadList.create({ data: { ...data, owner: { connect: { id: profile.id } } }, select });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return error("That name already exists. Choose the existing entry or another name.", 409);
    return error("Could not create tag or list. Please retry.", 500);
  }
}
