"use client";
import { useRef, useState } from "react";
export const filterControl = "min-h-11 min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
type Item = { id: string; name: string };
export function OrganizerSelect({ kind, value, onChange, disabled = false }: { kind: "lists" | "tags"; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function load(after?: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const res = await fetch(`/api/lead-organizers/${kind}${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      const merged: Item[] = [...new Map<string, Item>((after ? [...items, ...data.items] : data.items).map((item: Item) => [item.id, item])).values()];
      setItems(merged); setCursor(data.nextCursor); setLoaded(true);
      if (!data.nextCursor && value && !merged.some(item => item.id === value)) {
        onChange(""); setError("Selected entry is no longer available. Choose another selection.");
      }
    } catch { setError(`Could not load ${kind}. Please retry.`); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="min-w-0 space-y-2">
    <label className="block text-sm">{kind === "lists" ? "Named list" : "Tag"}
      <select className={filterControl} value={value} disabled={disabled || busy} onChange={e => onChange(e.target.value)}>
        <option value="">{kind === "lists" ? "All authorized leads" : "Any tag"}</option>
        {value && !items.some(item => item.id === value) && <option value={value}>Selected {kind === "lists" ? "list" : "tag"}</option>}
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <button type="button" className={filterControl} disabled={disabled || busy} onClick={() => load()}>{busy ? "Loading…" : `${loaded ? "Reload" : "Load"} ${kind}`}</button>
    {cursor && <button type="button" className={filterControl} disabled={disabled || busy} onClick={() => load(cursor)}>More {kind}</button>}
    {loaded && !items.length && <p>No {kind} available.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
