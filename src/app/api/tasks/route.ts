import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTaskSchema = z.object({
  leadId: z.string(),
  note: z.string().min(1),
  dueAt: z.string().datetime(),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createTaskSchema.parse(await request.json());

  const task = await prisma.task.create({
    data: {
      leadId: body.leadId,
      userId: profile.id,
      note: body.note,
      dueAt: new Date(body.dueAt),
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await request.json();

  const task = await prisma.task.updateMany({
    where: { id, userId: profile.id },
    data: { status },
  });

  return NextResponse.json({ updated: task.count });
}
