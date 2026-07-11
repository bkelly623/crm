import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { buildLeadWhere } from "@/lib/leads/filters";
import { prisma } from "@/lib/prisma";

const createLeadSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  revenue: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  market: z.string().optional(),
  type: z.string().optional(),
  source: z.enum(["native", "csv", "ghl", "manual"]).optional(),
});

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const segment = searchParams.get("segment") ?? "active";
  const q = searchParams.get("q") ?? "";
  const myLeads = searchParams.get("myLeads") === "true";

  const leads = await prisma.lead.findMany({
    where: buildLeadWhere(
      {
        segment: segment as "active" | "won" | "trashed" | "all",
        search: q || undefined,
        myLeadsOnly: myLeads,
      },
      profile.id,
    ),
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createLeadSchema.parse(await request.json());

  const lead = await prisma.lead.create({
    data: {
      businessName: body.businessName,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email || null,
      website: body.website,
      revenue: body.revenue,
      location: body.location,
      industry: body.industry,
      market: body.market,
      type: body.type,
      source: body.source ?? "manual",
      setterId: profile.id,
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
