"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="flex w-full shrink-0 flex-col bg-sidebar text-sidebar-fg lg:sticky lg:top-0 lg:h-dvh lg:w-[17rem]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
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

      <button
        type="button"
        ref={toggleRef}
        aria-expanded={open}
        aria-controls={navigationId}
        onClick={() => setOpen(!open)}
        className="mx-3 mb-3 min-h-11 rounded-xl border border-white/20 px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
      >
        {open ? "Close navigation" : "Open navigation"}
      </button>
      <div id={navigationId} className={cn("min-h-0 flex-1 flex-col lg:flex", open ? "flex" : "hidden")}>
        <nav aria-label="Primary navigation" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.filter(item => !item.roles || item.roles.includes(userRole)).filter((item, index, visible) => visible.findIndex((entry) => entry.href === item.href) === index).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = ICONS[item.icon];
            const showBadge = item.href === "/dashboard/tasks" && taskCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
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
            className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-3 py-1.5 text-xs text-sidebar-fg/90 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
