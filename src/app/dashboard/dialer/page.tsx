import Link from "next/link";
import { Headphones } from "lucide-react";
import { DialerPanel } from "@/components/dialer/dialer-panel";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DialerPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const smartViews = await prisma.smartView.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Floor</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Power dialer</h1>
          <p className="mt-1 text-sm text-muted">
            One lead at a time. Disposition, then next. Twilio Voice SDK wires in when credentials are set.
          </p>
        </div>
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-primary transition hover:border-primary/40"
        >
          <Headphones className="h-4 w-4" />
          Lead board
        </Link>
      </div>

      <DialerPanel smartViews={smartViews} />
    </div>
  );
}
