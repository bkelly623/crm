import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { LeadWorkspace } from "@/components/leads/lead-workspace";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const scope = salesLeadScope(profile);
  if (!scope) notFound();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { ...scope, id },
    include: {
      tasks: { where: { status: "open" }, orderBy: { dueAt: "asc" } },
      calls: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!lead) notFound();
  return <div className="min-w-0 p-4 sm:p-6 lg:p-8">
    <Link href="/dashboard/leads" className="inline-flex min-h-11 items-center rounded text-sm text-muted focus-visible:outline-2 focus-visible:outline-primary">← Back to leads</Link>
    <h1 className="my-4 break-words text-2xl font-bold">Lead workspace</h1>
    <div className="grid min-w-0 gap-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <LeadWorkspace key={lead.id} lead={lead} currentUserId={profile.id} initialTasks={lead.tasks.map(task => ({ id: task.id, userId: task.userId, note: task.note, status: task.status, dueAt: task.dueAt.toISOString() }))} />
      </div>
      <aside className="min-w-0 space-y-4">
        <section className="rounded-xl border border-border bg-white p-4 sm:p-6">
          <h2 className="font-semibold">Record context</h2>
          <p className="mt-2 text-sm">Source: {lead.source} · Dialed: {lead.dialedCount}</p>
        </section>
        <section className="rounded-xl border border-border bg-white p-4 sm:p-6">
          <h2 className="font-semibold">Recent calls</h2>
          {lead.calls.length === 0 ? <p className="mt-3 text-sm text-muted">No calls yet.</p> : <ul className="mt-3 space-y-2 text-sm">
            {lead.calls.map(call => <li key={call.id} className="border-b border-border py-2 last:border-0">
              <p className="capitalize">{call.status.replace(/_/g, " ")}</p>
              <time className="text-muted" dateTime={call.startedAt.toISOString()}>{call.startedAt.toISOString()}</time>
            </li>)}
          </ul>}
        </section>
      </aside>
    </div>
  </div>;
}
