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

export const SALES_REP_NAV: NavItem[] = [
  { label: "Sales Training", href: "/dashboard/sales-training", icon: "graduation" },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: "trophy" },
  { label: "Tasks", href: "/dashboard/tasks", icon: "clipboard" },
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Dialer", href: "/dashboard/dialer", icon: "headphones" },
  { label: "My Leads", href: "/dashboard/leads", icon: "phone" },
  { label: "Appointment Tracking", href: "/dashboard/appointments", icon: "calendar" },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: "filter" },
  { label: "Call History", href: "/dashboard/call-history", icon: "clock" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export const ADMIN_EXTRA_NAV: NavItem[] = [
  { label: "Executive", href: "/dashboard/executive", icon: "dashboard", roles: ["admin", "sales_manager"] },
  { label: "Users", href: "/dashboard/users", icon: "users", roles: ["admin", "sales_manager"] },
];

export function getNavForRole(role: string): NavItem[] {
  if (role === "admin" || role === "sales_manager") {
    return [
      ADMIN_EXTRA_NAV[0],
      ...SALES_REP_NAV.slice(0, 3),
      { label: "Users", href: "/dashboard/users", icon: "users" },
      { label: "Leads", href: "/dashboard/leads", icon: "phone" },
      ...SALES_REP_NAV.slice(4),
    ];
  }
  return SALES_REP_NAV;
}
