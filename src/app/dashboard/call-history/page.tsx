import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/auth";
import Link from "next/link";

export default async function CallHistoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const calls = await prisma.call.findMany({
    where: { userId: profile.id, startedAt: { gte: startOfDay } },
    include: { lead: true },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Call History</h1>
      <p className="text-sm text-muted">{calls.length} calls today</p>

      <div className="mt-6 space-y-2">
        {calls.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-8 text-center text-muted">
            No calls today. Start dialing from the Dialer tab.
          </p>
        ) : (
          calls.map((call) => (
            <Link
              key={call.id}
              href={`/dashboard/leads/${call.leadId}`}
              className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium">{call.lead.businessName}</p>
                <p className="text-sm text-muted">
                  {call.lead.phone} · {call.lead.contactName ?? "—"}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="capitalize">{call.status.replace(/_/g, " ")}</p>
                <p className="text-muted">{call.startedAt.toLocaleTimeString()}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
