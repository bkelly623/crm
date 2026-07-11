import type { LeadSegment, Prisma } from "@prisma/client";

export interface SmartViewFilters {
  segment?: LeadSegment | "all";
  sdrStatus?: string;
  myLeadsOnly?: boolean;
  setterId?: string;
  search?: string;
}

export function buildLeadWhere(
  filters: SmartViewFilters,
  userId: string,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  if (filters.segment && filters.segment !== "all") {
    where.segment = filters.segment;
  } else if (!filters.segment) {
    where.segment = "active";
  }

  if (filters.sdrStatus) {
    where.sdrStatus = filters.sdrStatus;
  }

  if (filters.myLeadsOnly) {
    where.setterId = userId;
  }

  if (filters.setterId) {
    where.setterId = filters.setterId;
  }

  if (filters.search) {
    where.OR = [
      { businessName: { contains: filters.search, mode: "insensitive" } },
      { contactName: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

/** Leads eligible for power dialer — skip won and already-booked */
export function buildDialerWhere(
  filters: SmartViewFilters,
  userId: string,
): Prisma.LeadWhereInput {
  const where = buildLeadWhere(
    { ...filters, segment: filters.segment ?? "active" },
    userId,
  );

  where.segment = "active";
  where.sdrStatus = { not: "appointment_booked" };

  return where;
}
