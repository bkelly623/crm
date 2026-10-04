"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { filterControl } from "@/components/leads/organizer-select";
const numberSchema = z.object({ sid: z.string().regex(/^PN[0-9a-fA-F]{32}$/), phoneNumber: z.string().regex(/^\+[1-9][0-9]{1,14}$/), friendlyName: z.string() });
const inventorySchema = z.object({ numbers: z.array(numberSchema).max(50), nextPage: z.number().int().min(1).max(99).nullable(), hasMore: z.boolean(), truncated: z.boolean() });
type OwnedNumber = z.infer<typeof numberSchema>;

// Inventory is only a suggestion; the server revalidates ownership at issuance.
export function CallerIdSelector({ disabled = false, onVerifiedChange }: { disabled?: boolean; onVerifiedChange?: (sid: string) => void }) {
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [selected, setSelected] = useState<OwnedNumber | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [available, setAvailable] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function load(page = 0) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); setAttempted(true); setError("");
    try {
      const res = await fetch(`/api/dialer/numbers${page ? `?page=${page}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = inventorySchema.parse(await res.json());
      const merged = [...new Map((page ? [...numbers, ...data.numbers] : data.numbers).map(n => [n.sid, n])).values()];
      setNumbers(merged); setNextPage(data.nextPage); setTruncated(data.truncated); setAvailable(true);
      if (selected) {
        const current = merged.find(n => n.sid === selected.sid);
        if (current) setSelected(current);
        else if (!data.hasMore) { setSelected(null); setError("Selected number is no longer available. Choose another number."); }
      }
    } catch {
      setAvailable(false);
      setError("Number inventory unavailable. Reload to retry; remembered selection is not verified.");
    } finally { lock.current = false; setBusy(false); }
  }
  const listed = selected && numbers.some(n => n.sid === selected.sid);
  useEffect(() => { onVerifiedChange?.(available && !busy && listed ? selected!.sid : ""); }, [available, busy, listed, selected, onVerifiedChange]);
  return <section className="min-w-0 space-y-2 rounded-xl border border-border p-4">
    <label className="block text-sm">Call from
      <select className={filterControl} disabled={disabled || busy || !available} value={selected?.sid ?? ""} onChange={e => { setSelected(numbers.find(n => n.sid === e.target.value) ?? null); setError(""); }}>
        <option value="">Choose an owned number</option>
        {selected && !listed && <option value={selected.sid}>{selected.phoneNumber} (not yet verified)</option>}
        {numbers.map(n => <option key={n.sid} value={n.sid}>{n.friendlyName} · {n.phoneNumber}</option>)}
      </select>
    </label>
    <p className="break-words text-sm">{selected ? `Selected caller ID: ${selected.phoneNumber}` : "No caller ID selected."}</p>
    {selected && !listed && <p role="status">Remembered selection not yet verified in this inventory. Load remaining pages or choose a listed number.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" className={filterControl} disabled={disabled || busy} onClick={() => load()}>{busy ? "Loading numbers…" : attempted ? "Reload numbers" : "Load numbers"}</button>
      {nextPage !== null && <button type="button" className={filterControl} disabled={disabled || busy} onClick={() => load(nextPage)}>More numbers</button>}
    </div>
    {busy && <p role="status">Loading number inventory…</p>}
    {!busy && available && !numbers.length && nextPage === null && !truncated && <p>No owned voice-capable numbers available.</p>}
    {!busy && available && truncated && <p role="status">Inventory limit reached; more provider numbers exist. Ask an administrator to review the catalog.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="text-sm">Manual selection only. Server authorization is required to call. Inventory can change; reload to refresh.</p>
  </section>;
}
