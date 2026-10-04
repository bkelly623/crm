"use client";
import { useRef, useState } from "react";
import { CallerIdSelector } from "@/components/dialer/caller-id-selector";
import Link from "next/link";
import { useBrowserDialer } from "./use-browser-dialer";
import { BrowserCallControls } from "./browser-call-controls";
import { SDR_STATUSES } from "@/lib/leads/constants";
import { REVIEW_SESSION_LIMIT } from "@/lib/leads/review";
import { OrganizerSelect, filterControl } from "@/components/leads/organizer-select";
interface SmartView { id: string; name: string }
interface Lead { id: string; businessName: string; contactName: string | null; phone: string | null; sdrStatus: string }
export function DialerPanel({ smartViews }: { smartViews: SmartView[] }) {
  const { snapshot: voice, controller } = useBrowserDialer();
  const [callerIdSid, setCallerIdSid] = useState("");
  const held = voice.locked || voice.preparing;
  const [selectedView, setSelectedView] = useState(smartViews[0]?.id ?? "");
  const [listId, setListId] = useState("");
  const [tagId, setTagId] = useState("");
  const [lead, setLead] = useState<Lead | null>(null);
  const [disposition, setDisposition] = useState("no_contact");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const reviewed = useRef<string[]>([]);
  const selectionVersion = useRef(0);
  function clearReview() { selectionVersion.current += 1; setLead(null); setStatus("idle"); setError(""); }
  async function next(version: number) {
    if (reviewed.current.length >= REVIEW_SESSION_LIMIT) { setLead(null); setStatus("limit"); return; }
    const qs = new URLSearchParams();
    if (listId) qs.set("listId", listId);
    if (tagId) qs.set("tagId", tagId);
    if (selectedView) qs.set("smartViewId", selectedView);
    reviewed.current.forEach(id => qs.append("exclude", id));
    const res = await fetch(`/api/dialer/next-lead${qs.size ? `?${qs}` : ""}`);
    const data = await res.json();
    if (version !== selectionVersion.current) return;
    if (!res.ok) {
      if ([400, 404].includes(res.status)) { setListId(""); setTagId(""); setSelectedView(""); setLead(null); }
      throw new Error("Could not load queue. Check your selection and retry.");
    }
    if (data.lead && reviewed.current.includes(data.lead.id)) throw new Error("Queue returned a reviewed lead. Stop and retry later.");
    setLead(data.lead ?? null); setDisposition(data.lead?.sdrStatus ?? "no_contact"); setStatus(data.lead ? "ready" : "empty");
  }
  async function advance(save: boolean) {
    if (lock.current || paused || controller.current?.snapshot.locked || controller.current?.snapshot.preparing) return; lock.current = true; setBusy(true); setError("");
    const version = selectionVersion.current;
    try {
      if (lead) {
        if (save) {
          const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus: disposition }) });
          if (!res.ok) throw new Error("Could not save disposition. Your selection is retained; retry.");
        }
        if (!reviewed.current.includes(lead.id)) reviewed.current.push(lead.id);
        setLead(null);
      }
      if (version !== selectionVersion.current) return;
      setStatus("loading"); await next(version);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load queue. Please retry."); setStatus("error"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-4 min-w-0 space-y-3">
    <details className="rounded-xl border border-border bg-surface p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">Queue filters</summary>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      <OrganizerSelect kind="lists" value={listId} disabled={busy || held} onChange={value => { if (!controller.current?.snapshot.locked) { setListId(value); clearReview(); } }} />
      <OrganizerSelect kind="tags" value={tagId} disabled={busy || held} onChange={value => { if (!controller.current?.snapshot.locked) { setTagId(value); clearReview(); } }} />
      <label className="block text-sm">SmartView<select className={filterControl} value={selectedView} disabled={busy || held} onChange={e => { setSelectedView(e.target.value); clearReview(); }}>
        <option value="">No saved filter</option>{smartViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select></label>
    </div>
    </details>
    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
      <button className={filterControl + " sm:w-auto"} disabled={held || paused || busy || status === "limit"} onClick={() => advance(false)}>{lead ? "Next Lead" : "Load Lead"}</button>
      <button className={filterControl + " sm:w-auto"} disabled={busy || held} onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button>
      <button className={filterControl + " sm:w-auto"} disabled={busy || held} onClick={() => { clearReview(); setPaused(false); }}>Stop</button>
    </div>
    <CallerIdSelector disabled={held} onVerifiedChange={setCallerIdSid} />
    <BrowserCallControls voice={voice} controller={controller} disabled={busy || paused} />
    <p className="text-sm text-amber-800">Calling unavailable until mic and server authorization succeed. Eligible authorized leads only; one-hour call limit. Recording and phone-app fallback disabled.</p>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Loading…</p>}
    {status === "empty" && <p role="status">No eligible unreviewed leads in this selection.</p>}
    {status === "limit" && <p role="status">Review session limit reached. Reload the page to explicitly start a new session.</p>}
    {!lead && status === "idle" && <p>Ready to Review. Load Lead, then choose a number and prepare your microphone. Queue filters are optional.</p>}
    {lead && <section className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="break-words text-xl font-bold">{lead.businessName}</h2>
      <p className="break-words">{lead.contactName ?? "—"} · {lead.phone ?? "No phone"}</p>
      <button className={filterControl + " mt-3 sm:w-auto"} disabled={held || busy || paused || !voice.ready || !callerIdSid || !lead.phone} onClick={() => { if (!lock.current) void controller.current?.start(lead.id, callerIdSid); }}>Call</button>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label>Disposition<select className={filterControl} value={disposition} disabled={busy || held} onChange={e => setDisposition(e.target.value)}>{SDR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <button className={filterControl} onClick={() => advance(true)} disabled={held || paused || busy}>Save &amp; Next</button>
        {held ? <span className={filterControl + " opacity-50"} aria-disabled="true">Open Lead — held during call</span> : <Link className={filterControl} href={`/dashboard/leads/${lead.id}`}>Open Lead</Link>}
      </div>
    </section>}
  </div>;
}
