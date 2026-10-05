"use client";

import { useEffect, useState } from "react";
import type { CallsToday } from "@/lib/calls/today";

export function CallsTodayCard({ initial }: { initial: CallsToday }) {
  const [stats, setStats] = useState<CallsToday | null>(initial);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    let request: AbortController | undefined;
    let midnight: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const visible = () => document.visibilityState === "visible";
    function schedule(value: CallsToday) {
      clearTimeout(midnight);
      // Expired router/SSR snapshots must not remain today's count.
      midnight = setTimeout(() => {
        setStats(null);
        void refresh();
      }, Math.max(0, Date.parse(value.endsAt) - Date.now()));
    }
    async function refresh() {
      if (disposed || !visible()) return;
      request?.abort();
      clearTimeout(deadline);
      const current = new AbortController();
      request = current;
      deadline = setTimeout(() => {
        current.abort();
        if (!disposed && request === current) { setStats(null); setUnavailable(true); }
      }, 8000);
      try {
        const response = await fetch("/api/calls/today", { cache: "no-store", credentials: "same-origin", signal: current.signal });
        if (!response.ok) throw new Error("Unavailable");
        const value: CallsToday = await response.json();
        if (disposed || current.signal.aborted) return;
        if (!Number.isSafeInteger(value.count) || value.count < 0 || !Number.isFinite(Date.parse(value.endsAt)) || Date.parse(value.endsAt) <= Date.now()) throw new Error("Invalid count");
        setStats(value); setUnavailable(false); schedule(value);
      } catch {
        if (!disposed && !current.signal.aborted) { setStats(null); setUnavailable(true); }
      } finally {
        if (request === current) clearTimeout(deadline);
      }
    }
    function visibilityChanged() {
      if (visible()) void refresh();
      else { request?.abort(); clearTimeout(deadline); }
    }
    schedule(initial);
    void refresh();
    const poll = setInterval(() => { void refresh(); }, 15_000);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", visibilityChanged);
    window.addEventListener("online", visibilityChanged);
    return () => {
      disposed = true; request?.abort(); clearTimeout(deadline); clearTimeout(midnight); clearInterval(poll);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", visibilityChanged);
      window.removeEventListener("online", visibilityChanged);
    };
  }, [initial]);

  return <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm" aria-live="polite">
    <p className="text-sm text-muted">Your calls today ({stats?.timezone ?? initial.timezone})</p>
    <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{stats?.count ?? "—"}</p>
    <p className="text-xs text-muted">{unavailable ? "Count unavailable — retrying" : "Recorded call attempts · refreshes every 15s"}</p>
  </div>;
}
