import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIntegrationAdapter } from "@/lib/integrations";

/**
 * GHL inbound webhook stub.
 * Configure in GHL: POST https://your-app.vercel.app/api/webhooks/ghl
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-ghl-webhook-secret");
  if (process.env.GHL_WEBHOOK_SECRET && secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const adapter = await getIntegrationAdapter();

  const result = await adapter.syncContact({
    businessName: payload.companyName ?? payload.businessName ?? "Unknown",
    contactName: payload.contactName ?? payload.firstName,
    phone: payload.phone,
    email: payload.email,
    externalId: payload.contactId ?? payload.id,
    source: "ghl",
  });

  return NextResponse.json({ ok: true, ...result });
}

// Health check
export async function GET() {
  const settings = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    status: "ok",
    ghlEnabled: settings?.ghlEnabled ?? false,
  });
}
