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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto Dialer</h1>
          <p className="text-sm text-muted">Power dialer — one lead at a time from SmartViews</p>
        </div>
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Headphones className="h-4 w-4" />
          Manage SmartViews on Leads
        </Link>
      </div>

      <DialerPanel smartViews={smartViews} />
    </div>
  );
}
