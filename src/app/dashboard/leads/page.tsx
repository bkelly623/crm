import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { salesLeadScope } from "@/lib/leads/access";
import { listQuery } from "@/lib/leads/query";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { CsvUploadButton } from "@/components/leads/csv-upload-button";
import { LeadsBoard } from "@/components/leads/leads-board";
export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!salesLeadScope(profile)) notFound();
  const parsed = listQuery.safeParse(await searchParams);
  return <div className="min-w-0 p-4 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="font-display text-3xl font-semibold">Leads</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/dialer" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-primary">Review queue</Link>
        <NewLeadButton /><CsvUploadButton />
      </div>
    </header>
    {parsed.success ? <LeadsBoard key={JSON.stringify(parsed.data)} initial={parsed.data} /> : <div role="alert" className="mt-6">Invalid lead filters. <Link href="/dashboard/leads" className="inline-flex min-h-11 items-center text-primary">Clear filters</Link></div>}
  </div>;
}
