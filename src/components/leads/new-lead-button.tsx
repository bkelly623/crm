"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewLeadButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: fd.get("businessName"),
        contactName: fd.get("contactName") || undefined,
        phone: fd.get("phone") || undefined,
        email: fd.get("email") || undefined,
        location: fd.get("location") || undefined,
        source: "manual",
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
      >
        + New Lead
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">New Lead</h2>
        <input name="businessName" required placeholder="Business name *" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <input name="contactName" placeholder="Contact name" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <input name="email" placeholder="Email" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <input name="location" placeholder="Location" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white">
            {loading ? "Saving..." : "Create"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
