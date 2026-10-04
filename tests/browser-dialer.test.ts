import { describe, expect, it, vi } from "vitest";
import { BrowserDialer, type DialerDependencies } from "@/components/dialer/browser-dialer";
const reply = (data: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => data } as Response);
function fixture() {
  const fetcher = vi.fn< typeof fetch >(() => reply({ intent: null }));
  const deps = { fetch: fetcher, microphone: vi.fn(async () => undefined), createDevice: vi.fn(), schedule: vi.fn(), cancel: vi.fn() } as unknown as DialerDependencies;
  return { dialer: new BrowserDialer(deps), fetcher, deps };
}
it("preflights microphone only explicitly, obtains a token, creates intent then connects IntentId only once", async () => {
  const { dialer, fetcher, deps } = fixture();
  const call = { on: vi.fn(), disconnect: vi.fn(), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn(), connect: vi.fn(async () => call), updateToken: vi.fn(), destroy: vi.fn() };
  vi.mocked(deps.createDevice).mockResolvedValue(device);
  await dialer.recover();
  expect(deps.microphone).not.toHaveBeenCalled();
  fetcher.mockImplementation(() => reply({ token: "synthetic-token" }));
  await dialer.prepare();
  expect(deps.microphone).toHaveBeenCalledOnce();
  expect(dialer.snapshot.ready).toBe(true);
  fetcher.mockImplementation(() => reply({ intent: { id: "intent-1", expiresAt: new Date().toISOString() }, callingAvailable: true, recording: "do-not-record" }, 201));
  await Promise.all([dialer.start("lead-1", "PN-fixture"), dialer.start("lead-1", "PN-fixture")]);
  expect(device.connect).toHaveBeenCalledExactlyOnceWith({ params: { IntentId: "intent-1" } });
  expect(JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body))).toEqual({ leadId: "lead-1", callerIdSid: "PN-fixture" });
  expect(dialer.snapshot.locked).toBe(true);
  expect(dialer.snapshot.phase).toBe("dialing");
});
describe("browser dialer recovery", () => {
  it("holds until authenticated no-store recovery proves no intent", async () => {
    const { dialer, fetcher } = fixture();
    expect(dialer.snapshot.locked).toBe(true);
    await dialer.recover();
    expect(fetcher).toHaveBeenCalledWith("/api/dialer/intents", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
    expect(dialer.snapshot.locked).toBe(false);
    expect(dialer.snapshot.ready).toBe(false);
  });
});
const status = (patch = {}) => ({ id: "intent-1", leadId: "lead-1", state: "ringing", expiresAt: "2026-01-01T00:00:00Z", parentStatus: "in-progress", childStatus: "ringing", finishedAt: null, locked: true, canStartNewIntent: false, recording: "do-not-record", ...patch });
it("recovers ringing and requires persisted terminal proof plus manual wrapup", async () => {
  const { dialer, fetcher } = fixture();
  fetcher.mockImplementation(() => reply({ intent: status() }));
  await dialer.recover();
  expect(dialer.snapshot.phase).toBe("ringing");
  dialer.wrapUp(); expect(dialer.snapshot.locked).toBe(true);
  fetcher.mockImplementation(() => reply({ intent: status({ state: "connected", childStatus: "in-progress" }) }));
  await dialer.check(); expect(dialer.snapshot.phase).toBe("connected");
  fetcher.mockImplementation(() => reply({ intent: status({ state: "terminal", parentStatus: "completed", childStatus: "completed", locked: false, canStartNewIntent: true }) }));
  await dialer.check(); expect(dialer.snapshot.phase).toBe("wrapup");
  expect(dialer.snapshot.locked).toBe(true);
  dialer.wrapUp(); expect(dialer.snapshot.locked).toBe(false);
});
it.each([503, 401, 403, 409, 500])("holds recovery failures %s without interpreting them as no intent", async code => {
  const { dialer, fetcher } = fixture(); fetcher.mockImplementation(() => reply({}, code));
  await dialer.recover(); expect(dialer.snapshot.phase).toBe("reconciling"); expect(dialer.snapshot.locked).toBe(true);
});

async function prepared() {
  const f = fixture();
  const events: Record<string, () => void> = {}, deviceEvents: Record<string, () => void> = {};
  const call = { on: vi.fn((e: string, cb: () => void) => { events[e] = cb; }), disconnect: vi.fn(), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn((e: string, cb: () => void) => { deviceEvents[e] = cb; }), connect: vi.fn(async () => call), updateToken: vi.fn(), destroy: vi.fn() };
  vi.mocked(f.deps.createDevice).mockResolvedValue(device);
  await f.dialer.recover();
  f.fetcher.mockImplementation(() => reply({ token: "synthetic-token" })); await f.dialer.prepare();
  f.fetcher.mockImplementation(() => reply({ intent: { id: "intent-1" }, recording: "do-not-record", callingAvailable: true }, 201));
  return { ...f, call, device, events, deviceEvents };
}
it("treats SDK accept as parent only; controls work but disconnect holds, never advances", async () => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture");
  f.events.accept(); expect(f.dialer.snapshot.phase).not.toBe("connected");
  f.dialer.mute(); expect(f.call.mute).toHaveBeenCalledWith(true);
  f.dialer.digits("12#*"); expect(f.call.sendDigits).toHaveBeenCalledWith("12#*");
  f.dialer.digits("bad"); expect(f.call.sendDigits).toHaveBeenCalledTimes(1);
  f.dialer.hangUp(); expect(f.call.disconnect).toHaveBeenCalledOnce();
  f.events.disconnect(); expect(f.dialer.snapshot.locked).toBe(true); expect(f.dialer.snapshot.phase).toBe("reconciling");
  expect(f.device.connect).toHaveBeenCalledOnce();
});
it("ignores late connect and stale SDK events after disposal without releasing lease", async () => {
  const f = await prepared(); let resolve!: (call: typeof f.call) => void;
  f.device.connect.mockImplementation(() => new Promise(r => { resolve = r; }));
  const started = f.dialer.start("lead-1", "PN-fixture"); await vi.waitFor(() => expect(f.device.connect).toHaveBeenCalledOnce());
  f.dialer.dispose(); resolve(f.call); await started;
  expect(f.call.disconnect).toHaveBeenCalledOnce(); expect(f.device.destroy).toHaveBeenCalledOnce();
  expect(f.dialer.snapshot.locked).toBe(true);
});
it("refreshes tokens without reconnecting and holds on refresh failure", async () => {
  const f = await prepared();
  f.fetcher.mockImplementation(() => reply({ token: "refreshed" }));
  await f.deviceEvents.tokenWillExpire();
  expect(f.device.updateToken).toHaveBeenCalledWith("refreshed"); expect(f.device.connect).not.toHaveBeenCalled();
  f.fetcher.mockImplementation(() => reply({}, 401)); await f.deviceEvents.tokenWillExpire();
  expect(f.dialer.snapshot.ready).toBe(false);
});
it("polls with bounded backoff, reconcile sends no body and never retries a dial", async () => {
  const f = fixture(); const timers: { cb: () => void; delay: number }[] = [];
  vi.mocked(f.deps.schedule).mockImplementation((cb, delay) => { timers.push({ cb, delay }); return 1 as unknown as ReturnType<typeof setTimeout>; });
  f.fetcher.mockImplementation(() => reply({ intent: status() })); await f.dialer.recover();
  for (let i = 0; i < 20 && timers[i]; i++) { await timers[i].cb(); }
  expect(timers.length).toBeGreaterThan(1); expect(timers.length).toBeLessThanOrEqual(8);
  expect(f.dialer.snapshot.pollingPaused).toBe(true);
  expect(timers[1].delay).toBeGreaterThan(timers[0].delay);
  expect(f.dialer.snapshot.locked).toBe(true);
  await f.dialer.reconcile();
  expect(f.fetcher).toHaveBeenCalledWith("/api/dialer/intents/intent-1/reconcile", expect.objectContaining({ method: "POST" }));
  expect(f.fetcher.mock.calls.at(-1)?.[1]?.body).toBeUndefined();
});
it("never unlocks an ambiguous issuance from an empty recovery snapshot", async () => {
  const f = await prepared(); f.fetcher.mockRejectedValue(new Error("lost POST response"));
  await f.dialer.start("lead-1", "PN-fixture");
  f.fetcher.mockImplementation(() => reply({ intent: null })); await f.dialer.recover();
  expect(f.dialer.snapshot.locked).toBe(true); expect(f.device.connect).not.toHaveBeenCalled();
});
it("tab/network interruption invalidates pending connection and requires manual recovery", async () => {
  const f = await prepared(); let resolve!: (r: Response) => void;
  f.fetcher.mockImplementation(() => new Promise(r => { resolve = r; }));
  const started = f.dialer.start("lead-1", "PN-fixture");
  f.dialer.interrupt(); resolve(await reply({ intent: { id: "intent-1" }, callingAvailable: true, recording: "do-not-record" }, 201)); await started;
  expect(f.device.connect).not.toHaveBeenCalled(); expect(f.dialer.snapshot.phase).toBe("reconciling");
  expect(f.dialer.snapshot.ready).toBe(false);
});
it("microphone denial and server 503 remain safely unavailable", async () => {
  const f = fixture(); await f.dialer.recover();
  vi.mocked(f.deps.microphone).mockRejectedValue(new Error("denied")); await f.dialer.prepare();
  expect(f.deps.createDevice).not.toHaveBeenCalled(); expect(f.dialer.snapshot.ready).toBe(false);
  vi.mocked(f.deps.microphone).mockResolvedValue(); f.fetcher.mockImplementation(() => reply({}, 503)); await f.dialer.prepare();
  expect(f.deps.createDevice).not.toHaveBeenCalled(); expect(f.dialer.snapshot.locked).toBe(false);
});
it.each(["error", "reconnecting"])("SDK call %s keeps Hang up available while server state is uncertain", async event => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture");
  f.events[event](); expect(f.dialer.snapshot.locked).toBe(true); expect(f.dialer.snapshot.hasCall).toBe(true);
  f.dialer.hangUp(); expect(f.call.disconnect).toHaveBeenCalledOnce();
});
it("old call events cannot relock a manually wrapped session", async () => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture");
  f.fetcher.mockImplementation(() => reply({ intent: status({ locked: false, canStartNewIntent: true, state: "terminal" }) }));
  await f.dialer.check(); f.dialer.wrapUp(); f.events.disconnect();
  expect(f.dialer.snapshot.locked).toBe(false);
});
it("Hang up cancels pending connect locally but retains the server hold", async () => {
  const f = await prepared(); let resolve!: (call: typeof f.call) => void;
  f.device.connect.mockImplementation(() => new Promise(r => { resolve = r; }));
  const started = f.dialer.start("lead-1", "PN-fixture"); await vi.waitFor(() => expect(f.device.connect).toHaveBeenCalledOnce());
  f.dialer.hangUp(); resolve(f.call); await started;
  expect(f.device.destroy).toHaveBeenCalledOnce(); expect(f.call.disconnect).toHaveBeenCalledOnce();
  expect(f.dialer.snapshot.phase).toBe("reconciling"); expect(f.dialer.snapshot.locked).toBe(true);
});
it("bounds a hung status request and keeps the lease uncertain", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture(); f.fetcher.mockImplementation(() => new Promise(() => {}));
    const recovering = f.dialer.recover(); await vi.advanceTimersByTimeAsync(12000); await recovering;
    expect(f.dialer.snapshot.checking).toBe(false); expect(f.dialer.snapshot.locked).toBe(true); expect(f.dialer.snapshot.phase).toBe("reconciling");
    f.dialer.dispose();
  } finally { vi.useRealTimers(); }
});
it("aborts pending status transport on unmount without publishing or releasing", async () => {
  const f = fixture(); let signal: AbortSignal | undefined;
  f.fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => { signal = init?.signal as AbortSignal; signal.addEventListener("abort", () => reject(new Error("aborted"))); }));
  const listener = vi.fn(); f.dialer.subscribe(listener);
  const recovery = f.dialer.recover(); f.dialer.dispose();
  expect(signal?.aborted).toBe(true); await recovery;
  expect(f.dialer.snapshot.locked).toBe(true); expect(listener).toHaveBeenCalledTimes(1);
});
it("auto-next proof requires both terminal legs and never recovers after an error", async () => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture");
  f.fetcher.mockImplementation(() => reply({ intent: status({ state: "terminal", locked: false, canStartNewIntent: true }) }));
  await f.dialer.check(); expect(f.dialer.snapshot.terminalProof).toBe(false);
  f.events.error();
  f.fetcher.mockImplementation(() => reply({ intent: status({ state: "terminal", parentStatus: "completed", childStatus: "completed", locked: false, canStartNewIntent: true }) }));
  await f.dialer.check(); expect(f.dialer.snapshot.terminalProof).toBe(true);
  expect(f.dialer.snapshot.autoAdvanceSafe).toBe(false);
});

