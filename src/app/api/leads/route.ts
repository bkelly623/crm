import { listQuery, scalarQuery } from "@/lib/leads/query";
import { organizerConstraints } from "@/lib/leads/selection";
import { salesLeadScope } from "@/lib/leads/access";
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
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = salesLeadScope(profile);
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = listQuery.safeParse(scalarQuery(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead filters" }, { status: 400 });
  try {
    const { segment, q, myLeads, after } = parsed.data;
    const organizers = await organizerConstraints(profile, parsed.data);
    if (!organizers) return NextResponse.json({ error: "Selection not found" }, { status: 404 });
    const rows = await prisma.lead.findMany({
      where: { AND: [scope, ...organizers, buildLeadWhere({ segment, search: q, myLeadsOnly: myLeads === "true" }, profile.id), ...(after ? [{ id: { gt: after } }] : [])] },
      orderBy: { id: "asc" }, take: 51,
    });
    return NextResponse.json({ leads: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null });
  } catch { return NextResponse.json({ error: "Could not load leads. Please retry." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!salesLeadScope(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
