import { afterEach, expect, it, vi } from "vitest";
import { BrowserDialer } from "@/components/dialer/browser-dialer";
import { SequentialSession } from "@/components/dialer/sequential-session";
const terminal = { id: "intent", leadId: "lead-1", state: "terminal", parentStatus: "completed", childStatus: "completed", finishedAt: null, expiresAt: "2026", locked: false, canStartNewIntent: true, recording: "do-not-record" };
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.useRealTimers(); });
async function fixture() {
  vi.useFakeTimers();
  let intent: unknown = null;
  const events: Record<string, () => void> = {}, deviceEvents: Record<string, () => void> = {};
  const call = { on: vi.fn((event: string, cb: () => void) => { events[event] = cb; }), disconnect: vi.fn(), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn((event: string, cb: () => void) => { deviceEvents[event] = cb; }), connect: vi.fn(async () => call), destroy: vi.fn(), updateToken: vi.fn() };
  const microphone = vi.fn(async () => {});
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes("token")) return Response.json({ token: "fixture" });
    if (String(url).endsWith("/reconcile")) return Response.json({ intent });
    if (init?.method === "POST") return Response.json({ intent: { id: "intent" }, callingAvailable: true, recording: "do-not-record" });
    return Response.json({ intent });
  });
  const dialer = new BrowserDialer({ microphone, createDevice: vi.fn(async () => device), schedule: () => 1 as unknown as ReturnType<typeof setTimeout>, cancel: vi.fn(), fetch: fetcher });
  await dialer.recover();
  const next = vi.fn().mockResolvedValueOnce("lead-1").mockResolvedValue("lead-2");
  const selection = { listId: "list", callerIdSid: "PN-fixture" };
  const session = new SequentialSession(dialer, { selection: () => selection, next });
  cleanups.push(() => { session.dispose(); dialer.dispose(); });
  return { session, dialer, device, call, events, deviceEvents, next, microphone, fetcher, selection,
    settle: async (patch = {}) => { intent = { ...terminal, ...patch }; await dialer.check(); } };
}
it("explicit start prepares audio and calls once, then waits five seconds after server wrapup", async () => {
  const f = await fixture(); expect(f.device.connect).not.toHaveBeenCalled();
  await Promise.all([f.session.start(), f.session.start()]); expect(f.device.connect).toHaveBeenCalledTimes(1);
  f.events.disconnect(); await vi.advanceTimersByTimeAsync(10000); expect(f.device.connect).toHaveBeenCalledTimes(1);
  await f.settle(); expect(f.session.snapshot.countdown).toBe(5);
  await f.settle(); // duplicate status must not create a second timer
  await vi.advanceTimersByTimeAsync(4999); expect(f.device.connect).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(f.next).toHaveBeenLastCalledWith(true);
});
it.each(["parentStatus", "childStatus"])("does not count down with nonterminal %s even if server says released", async field => {
  const f = await fixture(); await f.session.start(); await f.settle({ [field]: "in-progress" });
  await vi.advanceTimersByTimeAsync(20000); expect(f.session.snapshot.countdown).toBe(0); expect(f.device.connect).toHaveBeenCalledTimes(1); expect(f.session.snapshot.active).toBe(false);
});
it.each([
  ["failed parent", { parentStatus: "failed" }],
  ["canceled parent", { parentStatus: "canceled" }],
  ["canceled child", { childStatus: "canceled" }],
  ["canceled intent", { state: "canceled" }],
])("server %s stops automation without an SDK error, even after successful reconcile", async (_label, patch) => {
  const f = await fixture(); await f.session.start(); await f.settle(patch);
  expect(f.dialer.snapshot.terminalProof).toBe(true);
  expect(f.dialer.snapshot.phase).toBe("wrapup");
  expect(f.dialer.snapshot.autoAdvanceSafe).toBe(false);
  expect(f.dialer.snapshot.error).not.toBe("");
  expect(f.session.snapshot.active).toBe(false);
  expect(f.session.snapshot.error).not.toBe("");
  await vi.advanceTimersByTimeAsync(20000);
  await f.settle(); await f.dialer.reconcile();
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.dialer.snapshot.autoAdvanceSafe).toBe(false);
  expect(f.session.snapshot.countdown).toBe(0);
  expect(f.session.snapshot.active).toBe(false);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST")).toHaveLength(1);
  expect(f.dialer.snapshot.locked).toBe(true);
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(false);
});
it.each(["completed", "failed", "busy", "no-answer"])("settled recipient outcome %s permits terminal continuation", async childStatus => {
  const f = await fixture(); await f.session.start(); await f.settle({ childStatus });
  expect(f.session.snapshot.countdown).toBe(5);
  await vi.advanceTimersByTimeAsync(5000);
  expect(f.device.connect).toHaveBeenCalledTimes(2);
});
it.each(["active", "countdown", "queue"])("Stop immediately prevents future calls during %s without releasing or hanging up", async stage => {
  const f = await fixture(); await f.session.start();
  let resolve!: (s: string) => void;
  if (stage !== "active") await f.settle();
  if (stage === "queue") { f.next.mockImplementation(() => new Promise(r => { resolve = r; })); await vi.advanceTimersByTimeAsync(5000); }
  f.session.stop();
  if (stage === "queue") resolve("lead-2");
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.device.connect).toHaveBeenCalledTimes(1); expect(f.call.disconnect).not.toHaveBeenCalled(); expect(f.dialer.snapshot.locked).toBe(true);
  expect(f.session.snapshot.active).toBe(false);
});
it("Stop during pending microphone prevents late first call", async () => {
  const f = await fixture(); let resolve!: () => void;
  f.microphone.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = f.session.start(); f.session.stop(); resolve(); await pending;
  expect(f.next).not.toHaveBeenCalled(); expect(f.device.connect).not.toHaveBeenCalled();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
it.each(["resolve", "reject"] as const)("fresh Start after interrupted microphone prepares again; old %s cannot affect the new run", async outcome => {
  const f = await fixture();
  const oldMic = deferred<void>(), newMic = deferred<void>(), queue = deferred<string>();
  f.microphone.mockImplementationOnce(() => oldMic.promise).mockImplementationOnce(() => newMic.promise);
  f.next.mockReset().mockImplementation(() => queue.promise);
  const oldRun = f.session.start();
  f.dialer.interrupt();
  f.session.stop("Session paused by browser interruption. Start again explicitly.");
  const newRun = f.session.start();
  expect(f.microphone).toHaveBeenCalledTimes(2);
  expect(f.dialer.snapshot.preparing).toBe(true);
  expect(f.session.snapshot.active).toBe(true);
  if (outcome === "resolve") oldMic.resolve(); else oldMic.reject(new Error("old permission denied"));
  await oldRun;
  expect(f.dialer.snapshot.preparing).toBe(true);
  expect(f.dialer.snapshot.error).toBe("");
  expect(f.session.snapshot).toEqual({ active: true, countdown: 0, error: "" });
  expect(f.next).not.toHaveBeenCalled();
  expect(f.device.connect).not.toHaveBeenCalled();
  newMic.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.next).toHaveBeenCalledTimes(1);
  // A stale finally must not unlock the new queue/save operation for replay.
  f.session.stop(); await f.session.start();
  expect(f.session.snapshot.active).toBe(false);
  expect(f.next).toHaveBeenCalledTimes(1);
  queue.resolve("lead-1"); await newRun;
  expect(f.device.connect).not.toHaveBeenCalled();
  await f.session.start();
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.dialer.snapshot.locked).toBe(true);
});
it.each(["resolve", "reject"] as const)("old microphone %s cannot release a newer active call or replay its saved queue", async outcome => {
  const f = await fixture();
  const oldMic = deferred<void>(), save = deferred<string>();
  f.microphone.mockImplementationOnce(() => oldMic.promise);
  const oldRun = f.session.start();
  f.dialer.interrupt(); f.session.stop();
  await f.session.start();
  expect(f.microphone).toHaveBeenCalledTimes(2);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.dialer.snapshot.locked).toBe(true);
  const voiceBefore = { ...f.dialer.snapshot };
  if (outcome === "resolve") oldMic.resolve(); else oldMic.reject(new Error("old permission denied"));
  await oldRun;
  expect(f.dialer.snapshot).toEqual(voiceBefore);
  expect(f.session.snapshot).toEqual({ active: true, countdown: 0, error: "" });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.call.disconnect).not.toHaveBeenCalled();
  expect(f.device.destroy).not.toHaveBeenCalled();
  f.next.mockImplementation(() => save.promise);
  await f.settle(); await vi.advanceTimersByTimeAsync(5000);
  expect(f.next).toHaveBeenCalledTimes(2);
  expect(f.next).toHaveBeenLastCalledWith(true);
  f.session.stop();
  // Even manual terminal wrap-up cannot permit replay of an unsettled save.
  f.dialer.wrapUp(); await f.session.start();
  expect(f.session.snapshot.active).toBe(false);
  expect(f.next).toHaveBeenCalledTimes(2);
  save.resolve("lead-2"); await vi.advanceTimersByTimeAsync(20000);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.session.snapshot.countdown).toBe(0);
});
it("Stop detaches only microphone preparation so a fresh explicit Start can prepare", async () => {
  const f = await fixture(); const mic = deferred<void>();
  f.microphone.mockImplementationOnce(() => mic.promise);
  const oldRun = f.session.start(); f.session.stop();
  expect(f.dialer.snapshot.preparing).toBe(false);
  await f.session.start();
  expect(f.microphone).toHaveBeenCalledTimes(2);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  mic.resolve(); await oldRun;
  expect(f.next).toHaveBeenCalledTimes(1);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.dialer.snapshot.locked).toBe(true);
});
it("Stop retains intent-issuance exclusion and never retries a pending request", async () => {
  const f = await fixture(); const issued = deferred<Response>();
  f.fetcher.mockImplementation(async (url, init) => {
    if (init?.method === "POST") return issued.promise;
    if (String(url).includes("token")) return Response.json({ token: "fixture" });
    return Response.json({ intent: null });
  });
  const pending = f.session.start(); await vi.advanceTimersByTimeAsync(0);
  f.session.stop(); await f.session.start();
  expect(f.dialer.snapshot.locked).toBe(true);
  expect(f.next).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  issued.resolve(Response.json({}, { status: 409 })); await pending;
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.session.snapshot.active).toBe(false);
  expect(f.dialer.snapshot.locked).toBe(true);
  expect(f.device.connect).not.toHaveBeenCalled();
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it.each(["error", "reconnecting"])("never automatically resumes after SDK %s then successful reconciliation", async event => {
  const f = await fixture(); await f.session.start(); f.events[event](); await f.settle();
  await vi.advanceTimersByTimeAsync(20000); expect(f.session.snapshot.active).toBe(false); expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it.each(["cancel", "reject"])("SDK %s immediately stops automation and cannot rearm after successful reconcile", async event => {
  const f = await fixture(); await f.session.start(); f.events[event]();
  expect(f.dialer.snapshot.autoAdvanceSafe).toBe(false);
  expect(f.dialer.snapshot.error).not.toBe("");
  expect(f.dialer.snapshot.locked).toBe(true);
  expect(f.dialer.snapshot.terminalProof).toBe(false);
  expect(f.session.snapshot.active).toBe(false);
  expect(f.session.snapshot.error).not.toBe("");
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(true);
  await vi.advanceTimersByTimeAsync(20000);
  await f.settle(); await f.dialer.reconcile();
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.dialer.snapshot.terminalProof).toBe(true);
  expect(f.dialer.snapshot.autoAdvanceSafe).toBe(false);
  expect(f.session.snapshot.active).toBe(false);
  expect(f.session.snapshot.countdown).toBe(0);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST")).toHaveLength(1);
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(false);
});
it.each(["interrupt", "dispose"])("%s cancels a pending countdown", async action => {
  const f = await fixture(); await f.session.start(); await f.settle();
  if (action === "dispose") f.session.dispose(); else f.dialer.interrupt();
  await vi.advanceTimersByTimeAsync(20000); expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("queue/save failure stops without retry or losing the server hold", async () => {
  const f = await fixture(); await f.session.start(); f.next.mockRejectedValue(new Error("save failed")); await f.settle();
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.next).toHaveBeenCalledTimes(2); expect(f.device.connect).toHaveBeenCalledTimes(1); expect(f.dialer.snapshot.locked).toBe(true);
  expect(f.session.snapshot.error).toContain("save failed");
});
it("mic failure requires an explicit new start", async () => {
  const f = await fixture(); f.microphone.mockRejectedValue(new Error("denied")); await f.session.start();
  await vi.advanceTimersByTimeAsync(60000); expect(f.microphone).toHaveBeenCalledTimes(1); expect(f.device.connect).not.toHaveBeenCalled(); expect(f.session.snapshot.active).toBe(false);
});
it("intent failure never retries even after authoritative terminal recovery", async () => {
  const f = await fixture(); f.fetcher.mockImplementation(async (_url, init) => init?.method === "POST" ? Response.json({}, { status: 409 }) : Response.json({ token: "fixture" }));
  await f.session.start(); await vi.advanceTimersByTimeAsync(60000);
  expect(f.device.connect).not.toHaveBeenCalled(); expect(f.session.snapshot.active).toBe(false);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("selection changes and duplicate leads never dial", async () => {
  const f = await fixture(); await f.session.start(); await f.settle(); f.selection.callerIdSid = "changed";
  await vi.advanceTimersByTimeAsync(10000); expect(f.device.connect).toHaveBeenCalledTimes(1);
  f.dialer.wrapUp(); f.next.mockResolvedValue("lead-1"); await f.session.start();
  expect(f.device.connect).toHaveBeenCalledTimes(1); expect(f.session.snapshot.error).toContain("already attempted");
});
it("stops at 100 attempts without evicting IDs or making an over-limit queue request", async () => {
  const f = await fixture(); let index = 0;
  f.next.mockReset().mockImplementation(async () => `lead-${++index}`);
  await f.session.start();
  for (let i = 0; i < 100; i++) { await f.settle(); await vi.advanceTimersByTimeAsync(5000); }
  expect(f.device.connect).toHaveBeenCalledTimes(100); expect(f.next).toHaveBeenCalledTimes(100);
  expect(f.session.snapshot.active).toBe(false); expect(f.session.snapshot.error).toContain("limit");
});
it("exhausted queue stops without inventing another call", async () => {
  const f = await fixture(); await f.session.start(); f.next.mockResolvedValue(null); await f.settle();
  await vi.advanceTimersByTimeAsync(5000); expect(f.session.snapshot.active).toBe(false); expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("token refresh error during countdown requires manual recovery", async () => {
  const f = await fixture(); await f.session.start(); await f.settle();
  f.fetcher.mockResolvedValue(Response.json({}, { status: 401 })); await f.deviceEvents.tokenWillExpire();
  await vi.advanceTimersByTimeAsync(20000); expect(f.session.snapshot.active).toBe(false); expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("selection invalidation during queue failure stops rather than stranding an active session", async () => {
  const f = await fixture(); await f.session.start(); await f.settle();
  f.next.mockImplementation(async () => { f.selection.listId = ""; throw new Error("queue rejected selection"); });
  await vi.advanceTimersByTimeAsync(5000);
  expect(f.session.snapshot.active).toBe(false); expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("does not automatically adopt a recovered terminal call", async () => {
  const f = await fixture(); await f.settle(); await f.session.start();
  await vi.advanceTimersByTimeAsync(60000); expect(f.device.connect).not.toHaveBeenCalled(); expect(f.session.snapshot.active).toBe(false);
});
