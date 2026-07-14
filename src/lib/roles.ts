/** Role catalog — keep in sync with Prisma UserRole enum */

export const ASSIGNABLE_ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access — users, executive, all sales modules.",
    tier: "admin",
  },
  {
    value: "sales_manager",
    label: "Sales Manager",
    description: "Team oversight, users, executive KPIs, all sales tools.",
    tier: "manager",
  },
  {
    value: "sales_rep",
    label: "Sales Rep",
    description: "Base employee — dialer, leads, tasks, appointments.",
    tier: "rep",
  },
  {
    value: "closer",
    label: "Closer",
    description: "Rep tools plus closing / appointment focus.",
    tier: "rep",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Setter + closer blend — same core sales tools as a rep.",
    tier: "rep",
  },
  {
    value: "hiring_manager",
    label: "Hiring Manager",
    description: "Hiring workflows (expand as hiring modules ship).",
    tier: "manager",
  },
  {
    value: "project_manager",
    label: "Project Manager",
    description: "Delivery / projects (expand in later phases).",
    tier: "other",
  },
  {
    value: "client",
    label: "Client",
    description: "External portal access — limited surface.",
    tier: "other",
  },
] as const;

export function roleLabel(role: string): string {
  return ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? role;
}
