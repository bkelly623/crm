import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRole } from "@/lib/utils";
import { Headphones, Phone, ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [leadCount, callCount, openTasks] = await Promise.all([
    prisma.lead.count({ where: { segment: "active" } }),
    prisma.call.count({
      where: {
        userId: profile.id,
        startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.task.count({ where: { userId: profile.id, status: "open" } }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">
        Welcome back, {profile.fullName ?? profile.email}
      </h1>
      <p className="mt-1 text-muted">
        {formatRole(profile.role)} Dashboard — dialer, leads, appointments, and tasks.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Leads" value={leadCount} />
        <StatCard label="Calls Today" value={callCount} />
        <StatCard label="Open Tasks" value={openTasks} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/dashboard/dialer"
          icon={Headphones}
          title="Start Dialing"
          description="Power dialer with SmartViews"
        />
        <QuickLink
          href="/dashboard/leads"
          icon={Phone}
          title="My Leads"
          description="Search, filter, and manage leads"
        />
        <QuickLink
          href="/dashboard/tasks"
          icon={ClipboardList}
          title="My Tasks"
          description="Follow-ups and callbacks"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
    >
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}
