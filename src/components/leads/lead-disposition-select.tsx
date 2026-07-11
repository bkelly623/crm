"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SDR_STATUSES } from "@/lib/leads/constants";

export function LeadDispositionSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(value: string) {
    setStatus(value);
    setSaving(true);
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdrStatus: value }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={status}
      onChange={(e) => save(e.target.value)}
      disabled={saving}
      className="rounded-lg border border-border px-3 py-2 text-sm capitalize"
    >
      {SDR_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
