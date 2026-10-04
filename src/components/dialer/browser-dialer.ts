import { z } from "zod";
const intentSchema = z.object({
  id: z.string().min(1), leadId: z.string().min(1), state: z.enum(["issued", "dialing", "ringing", "connected", "uncertain", "terminal", "expired", "canceled"]),
  expiresAt: z.string(), parentStatus: z.string().nullable(), childStatus: z.string().nullable(), finishedAt: z.string().nullable(),
  locked: z.boolean(), canStartNewIntent: z.boolean(), recording: z.literal("do-not-record"),
});
type Intent = z.infer<typeof intentSchema>;
export interface DialerDependencies {
  fetch: typeof fetch;
  microphone: () => Promise<void>;
  createDevice: (token: string) => Promise<VoiceDevice>;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
}
export interface VoiceCall {
  on(event: string, listener: () => void): unknown;
  disconnect(): void;
  mute(muted: boolean): void;
  sendDigits(digits: string): void;
}
export interface VoiceDevice {
  on(event: string, listener: () => void): unknown;
  connect(options: { params: { IntentId: string } }): Promise<VoiceCall>;
  updateToken(token: string): void;
  destroy(): void;
}
export class BrowserDialer {
  snapshot = { locked: true, ready: false, phase: "recovering", error: "", muted: false, hasCall: false, preparing: false, checking: false, pollingPaused: false, autoAdvanceSafe: false, terminalProof: false };
  private device?: VoiceDevice;
  private call?: VoiceCall;
  private intent?: Intent;
  private intentId?: string;
  private issuanceAttempted = false;
  private dead = false;
  private generation = 0;
  private refreshing = false;
  private timer?: ReturnType<typeof setTimeout>;
  private polls = 0;
  private requests = new Set<AbortController>();
  private listeners = new Set<() => void>();
  constructor(private deps: DialerDependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private set(patch: Partial<typeof this.snapshot>) {
    if (this.dead) return;
    this.snapshot = { ...this.snapshot, ...patch, ...(patch.error ? { autoAdvanceSafe: false } : {}) }; this.listeners.forEach(fn => fn());
  }
  private async request(path: string, options: RequestInit = {}) {
    const abort = new AbortController(); this.requests.add(abort);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("Request timed out")); }, 12000); });
    try {
      return await Promise.race([(async () => {
        const response = await this.deps.fetch(path, { credentials: "same-origin", cache: "no-store", ...options, signal: abort.signal });
        if (!response.ok) throw new Error();
        return response.json();
      })(), timeout]);
    } finally { clearTimeout(timer); this.requests.delete(abort); }
  }
  private async token() {
    const { token } = await this.request("/api/twilio/token");
    if (typeof token !== "string" || !token) throw new Error();
    return token;
  }
  async prepare() {
    if (this.dead || this.snapshot.preparing || this.snapshot.locked) return;
    this.set({ preparing: true, ready: false, error: "" });
    const generation = ++this.generation;
    try {
      await this.deps.microphone();
      if (this.dead || generation !== this.generation) return;
      const token = await this.token();
      if (this.dead || generation !== this.generation) return;
      const device = await this.deps.createDevice(token);
      if (this.dead || generation !== this.generation) { device.destroy(); return; }
      this.device?.destroy(); this.device = device;
      device.on("tokenWillExpire", async () => {
        if (this.dead || this.device !== device || this.refreshing) return;
        this.refreshing = true;
        try {
          const token = await this.token();
          if (!this.dead && this.device === device) device.updateToken(token);
        } catch {
          this.set({ ready: false, error: "Calling unavailable: token refresh failed. Check your sign-in and prepare again after wrap-up." });
          if (this.snapshot.locked) this.uncertain();
        } finally { this.refreshing = false; }
      });
      device.on("error", () => { if (!this.dead && this.device === device) { this.set({ ready: false, error: "Browser audio unavailable. Prepare again before calling." }); if (this.snapshot.locked) this.uncertain(); } });
      this.set({ ready: true, phase: "ready", error: "" });
    } catch { if (!this.dead && generation === this.generation) this.set({ ready: false, error: "Calling unavailable. Check microphone permission, HTTPS and server configuration." }); }
    finally { if (!this.dead && generation === this.generation) this.set({ preparing: false }); }
  }
  async start(leadId: string, callerIdSid: string) {
    if (this.dead || !this.device || !this.snapshot.ready || this.snapshot.locked || !leadId || !callerIdSid) return;
    const device = this.device, generation = ++this.generation;
    this.polls = 0; this.issuanceAttempted = true;
    this.set({ locked: true, phase: "dialing", error: "", muted: false, pollingPaused: false, autoAdvanceSafe: true, terminalProof: false });
    try {
      const data = await this.request("/api/dialer/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, callerIdSid }) });
      if (this.dead || generation !== this.generation) return;
      if (typeof data.intent?.id !== "string" || !data.intent.id || data.recording !== "do-not-record" || data.callingAvailable !== true) throw new Error();
      this.intentId = data.intent.id;
      const call = await device.connect({ params: { IntentId: data.intent.id } });
      if (this.dead || generation !== this.generation) { call.disconnect(); return; }
      this.call = call; this.set({ hasCall: true });
      const current = () => !this.dead && generation === this.generation && this.call === call;
      // Parent accept is not evidence that the recipient answered.
      call.on("accept", () => { if (current()) this.poll(); });
      for (const event of ["error", "reconnecting"]) call.on(event, () => { if (current()) { this.set({ ready: false }); this.uncertain(); this.poll(); } });
      for (const event of ["disconnect", "cancel", "reject"]) call.on(event, () => {
        if (!current()) return;
        this.call = undefined;
        this.set({ hasCall: false, locked: true, phase: "reconciling", ...(event !== "disconnect" ? { error: "Browser call was canceled or rejected. Check server status before starting again manually." } : {}) });
        this.poll();
      });
      this.poll();
    } catch { if (!this.dead && generation === this.generation) { this.uncertain(); this.poll(); } }
  }
  private uncertain() { this.set({ locked: true, phase: "reconciling", error: "Call state uncertain. Check server status; do not retry dialing." }); }
  private apply(value: unknown) {
    const intent = intentSchema.parse(value);
    if (this.intentId && intent.id !== this.intentId) throw new Error();
    this.intent = intent; this.intentId = intent.id;
    const proven = intent.canStartNewIntent === true && !intent.locked && ["terminal", "expired", "canceled"].includes(intent.state);
    const terminal = (status: string | null) => status !== null && ["completed", "busy", "failed", "no-answer", "canceled"].includes(status);
    // Terminal release proves the lease is settled, not that continuing is safe.
    const failed = intent.state === "canceled" || [intent.parentStatus, intent.childStatus].some(status => status === "failed" || status === "canceled");
    this.set({ locked: true, terminalProof: proven && terminal(intent.parentStatus) && terminal(intent.childStatus), phase: proven ? "wrapup" : intent.state === "connected" && intent.childStatus === "in-progress" ? "connected" : intent.state === "ringing" ? "ringing" : "reconciling", error: failed ? "Call failed or was canceled. Review the call before starting again manually." : "" });
  }
  wrapUp() {
    if (this.dead || this.snapshot.phase !== "wrapup" || !this.intent?.canStartNewIntent || this.intent.locked) return;
    ++this.generation; this.stopPoll();
    this.call?.disconnect(); this.call = undefined;
    this.intent = undefined; this.intentId = undefined; this.issuanceAttempted = false;
    this.set({ locked: false, hasCall: false, muted: false, phase: this.snapshot.ready ? "ready" : "review" });
  }
  async check(reconcile = false) {
    if (this.dead || this.snapshot.checking) return;
    this.set({ checking: true });
    const generation = this.generation;
    try {
      const path = this.intentId ? `/api/dialer/intents/${encodeURIComponent(this.intentId)}${reconcile ? "/reconcile" : ""}` : "/api/dialer/intents";
      const data = await this.request(path, reconcile && this.intentId ? { method: "POST" } : {});
      if (this.dead || generation !== this.generation) return;
      if (data.intent === null && !this.intentId && !this.issuanceAttempted) this.set({ locked: false, phase: this.snapshot.ready ? "ready" : "review", error: "" });
      else this.apply(data.intent);
    } catch { if (!this.dead && generation === this.generation) this.uncertain(); }
    finally { this.set({ checking: false }); }
  }
  async recover() { await this.check(); this.poll(); }
  async reconcile() { await this.check(true); }
  private stopPoll() { if (this.timer !== undefined) this.deps.cancel(this.timer); this.timer = undefined; }
  private poll() {
    if (this.dead || this.timer !== undefined || !this.snapshot.locked || this.snapshot.phase === "wrapup") return;
    if (this.polls >= 8) { this.set({ pollingPaused: true }); return; }
    const delay = Math.min(1000 * 2 ** this.polls++, 15000);
    this.timer = this.deps.schedule(async () => { this.timer = undefined; await this.check(); this.poll(); }, delay);
  }
  mute() { if (this.call) { try { this.call.mute(!this.snapshot.muted); this.set({ muted: !this.snapshot.muted }); } catch { this.uncertain(); } } }
  digits(digits: string) { if (this.call && /^[0-9*#w]{1,32}$/.test(digits)) { try { this.call.sendDigits(digits); } catch { this.uncertain(); } } }
  hangUp() {
    if (!this.snapshot.locked) return;
    if (this.call) {
      try { this.call.disconnect(); } catch { /* Remain held if local teardown fails. */ }
    } else if (this.device) {
      ++this.generation;
      try { this.device.destroy(); } catch { /* Provider state still requires reconciliation. */ }
      this.device = undefined; this.set({ ready: false });
    }
    this.uncertain(); this.poll();
  }
  interrupt() {
    ++this.generation; this.stopPoll();
    const audioInterrupted = this.snapshot.preparing || this.snapshot.ready;
    this.set({ ready: false, preparing: false });
    if (this.snapshot.locked) this.uncertain();
    else if (audioInterrupted) this.set({ phase: "review", error: "Browser audio preparation interrupted. Keep this page visible and prepare browser calling again." });
  }
  dispose() {
    if (this.dead) return;
    this.dead = true; ++this.generation; this.stopPoll(); this.listeners.clear();
    this.requests.forEach(request => request.abort()); this.requests.clear();
    try { this.call?.disconnect(); } finally { this.device?.destroy(); }
    // Local teardown NEVER releases a server lease.
  }
}
