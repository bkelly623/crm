import { notFound, redirect } from "next/navigation";
import { salesLeadScope } from "@/lib/leads/access";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { DialerPanel } from "@/components/dialer/dialer-panel";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DialerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!salesLeadScope(profile)) notFound();

  const smartViews = await prisma.smartView.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-w-0 p-4 pb-8 sm:p-6 lg:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Floor</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Lead review queue</h1>
          <p className="mt-1 text-sm text-muted">
            Select a list and caller ID, then Start session.
          </p>
        </div>
        <Link
          href="/dashboard/leads"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-primary transition hover:border-primary/40"
        >
          <Headphones className="h-4 w-4" />
          Lead board
        </Link>
      </div>

      <DialerPanel smartViews={smartViews} />
    </div>
  );
}
