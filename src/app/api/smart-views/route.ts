import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { SMART_VIEW_LIMIT } from "@/lib/leads/constants";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  filters: z.record(z.unknown()).default({}),
});

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const smartViews = await prisma.smartView.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ smartViews });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.smartView.count({ where: { userId: profile.id } });
  if (count >= SMART_VIEW_LIMIT) {
    return NextResponse.json(
      { error: `SmartView limit reached (max ${SMART_VIEW_LIMIT})` },
      { status: 400 },
    );
  }

  const body = createSchema.parse(await request.json());
  const smartView = await prisma.smartView.create({
    data: {
      userId: profile.id,
      name: body.name,
      filters: body.filters,
    },
  });

  return NextResponse.json({ smartView }, { status: 201 });
}
