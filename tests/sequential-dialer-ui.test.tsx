// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DialerPanel } from "@/components/dialer/dialer-panel";
const m = vi.hoisted(() => ({ microphone: vi.fn(), createDevice: vi.fn(), schedule: vi.fn(), cancel: vi.fn() }));
vi.mock("@/components/dialer/voice-sdk-adapter", () => ({ browserDependencies: { ...m, fetch: (...args: Parameters<typeof fetch>) => fetch(...args), schedule: (...args: unknown[]) => m.schedule(...args), cancel: (...args: unknown[]) => m.cancel(...args) } }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
const sid = "PN" + "1".repeat(32);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
async function setup(polling = false) {
  m.schedule.mockImplementation(polling ? (fn: () => void, delay: number) => setTimeout(fn, delay) : () => 1);
  m.cancel.mockImplementation(polling ? clearTimeout : () => undefined);
  m.microphone.mockClear();
  let intent: unknown = null;
  let leadIndex = 0;
  const events = new Map<string, () => void>();
  const call = { on: vi.fn((event: string, fn: () => void) => events.set(event, fn)), disconnect: vi.fn(() => events.get("disconnect")?.()), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn(), connect: vi.fn(async () => call), destroy: vi.fn(), updateToken: vi.fn() };
  m.microphone.mockResolvedValue(undefined); m.createDevice.mockResolvedValue(device);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("lead-organizers/lists")) return Response.json({ items: [{ id: "list-1", name: "Selected list" }], nextCursor: null });
    if (url.includes("numbers")) return Response.json({ numbers: [{ sid, phoneNumber: "+1202" + "5550101", friendlyName: "Office" }], hasMore: false, truncated: false, nextPage: null });
    if (url.includes("next-lead")) return Response.json({ lead: { id: `lead-${++leadIndex}`, businessName: `Business ${leadIndex}`, phone: "+1202" + "5550102", sdrStatus: "no_contact" } });
    if (url.includes("token")) return Response.json({ token: "fixture" });
    if (init?.method === "PATCH") return Response.json({ success: true });
    if (init?.method === "POST" && url === "/api/dialer/intents") return Response.json({ intent: { id: `intent-${leadIndex}` }, callingAvailable: true, recording: "do-not-record" });
    return Response.json({ intent });
  });
  vi.stubGlobal("fetch", fetcher); render(<DialerPanel smartViews={[]} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Load lists" }) as HTMLButtonElement).disabled).toBe(false));
  return { device, call, fetcher, emit: (event: string) => events.get(event)?.(), terminal: (overrides = {}) => { intent = { id: "intent-1", leadId: "lead-1", state: "terminal", parentStatus: "completed", childStatus: "completed", locked: false, canStartNewIntent: true, recording: "do-not-record", expiresAt: "2026", finishedAt: null, ...overrides }; } };
}
async function select() {
  click("Load lists"); await screen.findByRole("option", { name: "Selected list" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: "list-1" } });
  click("Load numbers"); await screen.findByRole("option", { name: /Office/ });
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: sid } });
}
it("explains immediate progression without a countdown or promised wrap-up pause", async () => {
  await setup();
  expect(screen.getByText(/no added inter-call delay/i)).toBeTruthy();
  expect(screen.queryByText(/countdown|5-second pause|This delay provides/)).toBeNull();
});
it("requires explicit list and number; Pause before settlement prevents progression without hanging up", async () => {
  const f = await setup();
  expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(true);
  await select(); click("Start session");
  await waitFor(() => expect(f.device.connect).toHaveBeenCalledTimes(1));
  for (const name of ["Pause", "End session", "Hang up"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  click("Pause");
  vi.useFakeTimers(); f.terminal();
  await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.call.disconnect).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Complete wrap-up" })).toBeTruthy();
});

it("inline shared notes pauses a live session, retains its lead and requires explicit close/resume", async () => {
  const f = await setup(); await select(); click("Start session");
  await waitFor(() => expect(f.device.connect).toHaveBeenCalledTimes(1));
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) => url === "/api/leads/lead-1" && !init?.method ? Promise.resolve(Response.json({ lead: { id: "lead-1", notes: "Existing shared context" } })) : original(url, init));
  click("Notes & follow-up");
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("Existing shared context"));
  expect((screen.getByRole("button", { name: "Hang up current call" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("button", { name: "Mute current call" }).closest("[data-inline-call-toolbar]")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Shared lead notes"), { target: { value: "Existing shared context\nSpoke today" } });
  expect((screen.getByRole("button", { name: "Hang up" }) as HTMLButtonElement).disabled).toBe(false);
  expect(f.call.disconnect).not.toHaveBeenCalled();
  vi.useFakeTimers(); f.terminal();
  await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Next Lead" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { click("Save notes"); });
  const write = f.fetcher.mock.calls.find(([url, init]) => url === "/api/leads/lead-1" && init?.method === "PATCH");
  expect(JSON.parse(String(write?.[1]?.body))).toEqual({ notes: "Existing shared context\nSpoke today" });
  expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(true);
  click("Close notes & follow-up");
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
});

it("opening inline work before settlement stops progression; task drafts and pending note saves cannot advance or change selection", async () => {
  const f = await setup(); await select(); click("Start session");
  await waitFor(() => expect(f.device.connect).toHaveBeenCalledTimes(1));
  const original = f.fetcher.getMockImplementation()!;
  let release!: (r: Response) => void;
  f.fetcher.mockImplementation((url, init) => url === "/api/leads/lead-1" ? init?.method === "PATCH" ? new Promise(r => { release = r; }) : Promise.resolve(Response.json({ lead: { id: "lead-1", notes: "Existing" } })) : original(url, init));
  click("Notes & follow-up");
  f.terminal(); await act(async () => { click("Check server status"); });
  await waitFor(() => expect((screen.getByLabelText("Shared lead notes") as HTMLTextAreaElement).value).toBe("Existing"));
  fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Task draft during call" } });
  fireEvent.change(screen.getByLabelText("Shared lead notes"), { target: { value: "Note draft during call" } });
  click("Save notes");
  for (const label of ["Named list", "Call from", "SmartView"]) expect((screen.getByLabelText(label) as HTMLSelectElement).disabled).toBe(true);
  click("Complete wrap-up");
  expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(true);
  vi.useFakeTimers(); await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).includes("next-lead"))).toHaveLength(1);
  click("Close notes & follow-up");
  await act(async () => release(Response.json({ success: true })));
  expect((screen.getByLabelText("Follow-up note") as HTMLTextAreaElement).value).toBe("Task draft during call");
  expect((screen.getByRole("button", { name: "Close notes & follow-up" }) as HTMLButtonElement).disabled).toBe(true);
  click("Discard follow-up draft"); click("Close notes & follow-up");
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  await act(async () => click("Next Lead"));
  expect(screen.getByText("Business 2")).toBeTruthy();
  await act(async () => click("Start session"));
  expect(f.device.connect).toHaveBeenCalledTimes(2);
});

