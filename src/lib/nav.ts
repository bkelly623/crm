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

/** Outpost nav labels — intentionally not mirrored 1:1 from the source product */
export const SALES_REP_NAV: NavItem[] = [
  { label: "Playbook", href: "/dashboard/sales-training", icon: "graduation" },
  { label: "Standings", href: "/dashboard/leaderboard", icon: "trophy" },
  { label: "Follow-ups", href: "/dashboard/tasks", icon: "clipboard" },
  { label: "Home", href: "/dashboard", icon: "dashboard" },
  { label: "Floor", href: "/dashboard/dialer", icon: "headphones" },
  { label: "Leads", href: "/dashboard/leads", icon: "phone" },
  { label: "Bookings", href: "/dashboard/appointments", icon: "calendar" },
  { label: "Sequences", href: "/dashboard/pipeline", icon: "filter" },
  { label: "Call log", href: "/dashboard/call-history", icon: "clock" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export const ADMIN_EXTRA_NAV: NavItem[] = [
  { label: "Pulse", href: "/dashboard/executive", icon: "dashboard", roles: ["admin", "sales_manager"] },
  { label: "Team", href: "/dashboard/users", icon: "users", roles: ["admin", "sales_manager"] },
];

export function getNavForRole(role: string): NavItem[] {
  if (role === "admin" || role === "sales_manager") {
    return [
      ADMIN_EXTRA_NAV[0],
      ...SALES_REP_NAV.slice(0, 3),
      { label: "Team", href: "/dashboard/users", icon: "users" },
      { label: "Leads", href: "/dashboard/leads", icon: "phone" },
      ...SALES_REP_NAV.slice(4),
    ];
  }
  return SALES_REP_NAV;
}
