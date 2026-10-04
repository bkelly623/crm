"use client";
import { LeadFollowUps } from "./lead-follow-ups";
import { LeadOrganizers } from "./lead-organizers";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Lead, Task } from "@prisma/client";
import { SDR_STATUSES } from "@/lib/leads/constants";
import { leadEditSchema } from "@/lib/leads/validation";
export type WorkspaceLead = Pick<Lead, "id" | "businessName" | "contactName" | "phone" | "email" | "website" | "revenue" | "location" | "industry" | "sicCode" | "market" | "type" | "sdrStatus" | "segment" | "notes">;
export type WorkspaceTask = Pick<Task, "id" | "userId" | "note" | "status"> & { dueAt: string };
const fields = [
  ["businessName", "Business name"], ["contactName", "Contact name"], ["phone", "Phone"], ["email", "Email"],
  ["website", "Website"], ["revenue", "Revenue"], ["location", "Location"], ["industry", "Industry"],
  ["sicCode", "SIC code"], ["market", "Market"], ["type", "Type"],
] as const;
const control = "min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary";
const button = "min-h-11 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary";
export function LeadWorkspace({ lead, initialTasks, currentUserId }: { lead: WorkspaceLead; initialTasks: WorkspaceTask[]; currentUserId: string }) {
  const initial = Object.fromEntries([...fields.map(([key]) => key), "sdrStatus", "segment", "notes"].map(key => [key, lead[key as keyof WorkspaceLead] ?? ""])) as Record<string, string>;
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function change(key: string, value: string) { setDraft(d => ({ ...d, [key]: value })); setMessage(""); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(""); setMessage("");
    const changes = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== saved[key]));
    if (!Object.keys(changes).length) { setMessage("No unsaved changes."); return; }
    const parsed = leadEditSchema.safeParse(changes);
    if (!parsed.success) {
      setError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")); return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) throw new Error("Could not save lead. Your edits are kept; please retry.");
      const normalized = Object.fromEntries(Object.entries(parsed.data).map(([key, value]) => [key, value ?? ""]));
      const next = { ...draft, ...normalized };
      setSaved(next); setDraft(next); setMessage("Lead saved.");
    } catch { setError("Could not save lead. Your edits are kept; please retry."); }
    finally { setSaving(false); }
  }
  return <div className="min-w-0 space-y-6">
    <p className="text-sm text-muted">Calling and appointment booking unavailable in this workspace.</p>
    <section className="rounded-xl border border-border bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Lead information</h2>
      <form onSubmit={save} noValidate className="mt-4 space-y-4" aria-busy={saving}>
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {fields.map(([key, label]) => <label key={key} className="block min-w-0 text-sm font-medium">{label}
              <input className={control} value={draft[key]} onChange={e => change(key, e.target.value)} maxLength={key === "website" ? 2000 : key === "phone" ? 50 : key === "email" ? 254 : 300} type={key === "email" ? "email" : key === "phone" ? "tel" : key === "website" ? "url" : "text"} />
            </label>)}
            <label className="block text-sm font-medium">Disposition
              <select className={control} value={draft.sdrStatus} onChange={e => change("sdrStatus", e.target.value)}>
                {!SDR_STATUSES.some(s => s.value === draft.sdrStatus) && <option value={draft.sdrStatus}>{draft.sdrStatus} (existing)</option>}
                {SDR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Segment
              <select className={control} value={draft.segment} onChange={e => change("segment", e.target.value)}>
                {["active", "won", "trashed"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">Notes
            <textarea className={`${control} min-h-36`} value={draft.notes} maxLength={20000} onChange={e => change("notes", e.target.value)} />
          </label>
          <p className="text-sm text-muted">One shared notes field, not a timestamped note history. Save before leaving this page.</p>
        </fieldset>
        {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
        <p role="status" className="text-sm">{message || (saving ? "Saving lead…" : Object.keys(draft).some(key => draft[key] !== saved[key]) ? "Unsaved changes" : "")}</p>
        <button className={button} disabled={saving} type="submit">{saving ? "Saving…" : "Save lead"}</button>
      </form>
    </section>
    <LeadOrganizers leadId={lead.id} />
    <LeadFollowUps leadId={lead.id} initialTasks={initialTasks} currentUserId={currentUserId} />
  </div>;
}
