import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted">Only admins and sales managers can manage users.</p>
        </div>
      </div>
    );
  }

  const users = await prisma.profile.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Team</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Users & roles</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Invite reps and managers here. Role controls which sidebar modules they see.
        Your account is admin — full access.
      </p>
      <div className="mt-8">
        <UsersManager
          initialUsers={users.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
