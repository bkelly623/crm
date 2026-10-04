import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSalesManager, salesLeadScope } from "@/lib/leads/access";
import { leadUpdateSchema } from "@/lib/leads/validation";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = salesLeadScope(profile);
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = await request.json().catch(() => null);
  if (raw && typeof raw === "object" && ("setterId" in raw || "closerId" in raw) && !isSalesManager(profile)) {
    return NextResponse.json({ error: "Only sales managers can reassign ownership" }, { status: 403 });
  }
  const parsed = leadUpdateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead details", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { id } = await params;
  try {
    const accessible = await prisma.lead.findFirst({ where: { ...scope, id } });
    if (!accessible) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Repeat the assignment predicate in the write, not just the prior read.
    const lead = await prisma.lead.update({ where: { ...scope, id }, data: parsed.data });
    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: "Could not save lead. Please retry." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: Context) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = salesLeadScope(profile);
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    const lead = await prisma.lead.findFirst({
      where: { ...scope, id },
      include: { tasks: { where: { status: "open" }, orderBy: { dueAt: "asc" } }, calls: { orderBy: { startedAt: "desc" }, take: 20 } },
    });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: "Could not load lead. Please retry." }, { status: 500 });
  }
}
