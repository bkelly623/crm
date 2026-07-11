import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Phone, Calendar } from "lucide-react";
import { LeadDispositionSelect } from "@/components/leads/lead-disposition-select";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tasks: { where: { status: "open" }, orderBy: { dueAt: "asc" } },
      calls: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  if (!lead) notFound();

  return (
    <div className="p-8">
      <Link href="/dashboard/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{lead.businessName}</h1>
          <div className="mt-2">
            <LeadDispositionSelect leadId={lead.id} currentStatus={lead.sdrStatus} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">
            <Phone className="h-4 w-4" />
            Call
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            <Calendar className="h-4 w-4" />
            Book Appointment
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-border bg-white p-6">
            <h2 className="font-semibold">Lead Information</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <Field label="Business Name" value={lead.businessName} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Contact" value={lead.contactName} />
              <Field label="Email" value={lead.email} />
              <Field label="Website" value={lead.website} />
              <Field label="Revenue" value={lead.revenue} />
              <Field label="Location" value={lead.location} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Source" value={lead.source} />
              <Field label="Dialed" value={String(lead.dialedCount)} />
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-white p-6">
            <h2 className="font-semibold">Open Tasks ({lead.tasks.length})</h2>
            {lead.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No open tasks.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lead.tasks.map((task) => (
                  <li key={task.id} className="rounded-lg border border-border p-3 text-sm">
                    <p>{task.note}</p>
                    <p className="mt-1 text-xs text-muted">
                      Due {task.dueAt.toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="font-semibold">Recent Calls</h2>
          {lead.calls.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No calls yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {lead.calls.map((call) => (
                <li key={call.id} className="flex justify-between border-b border-border py-2 last:border-0">
                  <span className="capitalize">{call.status.replace(/_/g, " ")}</span>
                  <span className="text-muted">{call.startedAt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? "N/A"}</dd>
    </div>
  );
}
