import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/auth";
import { Headphones } from "lucide-react";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { CsvUploadButton } from "@/components/leads/csv-upload-button";
import { buildLeadWhere } from "@/lib/leads/filters";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const params = await searchParams;
  const segment = (params.segment ?? "active") as "active" | "won" | "trashed" | "all";
  const q = params.q ?? "";

  const leads = await prisma.lead.findMany({
    where: buildLeadWhere(
      {
        segment: segment as "active" | "won" | "trashed" | "all",
        search: q || undefined,
        myLeadsOnly: false,
      },
      profile.id,
    ),
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const segments = ["active", "won", "trashed", "all"] as const;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pipeline fuel</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted">{leads.length} shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/dialer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Headphones className="h-4 w-4" />
            Start dialing
          </Link>
          <NewLeadButton />
          <CsvUploadButton />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {segments.map((s) => (
          <Link
            key={s}
            href={`/dashboard/leads?segment=${s}`}
            className={`rounded-xl px-3 py-1.5 text-sm capitalize transition ${
              segment === s
                ? "bg-sidebar text-sidebar-fg"
                : "border border-border bg-surface hover:border-primary/30"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <form className="mt-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search business, contact, phone…"
          className="w-full max-w-md rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {leads.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-display text-lg font-medium">No leads in this view</p>
            <p className="mt-2 text-sm text-muted">
              Import a CSV or add a lead to start filling the floor.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                      {lead.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.contactName ?? "—"}</td>
                  <td className="px-4 py-3">{lead.phone ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{lead.sdrStatus.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 capitalize">{lead.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
