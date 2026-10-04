import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salesLeadScope } from "@/lib/leads/access";
import { followUpSchema } from "@/lib/leads/validation";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = salesLeadScope(profile);
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = followUpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a follow-up note and valid due date" }, { status: 400 });
  const body = parsed.data;
  try {
    const lead = await prisma.lead.findFirst({ where: { ...scope, id: body.leadId }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const task = await prisma.task.create({ data: {
      lead: { connect: { ...scope, id: body.leadId } },
      user: { connect: { id: profile.id } }, note: body.note,
      dueAt: new Date(body.dueAt), status: "open",
    } });
    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create follow-up. Please retry." }, { status: 500 });
  }
}
const patchTaskSchema = z.object({ id: z.string().cuid(), status: z.nativeEnum(TaskStatus) });
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
  const scope = salesLeadScope(profile);
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, status } = parsed.data;
  try {
    // Managers do not bypass the existing task-owner rule.
    const task = await prisma.task.updateMany({ where: { id, userId: profile.id, lead: scope }, data: { status } });
    return NextResponse.json({ updated: task.count });
  } catch {
    return NextResponse.json({ error: "Could not update follow-up. Please retry." }, { status: 500 });
  }
}
