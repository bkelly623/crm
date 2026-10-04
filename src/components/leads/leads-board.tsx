"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OrganizerSelect, filterControl } from "./organizer-select";
type Filters = { q?: string; segment: "active" | "won" | "trashed" | "all"; listId?: string; tagId?: string; myLeads?: "true" | "false"; after?: string };
type Lead = { id: string; businessName: string; contactName: string | null; phone: string | null; sdrStatus: string; source: string };
function queryString(filters: Filters) {
  return new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1])).toString();
}
export function LeadsBoard({ initial }: { initial: Filters }) {
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(queryString(initial));
  const [history, setHistory] = useState<string[]>([]);
  const [rows, setRows] = useState<Lead[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true); setError(""); setRows([]); setCursor(null);
    (async () => {
      try {
        const res = await fetch(`/api/leads?${query}`);
        const data = await res.json();
        if (!res.ok) throw new Error(res.status === 404 ? "Selected list or tag is no longer available. Clear it or choose another, then apply filters." : "Could not load leads. Please retry.");
        if (current) { setRows(data.leads); setCursor(data.nextCursor); }
      } catch (e) { if (current) setError(e instanceof Error ? e.message : "Could not load leads. Please retry."); }
      finally { if (current) setBusy(false); }
    })();
    return () => { current = false; };
  // A fresh server prop object also invalidates results after router.refresh().
  }, [query, retry, initial]);
  return <div className="min-w-0">
    <form className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); setHistory([]); setQuery(queryString({ ...draft, after: undefined })); setRetry(n => n + 1); }}>
      <label>Search leads<input className={filterControl} maxLength={300} value={draft.q ?? ""} disabled={busy} onChange={e => setDraft({ ...draft, q: e.target.value })} placeholder="Business, contact, phone…" /></label>
      <label>Segment<select className={filterControl} value={draft.segment} disabled={busy} onChange={e => setDraft({ ...draft, segment: e.target.value as Filters["segment"] })}>{["active", "won", "trashed", "all"].map(segment => <option key={segment} value={segment}>{segment}</option>)}</select></label>
      <OrganizerSelect kind="lists" value={draft.listId ?? ""} disabled={busy} onChange={listId => setDraft({ ...draft, listId })} />
      <OrganizerSelect kind="tags" value={draft.tagId ?? ""} disabled={busy} onChange={tagId => setDraft({ ...draft, tagId })} />
      <button className={filterControl} disabled={busy}>Apply filters</button>
      <p className="text-sm text-muted">Results reflect applied filters. Lists and tags intersect your authorized leads. Ordered by stable lead ID.</p>
    </form>
    {busy && <p role="status" className="mt-6">Loading leads…</p>}
    {error && <div role="alert" className="mt-6"><p>{error}</p><button className={filterControl} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
    {!busy && !error && <section className="mt-6 min-w-0 space-y-3" aria-label="Lead results">
      <p className="text-sm text-muted">{rows.length} shown on this page</p>
      {!rows.length && <p>No leads in this view</p>}
      {rows.map(lead => <article key={lead.id} className="min-w-0 break-words rounded-xl border border-border bg-surface p-4">
        <Link href={`/dashboard/leads/${lead.id}`} className="inline-flex min-h-11 items-center font-medium text-primary">{lead.businessName}</Link>
        <p>{lead.contactName ?? "—"} · {lead.phone ?? "No phone"}</p>
        <p className="text-sm text-muted">{lead.sdrStatus.replace(/_/g, " ")} · {lead.source}</p>
      </article>)}
      <nav aria-label="Lead pages" className="flex flex-wrap gap-3">
        <button className={filterControl + " sm:w-auto"} disabled={!history.length} onClick={() => { setQuery(history[history.length - 1]); setHistory(history.slice(0, -1)); }}>Previous page</button>
        <button className={filterControl + " sm:w-auto"} disabled={!cursor} onClick={() => { if (!cursor) return; const next = new URLSearchParams(query); next.set("after", cursor); setHistory([...history, query]); setQuery(next.toString()); }}>Next page</button>
      </nav>
    </section>}
  </div>;
}
