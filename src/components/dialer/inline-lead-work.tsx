"use client";
import { useEffect, useRef, useState } from "react";
import { filterControl } from "@/components/leads/organizer-select";
import { followUpSchema, leadEditSchema } from "@/lib/leads/validation";

// Bound transport AND response decoding; late responses cannot clear newer drafts.
async function writeDraft(url: string, method: "PATCH" | "POST", body: unknown) {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abort.signal });
        if (!response.ok) throw new Error("Save not confirmed");
        if (method === "POST" && !(await response.json()).task?.id) throw new Error("Task not confirmed");
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("Save timed out")); }, 12000); }),
    ]);
  } finally { clearTimeout(timer); }
}

// Mounted only while the panel holds this exact lead. Closing never resumes calls.
export function InlineLeadWork({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [saved, setSaved] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void fetch(`/api/leads/${encodeURIComponent(leadId)}`, { cache: "no-store", signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.lead?.id !== leadId || !(data.lead.notes === null || typeof data.lead.notes === "string")) throw new Error();
      if (!abort.signal.aborted && alive.current) { setNotes(data.lead.notes ?? ""); setSaved(data.lead.notes ?? ""); setLoaded(true); }
    }).catch(() => { if (!abort.signal.aborted && alive.current) setError("Could not load shared notes. Close and reopen to retry; editing is disabled to protect existing notes."); });
    return () => { alive.current = false; abort.abort(); };
  }, [leadId]);
  async function save() {
    if (!loaded || pending.current) return;
    const parsed = leadEditSchema.safeParse({ notes });
    if (!parsed.success) { setError("Notes must be at most 20000 characters."); return; }
    pending.current = true; setSaving(true); setError("");
    try {
      await writeDraft(`/api/leads/${encodeURIComponent(leadId)}`, "PATCH", parsed.data);
      if (alive.current) { setSaved(notes); setMessage("Notes saved. Calling remains paused."); }
    } catch { if (alive.current) setError("Could not confirm notes saved. Your draft is kept; check before retrying."); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  async function addTask() {
    if (pending.current) return;
    // Same device-local datetime → UTC conversion as the lead-detail follow-up form.
    const date = new Date(due);
    const parsed = followUpSchema.safeParse({ leadId, note, dueAt: Number.isFinite(date.getTime()) ? date.toISOString() : "" });
    if (!parsed.success) { setError("Enter a follow-up note (up to 2000 characters) and valid due date and time."); return; }
    pending.current = true; setSaving(true); setError(""); setMessage("");
    try {
      await writeDraft("/api/tasks", "POST", parsed.data);
      if (alive.current) { setNote(""); setDue(""); setMessage("Follow-up created. Calling remains paused."); }
    } catch { if (alive.current) setError("Could not confirm follow-up creation. Your draft is kept. Check Follow-ups before retrying to avoid a duplicate."); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  const dirty = notes !== saved;
  const taskDirty = Boolean(note || due);
  useEffect(() => {
    if (!dirty && !taskDirty && !saving) return;
    const exit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        event.preventDefault(); event.stopPropagation();
        setError("Save or explicitly discard your drafts and wait for pending saves before leaving.");
      }
    };
    window.addEventListener("beforeunload", exit);
    document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", exit); document.removeEventListener("click", navigation, true); };
  }, [dirty, taskDirty, saving]);
  return <section className="mt-4 space-y-3" aria-label="Inline lead work">
    <p>Calling is paused, not hung up. Save or explicitly discard drafts, then close. After server-confirmed completion, Complete wrap-up, choose Next Lead, then Start session. Closing or saving never resumes automatically.</p>
    <label className="block">Shared lead notes<textarea className={filterControl + " min-h-32"} value={notes} maxLength={20000} disabled={!loaded || saving} onChange={e => { setNotes(e.target.value); setMessage(""); }} /></label>
    <p className="text-sm">One shared notes field, not a timestamped note history. Saving replaces this field for everyone. Save before leaving this page.</p>
    <button className={filterControl} disabled={!loaded || saving || !dirty} onClick={() => void save()}>{saving ? "Saving notes…" : "Save notes"}</button>
    <label className="block">Follow-up note<textarea className={filterControl + " min-h-24"} value={note} maxLength={2000} disabled={saving} onChange={e => { setNote(e.target.value); setMessage(""); }} /></label>
    <label className="block">Due date and time<input className={filterControl} type="datetime-local" value={due} disabled={saving} onChange={e => setDue(e.target.value)} /></label>
    <p className="text-sm">Enter times in this device’s local timezone; saved due times are shown in UTC on Follow-ups. New follow-ups are assigned to you.</p>
    <button className={filterControl} disabled={saving} onClick={() => void addTask()}>Add follow-up</button>
    {taskDirty && <button className={filterControl} disabled={saving} onClick={() => { setNote(""); setDue(""); setError(""); }}>Discard follow-up draft</button>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className={filterControl} disabled={saving || dirty || taskDirty} onClick={onClose}>Close notes &amp; follow-up</button>
    {dirty && <button className={filterControl} disabled={saving} onClick={() => { setNotes(saved); setError(""); }}>Discard note draft</button>}
  </section>;
}
