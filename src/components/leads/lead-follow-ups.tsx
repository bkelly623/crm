"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { followUpSchema } from "@/lib/leads/validation";
import type { WorkspaceTask } from "./lead-workspace";
const control = "min-h-11 w-full min-w-0 rounded-lg border border-border px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary";
const button = "min-h-11 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary";
export function LeadFollowUps({ leadId, initialTasks, currentUserId }: { leadId: string; initialTasks: WorkspaceTask[]; currentUserId: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function add(event: FormEvent) {
    event.preventDefault();
    if (adding || completing) return;
    setError(""); setMessage("");
    const date = new Date(due);
    const parsed = followUpSchema.safeParse({ leadId, note, dueAt: Number.isFinite(date.getTime()) ? date.toISOString() : "" });
    if (!parsed.success) { setError("Enter a follow-up note (up to 2000 characters) and valid due date and time."); return; }
    setAdding(true);
    try {
      const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) throw new Error("Failed");
      const { task } = await response.json();
      setTasks(previous => [...previous, task].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()));
      setNote(""); setDue(""); setMessage("Follow-up created.");
    } catch { setError("Could not create follow-up. Your input is kept; please retry."); }
    finally { setAdding(false); }
  }
  async function complete(id: string) {
    if (adding || completing) return;
    setError(""); setMessage(""); setCompleting(id);
    try {
      const response = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed" }) });
      if (!response.ok || (await response.json()).updated !== 1) throw new Error("Not updated");
      setTasks(previous => previous.filter(task => task.id !== id)); setMessage("Follow-up completed.");
    } catch { setError("Could not complete follow-up. It may no longer be accessible; retry or reload after saving your lead edits."); }
    finally { setCompleting(null); }
  }
  return <section className="min-w-0 rounded-xl border border-border bg-white p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Open follow-ups ({tasks.length})</h2>
    <form onSubmit={add} noValidate className="mt-4 space-y-4" aria-busy={adding}>
      <fieldset disabled={adding || completing !== null} className="min-w-0 space-y-4">
        <label className="block text-sm font-medium">Follow-up note
          <textarea className={`${control} min-h-24`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} />
        </label>
        <label className="block min-w-0 text-sm font-medium">Due date and time
          <input className={control} type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
        </label>
        <p className="text-sm text-muted">Enter times in this device’s local timezone; saved due times are shown in UTC. New follow-ups are assigned to you.</p>
        <button className={button} disabled={adding || completing !== null} type="submit">{adding ? "Adding…" : "Add follow-up"}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <p role="status" className="mt-3 text-sm">{message}</p>
    {tasks.length === 0 ? <p className="mt-3 text-sm text-muted">No open follow-ups.</p> : <ul className="mt-4 space-y-3">
      {tasks.map(task => <li key={task.id} className="min-w-0 rounded-lg border border-border p-3">
        <p className="whitespace-pre-wrap break-words">{task.note}</p>
        <p className="my-2 text-sm text-muted">Due <time dateTime={task.dueAt}>{new Date(task.dueAt).toISOString().slice(0, 16).replace("T", " ")} UTC</time></p>
        {task.userId === currentUserId ? <button type="button" className={button} disabled={adding || completing !== null} aria-label={`Complete ${task.note}`} onClick={() => complete(task.id)}>{completing === task.id ? "Completing…" : "Complete"}</button> : <p className="text-sm text-muted">Assigned to another team member; only the owner can complete.</p>}
      </li>)}
    </ul>}
  </section>;
}
