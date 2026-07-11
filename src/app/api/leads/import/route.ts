import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { CSV_COLUMNS } from "@/lib/leads/constants";
import { prisma } from "@/lib/prisma";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function mapRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k]) return row[k];
    }
    return undefined;
  };

  return {
    businessName:
      get("business_name", "company", "business", "name") ?? "Unknown",
    contactName: get("contact_name", "contact", "first_name"),
    phone: get("phone", "phone_number", "mobile"),
    email: get("email", "contact_email"),
    website: get("website", "url"),
    revenue: get("revenue", "annual_revenue"),
    location: get("location", "state", "city"),
    industry: get("industry", "sic"),
    market: get("market"),
    type: get("type"),
    source: "csv" as const,
  };
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: "No data rows found",
        hint: `Expected header row with columns like: ${CSV_COLUMNS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.lead.create({
        data: {
          ...mapRow(row),
          setterId: profile.id,
        },
      }),
    ),
  );

  return NextResponse.json({ imported: created.length, leads: created });
}
