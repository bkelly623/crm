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

  const taskCount = await prisma.task.count({
    where: {
      userId: profile.id,
      status: "open",
      dueAt: { lt: new Date() },
    },
  });

  const nav = getNavForRole(profile.role);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        userName={profile.fullName ?? profile.email}
        userEmail={profile.email}
        userRole={profile.role}
        taskCount={taskCount}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
