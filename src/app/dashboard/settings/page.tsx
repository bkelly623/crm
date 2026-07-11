import { getCurrentProfile } from "@/lib/auth";
import { formatRole } from "@/lib/utils";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-muted">Manage your profile and preferences.</p>

      <section className="mt-8 rounded-xl border border-border bg-white p-6">
        <h2 className="font-semibold">Account Information</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Full Name</dt>
            <dd className="font-medium">{profile.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="font-medium">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Role</dt>
            <dd className="font-medium">{formatRole(profile.role)}</dd>
          </div>
        </dl>
      </section>

      <SettingsForm profile={profile} />
    </div>
  );
}
