"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { organizerName } from "@/lib/leads/organizer-validation";
type Item = { id: string; name: string; selected: boolean };
const button = "min-h-11 min-w-0 break-words rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary";
const control = "min-h-11 w-full min-w-0 rounded-lg border border-border px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary";
function OrganizerPanel({ leadId, kind }: { leadId: string; kind: "tags" | "lists" }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState("load");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const singular = kind === "tags" ? "tag" : "list";
  const load = useCallback(async (after?: string) => {
    if (busy.current) return;
    busy.current = true; setPending("load"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/lead-organizers/${kind}?leadId=${encodeURIComponent(leadId)}${after ? `&after=${encodeURIComponent(after)}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error();
      setItems(current => [...new Map<string, Item>((after ? [...current, ...data.items] : data.items).map((item: Item) => [item.id, item])).values()]);
      setCursor(data.nextCursor); setReady(true);
    } catch { setError(`Could not load ${kind}. Your lead edits are kept; please retry.`); }
    finally { busy.current = false; setPending(""); }
  }, [leadId, kind]);
  useEffect(() => { void load(); }, [load]);
  async function toggle(item: Item) {
    if (busy.current) return;
    busy.current = true; setPending("save"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/organizers/${kind}`, { method: item.selected ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizerId: item.id }) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.selected !== !item.selected) throw new Error();
      setItems(current => current.map(row => row.id === item.id ? { ...row, selected: result.selected } : row));
      setMessage("Membership saved.");
    } catch { setError("Could not change membership. Your lead edits are kept; retry or reload to check the saved state."); }
    finally { busy.current = false; setPending(""); }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError(""); setMessage("");
    const parsed = organizerName(kind).safeParse({ name });
    if (!parsed.success) { setError(`Enter a valid ${singular} name (up to ${kind === "tags" ? 60 : 80} characters).`); return; }
    busy.current = true; setPending("create");
    try {
      const response = await fetch(`/api/lead-organizers/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (response.status === 409) { setError("That name already exists. Reload to choose it or enter another name."); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.item?.id || !data.item?.name) throw new Error();
      setItems(current => [...current.filter(row => row.id !== data.item.id), { ...data.item, selected: false }]);
      setName(""); setMessage(`${singular === "tag" ? "Tag" : "List"} created. Add this lead using its button below.`);
    } catch { setError(`Could not create ${singular}. Your name and lead edits are kept; retry or reload to check the saved state.`); }
    finally { busy.current = false; setPending(""); }
  }
  return <div className="min-w-0 space-y-3" aria-busy={!!pending}>
    <h3 className="font-semibold">{kind === "tags" ? "Tags" : "Named lists"}</h3>
    <p className="text-sm text-muted">{kind === "tags" ? "Shared sales tags." : "Your lists; sales managers can also manage team lists. New lists belong to you."}</p>
    <form onSubmit={create} noValidate className="space-y-2">
      <label className="block text-sm">New {singular} name
        <input className={control} value={name} maxLength={kind === "tags" ? 60 : 80} disabled={!!pending || !ready} onChange={event => setName(event.target.value)} />
      </label>
      <button type="submit" className={button} disabled={!!pending || !ready}>Create {singular}</button>
    </form>
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    <p role="status" className="text-sm">{pending === "load" ? `Loading ${kind}…` : pending ? `Saving ${kind}…` : message}</p>
    <div className="flex min-w-0 flex-wrap gap-2">
      {items.map(item => <button type="button" key={item.id} className={`${button} ${item.selected ? "bg-primary/10" : ""}`} disabled={!!pending} onClick={() => toggle(item)}>{kind === "tags" ? `${item.selected ? "Remove" : "Add"} tag ${item.name}` : `${item.selected ? "Remove from" : "Add to"} list ${item.name}`}</button>)}
    </div>
    {ready && !items.length && <p className="text-sm text-muted">No {kind} yet.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={!!pending} onClick={() => load()}>Reload {kind}</button>
      {cursor && <button type="button" className={button} disabled={!!pending} onClick={() => load(cursor)}>More {kind}</button>}
    </div>
  </div>;
}
export function LeadOrganizers({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  return <section className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Tags and lists</h2>
    <p className="text-sm text-muted">Lists organize leads only; dialing is not connected. Membership changes save separately from lead details.</p>
    {!open ? <button type="button" className={button} onClick={() => setOpen(true)}>Edit tags and lists</button> : <div className="grid min-w-0 gap-6 sm:grid-cols-2"><OrganizerPanel leadId={leadId} kind="tags" /><OrganizerPanel leadId={leadId} kind="lists" /></div>}
  </section>;
}
