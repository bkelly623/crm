// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DialerPanel } from "@/components/dialer/dialer-panel";
const m = vi.hoisted(() => ({ microphone: vi.fn(), createDevice: vi.fn() }));
vi.mock("@/components/dialer/voice-sdk-adapter", () => ({ browserDependencies: { ...m, fetch: (...args: Parameters<typeof fetch>) => fetch(...args), schedule: () => 1, cancel: vi.fn() } }));
afterEach(cleanup);
const sid = "PN" + "1".repeat(32);
const current = (patch = {}) => ({ id: "intent-1", leadId: "lead-1", state: "ringing", parentStatus: "in-progress", childStatus: "ringing", locked: true, canStartNewIntent: false, recording: "do-not-record", expiresAt: "2026-01-01", finishedAt: null, ...patch });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
it("mobile manual call locks queue/caller/lead until server terminal and human wrapup", async () => {
  let intent: unknown = null;
  const events: Record<string, () => void> = {};
  const call = { on: (e: string, cb: () => void) => { events[e] = cb; }, disconnect: vi.fn(), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn(), connect: vi.fn(async () => call), destroy: vi.fn(), updateToken: vi.fn() };
  m.microphone.mockResolvedValue(undefined); m.createDevice.mockResolvedValue(device);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/twilio/token") return Response.json({ token: "synthetic-token" });
    if (url === "/api/dialer/numbers") return Response.json({ numbers: [{ sid, phoneNumber: "+1202" + "5550101", friendlyName: "Test office" }], hasMore: false, truncated: false, nextPage: null });
    if (url.includes("next-lead")) return Response.json({ lead: { id: "lead-1", businessName: "Fixture lead", phone: "+1202" + "5550102", sdrStatus: "no_contact" } });
    if (url === "/api/dialer/intents" && init?.method === "POST") { intent = current(); return Response.json({ intent: { id: "intent-1" }, callingAvailable: true, recording: "do-not-record" }, { status: 201 }); }
    return Response.json({ intent });
  });
  vi.stubGlobal("fetch", fetcher); render(<DialerPanel smartViews={[]} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Load Lead" }) as HTMLButtonElement).disabled).toBe(false));
  click("Load Lead"); await screen.findByText("Fixture lead");
  click("Load numbers"); await screen.findByRole("option", { name: /Test office/ });
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: sid } });
  click("Prepare browser calling"); await waitFor(() => expect((screen.getByRole("button", { name: "Call" }) as HTMLButtonElement).disabled).toBe(false));
  click("Call"); click("Call"); await waitFor(() => expect(device.connect).toHaveBeenCalledOnce());
  for (const name of ["Next Lead", "Save & Next", "Stop", "Reload numbers"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText("Call from") as HTMLSelectElement).disabled).toBe(true);
  expect(screen.queryByRole("link", { name: "Open Lead" })).toBeNull();
  await act(async () => events.accept()); expect(screen.queryByText("Recipient connected")).toBeNull();
  click("Mute"); expect(call.mute).toHaveBeenCalledWith(true);
  click("DTMF 1"); expect(call.sendDigits).toHaveBeenCalledWith("1");
  expect(screen.getByRole("button", { name: "Hang up" }).className).toContain("min-h-[48px]");
  click("Hang up"); expect(call.disconnect).toHaveBeenCalledOnce();
  click("Check server status"); await screen.findByText("Recipient ringing");
  intent = current({ state: "terminal", childStatus: "completed", parentStatus: "completed", locked: false, canStartNewIntent: true });
  click("Check server status"); await screen.findByRole("button", { name: "Complete wrap-up" });
  expect((screen.getByRole("button", { name: "Next Lead" }) as HTMLButtonElement).disabled).toBe(true);
  click("Complete wrap-up"); expect((screen.getByRole("button", { name: "Next Lead" }) as HTMLButtonElement).disabled).toBe(false);
  expect(device.connect).toHaveBeenCalledExactlyOnceWith({ params: { IntentId: "intent-1" } });
});
it("recovers active calls on mount without microphone, token, or connection", async () => {
  m.microphone.mockClear(); m.createDevice.mockClear();
  const fetcher = vi.fn(async () => Response.json({ intent: current() })); vi.stubGlobal("fetch", fetcher);
  render(<DialerPanel smartViews={[]} />); await screen.findByText("Recipient ringing");
  expect((screen.getByRole("button", { name: "Load Lead" }) as HTMLButtonElement).disabled).toBe(true);
  expect(m.microphone).not.toHaveBeenCalled(); expect(m.createDevice).not.toHaveBeenCalled();
  fireEvent(window, new Event("offline")); await screen.findByText(/Reconciling/);
});
it("shows Hang up while connect is pending and blocks late catalog changes during the call", async () => {
  let resolveCatalog!: (r: Response) => void, resolveCall!: (c: typeof call) => void;
  const call = { on: vi.fn(), disconnect: vi.fn(), mute: vi.fn(), sendDigits: vi.fn() };
  const device = { on: vi.fn(), connect: vi.fn(() => new Promise<typeof call>(r => { resolveCall = r; })), destroy: vi.fn(), updateToken: vi.fn() };
  m.microphone.mockResolvedValue(undefined); m.createDevice.mockResolvedValue(device);
  let listLoads = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("lead-organizers/lists")) {
      if (listLoads++) return new Promise<Response>(r => { resolveCatalog = r; });
      return Response.json({ items: [{ id: "list-1", name: "Pilot" }], nextCursor: null });
    }
    if (url.includes("next-lead")) return Response.json({ lead: { id: "lead-1", businessName: "Held fixture", phone: "+12025550102", sdrStatus: "no_contact" } });
    if (url.includes("numbers")) return Response.json({ numbers: [{ sid, phoneNumber: "+12025550101", friendlyName: "Test office" }], hasMore: false, truncated: false, nextPage: null });
    if (url.includes("token")) return Response.json({ token: "fixture" });
    if (init?.method === "POST") return Response.json({ intent: { id: "intent-1" }, callingAvailable: true, recording: "do-not-record" }, { status: 201 });
    return Response.json({ intent: null });
  }));
  render(<DialerPanel smartViews={[]} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Load Lead" }) as HTMLButtonElement).disabled).toBe(false));
  click("Load lists"); await screen.findByRole("option", { name: "Pilot" });
  fireEvent.change(screen.getByLabelText("Named list"), { target: { value: "list-1" } });
  click("Load Lead"); await screen.findByText("Held fixture");
  click("Load numbers"); await screen.findByRole("option", { name: /Test office/ });
  fireEvent.change(screen.getByLabelText("Call from"), { target: { value: sid } });
  click("Prepare browser calling"); await waitFor(() => expect((screen.getByRole("button", { name: "Call" }) as HTMLButtonElement).disabled).toBe(false));
  click("Reload lists"); click("Call"); await waitFor(() => expect(device.connect).toHaveBeenCalledOnce());
  await act(async () => resolveCatalog(Response.json({ items: [], nextCursor: null })));
  expect(screen.getByText("Held fixture")).toBeTruthy();
  click("Hang up"); await act(async () => resolveCall(call));
  expect(call.disconnect).toHaveBeenCalledOnce(); expect(device.destroy).toHaveBeenCalledOnce();
});
