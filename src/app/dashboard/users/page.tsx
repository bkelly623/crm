import { getCurrentProfile } from "@/lib/auth";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="text-muted">Team management — coming in Phase 4.</p>
    </div>
  );
}
