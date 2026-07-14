"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import type { NavIconName, NavItem } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  graduation: GraduationCap,
  trophy: Trophy,
  clipboard: ClipboardList,
  dashboard: LayoutDashboard,
  headphones: Headphones,
  phone: Phone,
  calendar: Calendar,
  filter: Filter,
  clock: Clock,
  settings: Settings,
  users: Users,
};

interface SidebarProps {
  nav: NavItem[];
  userName: string;
  userEmail: string;
  userRole: string;
  taskCount?: number;
}

export function Sidebar({
  nav,
  userName,
  userEmail,
  userRole,
  taskCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-[17rem] shrink-0 flex-col bg-sidebar text-sidebar-fg">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
            OP
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight">Outpost</p>
            <p className="text-xs text-sidebar-muted">{roleLabel(userRole)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = ICONS[item.icon];
          const showBadge = item.href === "/dashboard/tasks" && taskCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-fg/85 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                    active ? "bg-white/20" : "bg-accent text-white",
                  )}
                >
                  {taskCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-sidebar-muted">{userEmail}</p>
        <button
          onClick={signOut}
          className="mt-3 w-full rounded-xl border border-white/15 px-3 py-1.5 text-xs text-sidebar-fg/90 transition hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
