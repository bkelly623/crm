import type { UserRole } from "@prisma/client";
import {
  Calendar,
  ClipboardList,
  Clock,
  Filter,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Phone,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

export const SALES_REP_NAV: NavItem[] = [
  { label: "Sales Training", href: "/dashboard/sales-training", icon: GraduationCap },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { label: "Tasks", href: "/dashboard/tasks", icon: ClipboardList },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Dialer", href: "/dashboard/dialer", icon: Headphones },
  { label: "My Leads", href: "/dashboard/leads", icon: Phone },
  { label: "Appointment Tracking", href: "/dashboard/appointments", icon: Calendar },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Filter },
  { label: "Call History", href: "/dashboard/call-history", icon: Clock },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const ADMIN_EXTRA_NAV: NavItem[] = [
  { label: "Executive", href: "/dashboard/executive", icon: LayoutDashboard, roles: ["admin", "sales_manager"] },
  { label: "Users", href: "/dashboard/users", icon: Users, roles: ["admin", "sales_manager"] },
];

export function getNavForRole(role: UserRole): NavItem[] {
  if (role === "admin" || role === "sales_manager") {
    return [
      ADMIN_EXTRA_NAV[0],
      ...SALES_REP_NAV.slice(0, 3),
      { label: "Users", href: "/dashboard/users", icon: Users },
      { label: "Leads", href: "/dashboard/leads", icon: Phone },
      ...SALES_REP_NAV.slice(4),
    ];
  }
  return SALES_REP_NAV;
}
