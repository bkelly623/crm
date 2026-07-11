"use client";

import { useState } from "react";
import type { Profile } from "@prisma/client";

export function SettingsForm({ profile }: { profile: Profile }) {
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [googleCalendarId, setGoogleCalendarId] = useState(profile.googleCalendarId ?? "");
  const [dialerHoursExtended, setDialerHoursExtended] = useState(profile.dialerHoursExtended);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        timezone,
        googleCalendarId,
        dialerHoursExtended,
      }),
    });

    setLoading(false);
    setMessage(res.ok ? "Saved." : "Failed to save.");
  }

  return (
    <form onSubmit={handleSave} className="mt-6 space-y-6 rounded-xl border border-border bg-white p-6">
      <h2 className="font-semibold">Contact & Integrations</h2>

      <div>
        <label className="mb-1 block text-sm font-medium">Phone Number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="Your outbound caller ID"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Google Calendar ID</label>
        <input
          value={googleCalendarId}
          onChange={(e) => setGoogleCalendarId(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="your-calendar-id@group.calendar.google.com"
        />
        <p className="mt-1 text-xs text-muted">Used for appointment syncing.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="America/New_York">Eastern Time (ET)</option>
          <option value="America/Chicago">Central Time (CT)</option>
          <option value="America/Denver">Mountain Time (MT)</option>
          <option value="America/Los_Angeles">Pacific Time (PT)</option>
        </select>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={dialerHoursExtended}
          onChange={(e) => setDialerHoursExtended(e.target.checked)}
        />
        Extended auto-dialer hours (8 AM – 9 PM lead local time)
      </label>

      {message && <p className="text-sm text-muted">{message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
