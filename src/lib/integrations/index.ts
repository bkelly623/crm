import { prisma } from "@/lib/prisma";
import type { ContactSyncInput, ContactSyncResult, IntegrationAdapter } from "./types";
import { createGhlAdapter } from "./ghl/adapter";

class NativeAdapter implements IntegrationAdapter {
  readonly provider = "native" as const;

  async syncContact(input: ContactSyncInput): Promise<ContactSyncResult> {
    const lead = await prisma.lead.create({
      data: {
        businessName: input.businessName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        source: "native",
      },
    });
    return { leadId: lead.id, source: "native" };
  }
}

export async function getIntegrationAdapter(): Promise<IntegrationAdapter> {
  const settings = await prisma.orgSettings.findUnique({ where: { id: "default" } });

  if (settings?.ghlEnabled && settings.ghlApiKey && settings.ghlLocationId) {
    return createGhlAdapter(settings.ghlApiKey, settings.ghlLocationId);
  }

  return new NativeAdapter();
}
