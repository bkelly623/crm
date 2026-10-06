import type { BrowserDialer } from "./browser-dialer";
import { REVIEW_SESSION_LIMIT } from "@/lib/leads/review";
interface Dependencies {
  selection: () => { listId: string; callerIdSid: string };
  available?: () => boolean;
  // Save edited disposition before returning the next lead. Null means exhausted.
  next: (advance: boolean) => Promise<string | null>;
}
export class SequentialSession {
  snapshot = { active: false, error: "" };
  private epoch = 0;
  private dead = false;
  private working?: { preparing: boolean };
  private armed = false;
  private selected?: ReturnType<Dependencies["selection"]>;
  private attempted = new Set<string>();
  private advancedIntents = new Set<string>();
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  constructor(private dialer: BrowserDialer, private deps: Dependencies) {
    this.unsubscribe = dialer.subscribe(() => this.observe());
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<typeof this.snapshot>) {
    if (this.dead) return;
    this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(fn => fn());
  }
  stop(error = "") {
    ++this.epoch;
    this.armed = false;
    // Only preflight can be detached. Queue/save and intent work must finish
    // before another Start, even when their session epoch is no longer valid.
    const preparing = this.working?.preparing;
    if (preparing) this.working = undefined;
    this.set({ active: false, error });
    if (preparing && this.dialer.snapshot.preparing && !this.dialer.snapshot.locked) this.dialer.interrupt();
    // Deliberately do NOT interrupt an active call, wrap up, or release any call lock.
  }
  private valid(epoch: number) {
    if (this.dead || !this.snapshot.active || epoch !== this.epoch) return false;
    if (this.deps.available?.() === false) { this.stop("Keep this page visible and online; start again explicitly."); return false; }
    const current = this.deps.selection();
    if (current.listId !== this.selected?.listId || current.callerIdSid !== this.selected?.callerIdSid) {
      this.stop("Selection changed. Start again explicitly."); return false;
    }
    return true;
  }
  async start() {
    if (this.dead || this.snapshot.active || this.working || this.dialer.snapshot.locked) return;
    if (this.deps.available?.() === false) { this.stop("Keep this page visible and online; start again explicitly."); return; }
    const selected = this.deps.selection();
    if (!selected.listId || !selected.callerIdSid) return;
    this.selected = { ...selected };
    const epoch = ++this.epoch;
    this.set({ active: true, error: "" });
    await this.run(false, epoch);
  }
  private async run(advance: boolean, epoch: number) {
    const work = { preparing: false };
    this.working = work;
    try {
      if (this.attempted.size >= REVIEW_SESSION_LIMIT) throw new Error("Session limit reached. Reload to explicitly start a new session.");
      if (advance) {
        const voice = this.dialer.snapshot;
        if (!voice.terminalProof || !voice.autoAdvanceSafe || voice.phase !== "wrapup") throw new Error("Call needs manual review before another call.");
      } else if (!this.dialer.snapshot.ready) {
        work.preparing = true;
        await this.dialer.prepare();
        work.preparing = false;
      }
      if (!this.valid(epoch)) return;
      if (!this.dialer.snapshot.ready) throw new Error("Audio unavailable. Start again explicitly after resolving the error.");
      let leadId = await this.deps.next(advance);
      if (!this.valid(epoch)) return;
      // Explicit restart after manual settlement skips this mounted session's
      // attempted lead rather than deadlocking or silently redialing it.
      if (!advance && leadId && this.attempted.has(leadId)) {
        leadId = await this.deps.next(true);
        if (!this.valid(epoch)) return;
      }
      if (!leadId) { this.stop(); return; }
      if (this.attempted.has(leadId)) throw new Error("Lead already attempted in this session. Select the next lead; no automatic retry.");
      if (advance) this.dialer.wrapUp();
      if (!this.valid(epoch) || this.dialer.snapshot.locked) return;
      this.attempted.add(leadId); this.armed = true;
      await this.dialer.start(leadId, this.selected!.callerIdSid);
    } catch (error) { if (!this.dead && epoch === this.epoch) this.stop(error instanceof Error ? error.message : "Session stopped. Resolve the error and start explicitly."); }
    finally {
      // A detached preparation may settle after a fresh run has taken over.
      if (this.working === work) { this.working = undefined; this.observe(); }
    }
  }
  private observe() {
    if (!this.snapshot.active || this.dead) return;
    const voice = this.dialer.snapshot;
    if (voice.error || (this.armed && (!voice.autoAdvanceSafe || !voice.ready || voice.pollingPaused))) {
      this.stop("Session paused. Resolve the call/audio error; restarting requires your action."); return;
    }
    if (voice.phase === "wrapup" && !voice.terminalProof) { this.stop("Automatic next call needs both terminal legs. Review this call manually."); return; }
    if (this.working || !this.armed || voice.phase !== "wrapup" || !voice.terminalProof) return;
    const intentId = this.dialer.terminalIntentId;
    if (!intentId || this.advancedIntents.has(intentId)) return;
    const epoch = this.epoch;
    if (!this.valid(epoch)) return;
    // Bound by the same session attempt limit. A duplicate old proof received
    // during the next issuance must not be adopted as that new call's completion.
    this.advancedIntents.add(intentId);
    // Consume this call's continuation before starting asynchronous save/queue
    // work. Duplicate notifications cannot advance twice; no pacing timer or retry.
    this.armed = false;
    void this.run(true, epoch);
  }
  dispose() { this.stop(); this.dead = true; this.unsubscribe(); this.listeners.clear(); }
}
