import { prisma } from "@/lib/prisma";
import type {
  ContactSyncInput,
  ContactSyncResult,
  IntegrationAdapter,
} from "./types";

/**
 * Go High Level adapter stub.
 * Wire real GHL API calls here when you choose the integration path.
 * @see https://highlevel.stoplight.io/docs/integrations
 */
export class GhlAdapter implements IntegrationAdapter {
  readonly provider = "ghl" as const;

  constructor(
    private readonly apiKey: string,
    private readonly locationId: string,
  ) {}

  async syncContact(input: ContactSyncInput): Promise<ContactSyncResult> {
    // TODO: POST to GHL contacts API when ghl_enabled
    const lead = await prisma.lead.create({
      data: {
        businessName: input.businessName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        source: "ghl",
        externalId: input.externalId,
        externalSource: "ghl",
      },
    });

    return { leadId: lead.id, externalId: input.externalId, source: "ghl" };
  }

  async pushDisposition(leadExternalId: string, disposition: string) {
    void leadExternalId;
    void disposition;
    // TODO: trigger GHL workflow or update custom field
  }

  async pushAppointmentBooked(leadExternalId: string, scheduledAt: Date) {
    void leadExternalId;
    void scheduledAt;
    // TODO: create GHL appointment or calendar event
  }
}

export function createGhlAdapter(apiKey: string, locationId: string) {
  return new GhlAdapter(apiKey, locationId);
}
