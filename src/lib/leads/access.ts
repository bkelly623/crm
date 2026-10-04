import type { Prisma } from "@prisma/client";

type Actor = { id: string; role: string };
export function isSalesManager(profile: Actor) {
  return profile.role === "admin" || profile.role === "sales_manager";
}
export function salesLeadScope(profile: Actor): Prisma.LeadWhereInput | null {
  if (isSalesManager(profile)) return {};
  if (["sales_rep", "closer", "hybrid"].includes(profile.role)) {
    return { OR: [{ setterId: profile.id }, { closerId: profile.id }] };
  }
  return null;
}
