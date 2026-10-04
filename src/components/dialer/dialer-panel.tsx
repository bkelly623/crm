"use client";
import { useEffect, useRef, useState } from "react";
import { SequentialSession } from "./sequential-session";
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
  const session = useRef<SequentialSession | null>(null);
  const [sessionState, setSessionState] = useState({ active: false, countdown: 0, error: "" });
  const held = voice.locked || voice.preparing || sessionState.active;
  const [selectedView, setSelectedView] = useState("");
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
  const requests = useRef(new Set<AbortController>());
  async function queueRequest(url: string, init: RequestInit = {}) {
    const abort = new AbortController(); requests.current.add(abort);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const res = await fetch(url, { ...init, cache: "no-store", signal: abort.signal });
          const data = init.method === "PATCH" ? null : await res.json();
          return { res, data };
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("Queue/save request timed out. Check the result before retrying manually.")); }, 12000); }),
      ]);
    } finally { clearTimeout(timer); requests.current.delete(abort); }
  }
  function clearReview() { selectionVersion.current += 1; setLead(null); setStatus("idle"); setError(""); }
  async function next(version: number) {
    if (reviewed.current.length >= REVIEW_SESSION_LIMIT) { setLead(null); setStatus("limit"); return; }
    const qs = new URLSearchParams();
    if (listId) qs.set("listId", listId);
    if (tagId) qs.set("tagId", tagId);
    if (selectedView) qs.set("smartViewId", selectedView);
    reviewed.current.forEach(id => qs.append("exclude", id));
    const { res, data } = await queueRequest(`/api/dialer/next-lead${qs.size ? `?${qs}` : ""}`);
    if (version !== selectionVersion.current) return;
    if (!res.ok) {
      if ([400, 404].includes(res.status)) { setListId(""); setTagId(""); setSelectedView(""); setLead(null); }
      throw new Error("Could not load queue. Check your selection and retry.");
    }
    if (data.lead && reviewed.current.includes(data.lead.id)) throw new Error("Queue returned a reviewed lead. Stop and retry later.");
    setLead(data.lead ?? null); setDisposition(data.lead?.sdrStatus ?? "no_contact"); setStatus(data.lead ? "ready" : "empty");
    return data.lead as Lead | null;
  }
  async function advance(save: boolean) {
    if (lock.current || controller.current?.snapshot.locked || controller.current?.snapshot.preparing || session.current?.snapshot.active) return; lock.current = true; setBusy(true); setError("");
    const version = selectionVersion.current;
    try {
      if (lead) {
        if (save) {
          const { res } = await queueRequest(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus: disposition }) });
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
  async function sessionNext(advance: boolean): Promise<string | null> {
    if (lock.current) throw new Error("Queue operation already in progress. Start again explicitly.");
    lock.current = true; setBusy(true); setError("");
    const version = selectionVersion.current;
    try {
      if (!advance && lead) return lead.id;
      if (advance && lead) {
        if (disposition !== lead.sdrStatus) {
          const { res } = await queueRequest(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus: disposition }) });
          if (!res.ok) throw new Error("Could not save disposition. Your selection is retained; retry manually.");
        }
        if (!reviewed.current.includes(lead.id)) reviewed.current.push(lead.id);
      }
      if (version !== selectionVersion.current) return null;
      const candidate = await next(version);
      return candidate?.id ?? null;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load queue. Please retry."); setStatus("error"); throw e; }
    finally { lock.current = false; setBusy(false); }
  }
  const latest = useRef({ listId, callerIdSid, sessionNext });
  latest.current = { listId, callerIdSid, sessionNext };
  useEffect(() => {
    if (!controller.current) return;
    const instance = new SequentialSession(controller.current, {
      selection: () => latest.current,
      available: () => document.visibilityState === "visible" && navigator.onLine,
      next: advance => latest.current.sessionNext(advance),
    });
    session.current = instance;
    const pendingRequests = requests.current;
    const unsubscribe = instance.subscribe(() => setSessionState(instance.snapshot));
    const stop = () => { selectionVersion.current++; instance.stop(instance.snapshot.active ? "Session paused by browser interruption. Start again explicitly." : instance.snapshot.error); };
    const visibility = () => { if (document.visibilityState !== "visible") stop(); };
    window.addEventListener("offline", stop); window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      selectionVersion.current++; unsubscribe(); instance.dispose(); session.current = null;
      pendingRequests.forEach(request => request.abort());
      window.removeEventListener("offline", stop); window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [controller]);
  function stopSession() { selectionVersion.current++; session.current?.stop(); setPaused(true); }
  return <div className="mt-4 min-w-0 space-y-3">
    <OrganizerSelect kind="lists" value={listId} disabled={busy || held} onChange={value => { if (!controller.current?.snapshot.locked && !session.current?.snapshot.active) { setListId(value); clearReview(); } }} />
    <CallerIdSelector disabled={held || busy} onVerifiedChange={setCallerIdSid} />
    <div className="sticky top-0 z-10 grid grid-cols-[2fr_1fr_1fr] gap-2 rounded-xl bg-surface p-2">
      <button className={filterControl} disabled={held || busy || !listId || !callerIdSid || status === "limit"} onClick={() => { setPaused(false); void session.current?.start(); }}>Start session</button>
      <button className={filterControl} onClick={stopSession}>Pause</button>
      <button className={filterControl} onClick={stopSession}>Stop</button>
    </div>
    <p className="text-sm">Start session prepares your microphone and calls the first lead. Then call this list one at a time, with a cancellable 5-second pause after server-confirmed completion. Pause/Stop prevents future calls; use Hang up to end current audio. This delay provides wrap-up time, not protection from spam labels.</p>
    {sessionState.countdown > 0 && <p role="status">Next call in {sessionState.countdown} seconds — Pause or Stop to cancel.</p>}
    {paused && <p role="status">Session paused. Finish any held call and wrap-up, then explicitly Start session. Use Next Lead to skip an already attempted lead.</p>}
    {sessionState.error && <p role="alert">{sessionState.error}</p>}
    <BrowserCallControls voice={voice} controller={controller} disabled={busy || sessionState.active} />
    <details className="rounded-xl border border-border bg-surface p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">Advanced filters &amp; manual review</summary>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">

      <OrganizerSelect kind="tags" value={tagId} disabled={busy || held} onChange={value => { if (!controller.current?.snapshot.locked) { setTagId(value); clearReview(); } }} />
      <label className="block text-sm">SmartView<select className={filterControl} value={selectedView} disabled={busy || held} onChange={e => { setSelectedView(e.target.value); clearReview(); }}>
        <option value="">No saved filter</option>{smartViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select></label>
    </div>
    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
      <button className={filterControl + " sm:w-auto"} disabled={held || busy || status === "limit"} onClick={() => { setPaused(false); void advance(false); }}>{lead ? "Next Lead" : "Load Lead"}</button>
      {paused && <button className={filterControl} disabled={held || busy} onClick={() => setPaused(false)}>Resume</button>}
    </div>
    </details>
    <p className="text-sm text-amber-800">Calling unavailable until mic and server authorization succeed. Eligible authorized leads only; one-hour call limit. Recording and phone-app fallback disabled.</p>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Loading…</p>}
    {status === "empty" && <p role="status">No eligible unreviewed leads in this selection.</p>}
    {status === "limit" && <p role="status">Review session limit reached. Reload the page to explicitly start a new session.</p>}
    {!lead && status === "idle" && <p>Load lists and numbers, choose a named list and caller ID, then Start session. Advanced filters are optional.</p>}
    {lead && <section className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="break-words text-xl font-bold">{lead.businessName}</h2>
      <p className="break-words">{lead.contactName ?? "—"} · {lead.phone ?? "No phone"}</p>
      <button className={filterControl + " mt-3 sm:w-auto"} disabled={held || busy || paused || !voice.ready || !callerIdSid || !lead.phone} onClick={() => { if (!lock.current) void controller.current?.start(lead.id, callerIdSid); }}>Call</button>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label>Disposition<select className={filterControl} value={disposition} disabled={busy} onChange={e => setDisposition(e.target.value)}>{SDR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <button className={filterControl} onClick={() => advance(true)} disabled={held || paused || busy}>Save &amp; Next</button>
        {held ? <span className={filterControl + " opacity-50"} aria-disabled="true">Open Lead — held during call</span> : <Link className={filterControl} href={`/dashboard/leads/${lead.id}`}>Open Lead</Link>}
      </div>
    </section>}
  </div>;
}