it.each([
  { parentStatus: "failed", childStatus: "completed" },
  { parentStatus: "completed", childStatus: "failed" },
  { parentStatus: "canceled", childStatus: "completed" },
  { parentStatus: "completed", childStatus: "canceled" },
])("failed/canceled server legs $parentStatus/$childStatus preserve release proof and manual recovery", async legs => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture");
  f.fetcher.mockImplementation(() => reply({ intent: status({ ...legs, state: "terminal", locked: false, canStartNewIntent: true }) }));
  await f.dialer.check();
  expect(f.dialer.snapshot).toMatchObject({ terminalProof: true, autoAdvanceSafe: false, phase: "wrapup", locked: true });
  expect(f.dialer.snapshot.error).not.toBe("");
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(false);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it.each(["cancel", "reject"])("SDK %s holds until server proof but never restores auto-advance safety", async event => {
  const f = await prepared(); await f.dialer.start("lead-1", "PN-fixture"); f.events[event]();
  expect(f.dialer.snapshot).toMatchObject({ autoAdvanceSafe: false, terminalProof: false, locked: true, hasCall: false });
  expect(f.dialer.snapshot.error).not.toBe("");
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(true);
  f.fetcher.mockImplementation(() => reply({ intent: status({ state: "terminal", parentStatus: "completed", childStatus: "completed", locked: false, canStartNewIntent: true }) }));
  await f.dialer.reconcile();
  expect(f.dialer.snapshot).toMatchObject({ autoAdvanceSafe: false, terminalProof: true, phase: "wrapup" });
  f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(false);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("malformed terminal proof cannot release a still-active status", async () => {
  const f = fixture(); f.fetcher.mockImplementation(() => reply({ intent: status({ state: "connected", childStatus: "in-progress", locked: false, canStartNewIntent: true }) }));
  await f.dialer.recover(); f.dialer.wrapUp(); expect(f.dialer.snapshot.locked).toBe(true);
});
