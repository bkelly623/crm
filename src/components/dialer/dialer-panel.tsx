"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headphones, Phone, Pause, Square } from "lucide-react";
import { SDR_STATUSES } from "@/lib/leads/constants";

interface SmartView {
  id: string;
  name: string;
}

interface Lead {
  id: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  sdrStatus: string;
}

export function DialerPanel({ smartViews }: { smartViews: SmartView[] }) {
  const [selectedView, setSelectedView] = useState(smartViews[0]?.id ?? "");
  const [lead, setLead] = useState<Lead | null>(null);
  const [disposition, setDisposition] = useState("no_contact");
  const [status, setStatus] = useState<string>("idle");
  const [twilioReady, setTwilioReady] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/twilio/token")
      .then((r) => setTwilioReady(r.ok))
      .catch(() => setTwilioReady(false));
  }, []);

  async function fetchNextLead() {
    setStatus("loading");
    const qs = selectedView ? `?smartViewId=${selectedView}` : "";
    const res = await fetch(`/api/dialer/next-lead${qs}`);
    const data = await res.json();
    setLead(data.lead ?? null);
    setDisposition(data.lead?.sdrStatus ?? "no_contact");
    setStatus(data.lead ? "ready" : "empty");
  }

  async function saveDisposition() {
    if (!lead) return;
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdrStatus: disposition }),
    });
    await fetchNextLead();
  }

  async function startDialing() {
    if (!lead?.phone) return;
    setStatus("dialing");
    // Twilio Voice SDK wiring lands here when credentials are set
    window.open(`tel:${lead.phone}`, "_self");
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedView}
          onChange={(e) => setSelectedView(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="">All active leads</option>
          {smartViews.map((sv) => (
            <option key={sv.id} value={sv.id}>
              {sv.name}
            </option>
          ))}
        </select>

        <button
          onClick={fetchNextLead}
          disabled={paused}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Headphones className="h-4 w-4" />
          {lead ? "Next Lead" : "Start Dialing"}
        </button>

        {lead && (
          <>
            <button
              onClick={() => setPaused(!paused)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm"
            >
              <Pause className="h-4 w-4" />
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={() => {
                setLead(null);
                setStatus("idle");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm text-destructive"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        )}
      </div>

      {twilioReady === false && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Twilio not configured yet. Add TWILIO_* env vars in Vercel. Dialer uses click-to-call until then.
        </p>
      )}

      {!lead && status !== "loading" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-16 text-center">
          <Headphones className="h-12 w-12 text-primary/40" />
          <h2 className="mt-4 text-lg font-semibold">Ready to Dial</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Select a SmartView and click Start Dialing. Import leads first if your pool is empty.
          </p>
        </div>
      )}

      {lead && (
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{lead.businessName}</h2>
              <p className="text-muted">{lead.contactName ?? "—"} · {lead.phone ?? "No phone"}</p>
            </div>
            <button
              onClick={startDialing}
              disabled={!lead.phone || paused}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Phone className="h-4 w-4" />
              Call
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Disposition</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {SDR_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={saveDisposition}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Save & Next
            </button>
            <Link
              href={`/dashboard/leads/${lead.id}`}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Open Lead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
