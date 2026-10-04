export type NavIconName =
  | "graduation"
  | "trophy"
  | "clipboard"
  | "dashboard"
  | "headphones"
  | "phone"
  | "calendar"
  | "filter"
  | "clock"
  | "settings"
  | "users";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  roles?: string[];
}

const SALES_ROLES = ["admin", "sales_manager", "sales_rep", "closer", "hybrid"];

// Visibility is not authorization: pages and APIs independently enforce scope.
export const SALES_REP_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "dashboard" },
  { label: "Playbook", href: "/dashboard/sales-training", icon: "graduation", roles: SALES_ROLES },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: "trophy", roles: SALES_ROLES },
  { label: "Follow-ups", href: "/dashboard/tasks", icon: "clipboard", roles: SALES_ROLES },
  { label: "Dialer", href: "/dashboard/dialer", icon: "headphones", roles: SALES_ROLES },
  { label: "Leads", href: "/dashboard/leads", icon: "phone", roles: SALES_ROLES },
  { label: "Appointments", href: "/dashboard/appointments", icon: "calendar", roles: SALES_ROLES },
  { label: "Sequences (planned)", href: "/dashboard/pipeline", icon: "filter", roles: SALES_ROLES },
  { label: "Call log", href: "/dashboard/call-history", icon: "clock", roles: SALES_ROLES },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export const ADMIN_EXTRA_NAV: NavItem[] = [
  { label: "Reports", href: "/dashboard/executive", icon: "dashboard", roles: ["admin", "sales_manager"] },
  { label: "Team", href: "/dashboard/users", icon: "users", roles: ["admin", "sales_manager"] },
];

export function getNavForRole(role: string): NavItem[] {
  return [...SALES_REP_NAV, ...ADMIN_EXTRA_NAV].filter(item => !item.roles || item.roles.includes(role));
}
