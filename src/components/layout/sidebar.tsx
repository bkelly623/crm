"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRole } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

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
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
            CRM
          </div>
          <div>
            <p className="font-semibold leading-tight">CRM</p>
            <p className="text-xs text-muted">{formatRole(userRole)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const showBadge = item.href === "/dashboard/tasks" && taskCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-xs font-medium text-white">
                  {taskCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-muted">{userEmail}</p>
        <button
          onClick={signOut}
          className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
