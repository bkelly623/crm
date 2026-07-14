import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { Headphones, Phone, ClipboardList, ArrowRight } from "lucide-react";
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        {roleLabel(profile.role)} desk
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Welcome back, {profile.fullName ?? profile.email.split("@")[0]}
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        Queue leads, run the dialer, and keep follow-ups tight — your outbound floor lives here.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active leads" value={leadCount} />
        <StatCard label="Calls today" value={callCount} />
        <StatCard label="Open tasks" value={openTasks} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/dashboard/dialer"
          icon={Headphones}
          title="Start dialing"
          description="One-at-a-time power dial flow"
        />
        <QuickLink
          href="/dashboard/leads"
          icon={Phone}
          title="Lead board"
          description="Import, search, and disposition"
        />
        <QuickLink
          href="/dashboard/tasks"
          icon={ClipboardList}
          title="Follow-ups"
          description="Callbacks and overdue work"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</p>
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
      className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <Icon className="h-6 w-6 text-primary" />
        <ArrowRight className="h-4 w-4 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <p className="mt-3 font-display font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}
