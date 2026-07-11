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
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <p className="text-sm text-muted">{leads.length} leads shown</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/dialer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            <Headphones className="h-4 w-4" />
            Start Dialing
          </Link>
          <NewLeadButton />
          <CsvUploadButton />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {segments.map((s) => (
          <Link
            key={s}
            href={`/dashboard/leads?segment=${s}`}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              segment === s
                ? "bg-slate-900 text-white"
                : "border border-border bg-white hover:bg-slate-50"
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
          placeholder="Search leads..."
          className="w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm"
        />
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-white">
        {leads.length === 0 ? (
          <p className="p-8 text-center text-muted">
            No leads yet. Import a CSV or add leads via API / GHL webhook.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-slate-50 text-left">
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
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-slate-50">
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
