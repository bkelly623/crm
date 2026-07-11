export type IntegrationProvider = "native" | "ghl";

export interface ContactSyncInput {
  businessName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  externalId?: string;
  source: IntegrationProvider;
}

export interface ContactSyncResult {
  leadId: string;
  externalId?: string;
  source: IntegrationProvider;
}

export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  syncContact(input: ContactSyncInput): Promise<ContactSyncResult>;
  pushDisposition?(leadExternalId: string, disposition: string): Promise<void>;
  pushAppointmentBooked?(leadExternalId: string, scheduledAt: Date): Promise<void>;
}

export interface OrgIntegrationConfig {
  ghlEnabled: boolean;
  ghlLocationId?: string | null;
  useGhlCalendar: boolean;
  useGhlWorkflows: boolean;
}
