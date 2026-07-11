import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateLeadSchema = z.object({
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  sdrStatus: z.string().optional(),
  segment: z.enum(["active", "won", "trashed"]).optional(),
  notes: z.string().optional(),
  setterId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = updateLeadSchema.parse(await request.json());

  const lead = await prisma.lead.update({
    where: { id },
    data: body,
  });

  return NextResponse.json({ lead });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tasks: { where: { status: "open" }, orderBy: { dueAt: "asc" } },
      calls: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}
