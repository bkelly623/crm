import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { buildDialerWhere } from "@/lib/leads/filters";
import type { SmartViewFilters } from "@/lib/leads/filters";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const smartViewId = searchParams.get("smartViewId");

  let filters: SmartViewFilters = { segment: "active" };

  if (smartViewId) {
    const sv = await prisma.smartView.findFirst({
      where: { id: smartViewId, userId: profile.id },
    });
    if (sv) {
      filters = sv.filters as SmartViewFilters;
    }
  }

  const lead = await prisma.lead.findFirst({
    where: buildDialerWhere(filters, profile.id),
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json({ lead });
}