async function started() {
  const f = await setup(); await select(); click("Start session");
  await waitFor(() => expect(f.device.connect).toHaveBeenCalledTimes(1));
  vi.useFakeTimers();
  return f;
}
function holdNextQueue(f: Awaited<ReturnType<typeof setup>>) {
  let release!: () => void;
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) => String(url).includes("next-lead") ? new Promise(r => {
    release = () => r(Response.json({ lead: { id: "late", businessName: "Late business", sdrStatus: "no_contact" } }));
  }) : original(url, init));
  return () => release();
}
async function settled(f: Awaited<ReturnType<typeof setup>>) {
  f.terminal(); await act(async () => { click("Check server status"); });
  expect(screen.queryByText(/Next call in/)).toBeNull();
}
it("Hang up within a session waits for authoritative settlement then calls next without manual steps", async () => {
  const f = await started();
  click("Hang up");
  expect(f.call.disconnect).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  await settled(f);

  expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(m.microphone).toHaveBeenCalled();
});
it("active session hides manual steps and End session tears down audio without releasing the hold or continuing", async () => {
  const f = await started();
  for (const name of ["Prepare browser calling", "Call", "Save & Next"]) expect(screen.queryByRole("button", { name })).toBeNull();
  expect(screen.getByRole("button", { name: "Hang up" })).toBeTruthy();
  click("End session");
  expect(f.call.disconnect).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(true);
  f.terminal(); await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
  expect(screen.getByRole("button", { name: "Complete wrap-up" })).toBeTruthy();
});
it.each(["prepare", "queue", "connect"])("End session during pending %s ignores late completion", async stage => {
  const f = await setup(); await select();
  let release!: () => void;
  if (stage === "prepare") m.microphone.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
  if (stage === "connect") f.device.connect.mockImplementationOnce(() => new Promise(r => { release = () => r(f.call); }));
  if (stage === "queue") {
    const original = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation((url, init) => String(url).includes("next-lead") ? new Promise(r => { release = () => r(Response.json({ lead: { id: "late", businessName: "Late", phone: "+12025550102", sdrStatus: "no_contact" } })); }) : original(url, init));
  }
  await act(async () => { click("Start session"); });
  expect(release).toBeTypeOf("function");
  click("End session");
  vi.useFakeTimers();
  await act(async () => { release(); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(stage === "connect" ? 1 : 0);
  expect(f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST")).toHaveLength(stage === "connect" ? 1 : 0);
  if (stage === "connect") { expect(f.call.disconnect).toHaveBeenCalledOnce(); expect(f.device.destroy).toHaveBeenCalledOnce(); }
});
it("End session during queue work cancels progression immediately", async () => {
  const f = await started();
  const release = holdNextQueue(f);
  await settled(f);
  expect(screen.queryByRole("button", { name: "Complete wrap-up" })).toBeNull();
  click("End session");
  expect(f.call.disconnect).toHaveBeenCalledOnce();
  await act(async () => { release(); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it.each(["cancel", "reject", "error"])("Hang up does not excuse SDK %s or rearm after recovery", async event => {
  const f = await started();
  f.call.disconnect.mockImplementationOnce(() => f.emit(event));
  click("Hang up");
  f.terminal(); await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it.each([{ childStatus: "canceled" }, { parentStatus: "failed" }, { parentStatus: "canceled" }, { state: "canceled" }, { childStatus: null }, { parentStatus: null }, { childStatus: "in-progress" }, { locked: true, canStartNewIntent: false }])("Hang up cannot advance on unsafe/incomplete server evidence %j", async overrides => {
  const f = await started(); click("Hang up");
  f.terminal(overrides); await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(10000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it.each(["failed", "busy", "no-answer"])("recipient %s waits for both legs and release then automatically calls a distinct lead", async childStatus => {
  const f = await setup(true); await select(); vi.useFakeTimers();
  await act(async () => { click("Start session"); });
  f.terminal({ childStatus, parentStatus: "in-progress", locked: true, canStartNewIntent: false, state: "dialing" });
  await act(async () => { f.emit("disconnect"); await vi.advanceTimersByTimeAsync(1000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  f.terminal({ childStatus });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.queryByText(/Next call in/)).toBeNull();
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  const posts = f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST");
  expect(posts.map(([, init]) => JSON.parse(String(init?.body)).leadId)).toEqual(["lead-1", "lead-2"]);
  expect(screen.queryByRole("button", { name: "Complete wrap-up" })).toBeNull();
});
it.each([{ parentStatus: null }, { parentStatus: "in-progress" }, { locked: true }, { canStartNewIntent: false }, { id: "wrong-intent" }])("failed recipient remains held on incomplete/ambiguous evidence %j", async overrides => {
  const f = await started(); f.terminal({ childStatus: "failed", ...overrides });
  await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it.each(["error", "cancel", "reject"])("recipient failure cannot rearm after SDK %s", async event => {
  const f = await started();
  await act(async () => { f.emit(event); });
  f.terminal({ childStatus: "failed" });
  await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it.each(["provider", "device"])("explicit Start after %s failure and manual settlement selects next, never retries failed lead", async failure => {
  const f = await started();
  if (failure === "device") await act(async () => { f.emit("error"); });
  f.terminal(failure === "provider" ? { parentStatus: "failed", childStatus: "failed" } : { childStatus: "failed" });
  await act(async () => { click("Check server status"); });
  click("Complete wrap-up");
  expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => { click("Start session"); });
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  const posts = f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST");
  expect(posts.map(([, init]) => JSON.parse(String(init?.body)).leadId)).toEqual(["lead-1", "lead-2"]);
});
it("throwing local disconnect stops continuation even after successful reconciliation", async () => {
  const f = await started(); f.call.disconnect.mockImplementationOnce(() => { throw new Error("SDK teardown failed"); });
  click("Hang up");
  f.terminal(); await act(async () => { click("Check server status"); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("automatic polling completes Start → Hang up → next → End with one microphone preparation", async () => {
  const f = await setup(true); await select(); vi.useFakeTimers();
  await act(async () => { click("Start session"); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  f.terminal({ state: "connected", parentStatus: "in-progress", childStatus: "in-progress", locked: true, canStartNewIntent: false });
  click("Hang up");
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.queryByText(/Next call in/)).toBeNull();
  f.terminal();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.queryByText(/Next call in/)).toBeNull();

  expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(m.microphone).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST")).toHaveLength(2);
  click("End session");
  f.terminal({ id: "intent-2", leadId: "lead-2" });
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Next call in/)).toBeNull();
});
it("saves edited disposition before requesting and dialing the next excluded lead", async () => {
  const f = await started();
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  await settled(f);
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  const writes = f.fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH");
  expect(writes).toHaveLength(1); expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ sdrStatus: "follow_up_needed" });
  const paths = f.fetcher.mock.calls.map(([url]) => String(url));
  const nextIndex = paths.findIndex(url => url.includes("exclude=lead-1"));
  expect(nextIndex).toBeGreaterThan(paths.indexOf("/api/leads/lead-1"));
  expect(paths[nextIndex]).toContain("listId=list-1");
});
it("waits for edited disposition save and queue readiness, then dials immediately without duplicate advancement", async () => {
  const f = await started();
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  let save!: (r: Response) => void;
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) => init?.method === "PATCH" ? new Promise(r => { save = r; }) : original(url, init));
  const releaseQueue = holdNextQueue(f);
  const now = Date.now();
  await settled(f);
  expect(screen.getByText(/Call settled — saving any edits and loading the next lead/)).toBeTruthy();
  await act(async () => { click("Check server status"); });
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).includes("next-lead"))).toHaveLength(1);
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  await act(async () => { save(Response.json({ success: true })); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).includes("next-lead"))).toHaveLength(2);
  await act(async () => { click("Check server status"); releaseQueue(); });
  expect(Date.now()).toBe(now);
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(f.fetcher.mock.calls.filter(([url, init]) => url === "/api/dialer/intents" && init?.method === "POST")).toHaveLength(2);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).includes("next-lead"))).toHaveLength(2);
});
it("unchanged disposition does not invent or save a call outcome", async () => {
  const f = await started(); await settled(f);
  expect(f.device.connect).toHaveBeenCalledTimes(2);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
});
it.each(["save", "queue"])("%s error stops auto-next and retains the draft without retry", async stage => {
  const f = await started();
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation(async (url, init) => (stage === "save" ? init?.method === "PATCH" : String(url).includes("next-lead")) ? Response.json({}, { status: 500 }) : original(url, init));
  await settled(f);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  expect((screen.getByLabelText("Disposition") as HTMLSelectElement).value).toBe("follow_up_needed");
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
});
it.each(["offline", "pagehide", "hidden", "unmount"])("%s cancels queue work and never resumes when visible/online", async event => {
  const f = await started(); const release = holdNextQueue(f); await settled(f);
  if (event === "unmount") cleanup();
  else if (event === "hidden") { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); fireEvent(document, new Event("visibilitychange")); }
  else fireEvent(window, new Event(event));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fireEvent(document, new Event("visibilitychange")); fireEvent(window, new Event("online"));
  await act(async () => { release(); await vi.advanceTimersByTimeAsync(60000); });
  expect(f.device.connect).toHaveBeenCalledTimes(1);
});
it("Pause during disposition save allows the write to settle but never fetches or calls another lead", async () => {
  const f = await started();
  fireEvent.change(screen.getByLabelText("Disposition"), { target: { value: "follow_up_needed" } });
  let resolve!: (r: Response) => void;
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) => init?.method === "PATCH" ? new Promise(r => { resolve = r; }) : original(url, init));
  await settled(f);
  click("Pause");
  await act(async () => { resolve(Response.json({ success: true })); await vi.advanceTimersByTimeAsync(20000); });
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).includes("next-lead"))).toHaveLength(1);
  expect(f.device.connect).toHaveBeenCalledTimes(1); expect(f.call.disconnect).not.toHaveBeenCalled();
});
it("Start session refuses a hidden or offline page even before an interruption event", async () => {
  const f = await setup(); await select();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => { click("Start session"); });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  expect(f.device.connect).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => { click("Start session"); });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  expect(f.device.connect).not.toHaveBeenCalled();
});
it("a hung queue times out, stops, and ignores a late lead", async () => {
  const f = await started();
  const resolve = holdNextQueue(f);
  await settled(f);
  await act(async () => { await vi.advanceTimersByTimeAsync(18000); });
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  await act(async () => { resolve(); });
  expect(f.device.connect).toHaveBeenCalledTimes(1); expect(screen.queryByText("Late business")).toBeNull();
});
