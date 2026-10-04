import { salesLeadScope } from "@/lib/leads/access";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentProfile } from "@/lib/auth";
import { getNavForRole } from "@/lib/nav";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const scope = salesLeadScope(profile);
  const taskCount = scope ? await prisma.task.count({
    where: {
      lead: scope,
      userId: profile.id,
      status: "open",
      dueAt: { lt: new Date() },
    },
  }) : 0;

  const nav = getNavForRole(profile.role);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        nav={nav}
        userName={profile.fullName ?? profile.email}
        userEmail={profile.email}
        userRole={profile.role}
        taskCount={taskCount}
      />
      <main className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</main>
    </div>
  );
}
