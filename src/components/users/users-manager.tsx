"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string;
};

export function UsersManager({ initialUsers }: { initialUsers: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName: fullName || undefined, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Invite failed");
      return;
    }
    setUsers((prev) => [...prev, { ...data.user, createdAt: data.user.createdAt }]);
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("sales_rep");
    router.refresh();
  }

  async function changeRole(userId: string, nextRole: string) {
    setError(null);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: nextRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Role update failed");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)),
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={invite}
        className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <h2 className="font-display text-lg font-semibold">Invite teammate</h2>
        <p className="mt-1 text-sm text-muted">
          Creates a login and assigns a role. They can sign in immediately.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password (min 8)"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-canvas text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{u.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ASSIGNABLE_ROLES.map((r) => (
          <div
            key={r.value}
            className="rounded-2xl border border-border bg-surface/80 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {r.tier}
            </p>
            <p className="mt-1 font-medium">{r.label}</p>
            <p className="mt-1 text-sm text-muted">{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
