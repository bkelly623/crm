import { getCurrentProfile } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function ExecutivePage() {
  const profile = await getCurrentProfile();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted">Managers and admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <ComingSoon
      title="Pulse"
      description="Org-wide KPIs, conversion, and capacity — executive view."
      phase="Phase 4"
    />
  );
}
