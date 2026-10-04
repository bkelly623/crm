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
        className="min-h-11 rounded-lg border border-border bg-white px-3 py-2 text-sm"
      >
        + New Lead
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-md space-y-3 rounded-xl bg-white p-4 shadow-lg sm:p-6"
      >
        <h2 className="text-lg font-semibold">New Lead</h2>
        <input name="businessName" required placeholder="Business name *" className="min-h-11 w-full rounded-lg border px-3 py-2 text-base" />
        <input name="contactName" placeholder="Contact name" className="min-h-11 w-full rounded-lg border px-3 py-2 text-base" />
        <input name="phone" placeholder="Phone" className="min-h-11 w-full rounded-lg border px-3 py-2 text-base" />
        <input name="email" placeholder="Email" className="min-h-11 w-full rounded-lg border px-3 py-2 text-base" />
        <input name="location" placeholder="Location" className="min-h-11 w-full rounded-lg border px-3 py-2 text-base" />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="min-h-11 flex-1 rounded-lg bg-primary py-2 text-sm text-white">
            {loading ? "Saving..." : "Create"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-lg border py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
