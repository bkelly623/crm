// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DialerPanel } from "@/components/dialer/dialer-panel";

// Mount the real hook/controller/adapter. Only browser permission and HTTP are
// replaced; these tests never construct a provider device or place calls.
afterEach(cleanup);
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
async function mount() {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/dialer/intents") return Response.json({ intent: null });
    if (String(input) === "/api/dialer/next-lead") return Response.json({ lead: { id: "fixture-lead", businessName: "Fixture lead", contactName: null, phone: null, sdrStatus: "no_contact" } });
    throw new Error(`Unexpected request: ${input}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<StrictMode><DialerPanel smartViews={[]} /></StrictMode>);
  await waitFor(() => expect(button("Load Lead").disabled).toBe(false));
  return fetcher;
}
function visibility(value: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
  fireEvent(document, new Event("visibilitychange"));
}
function pendingMicrophone() {
  const stop = vi.fn();
  const resolves: Array<(stream: MediaStream) => void> = [];
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => resolves.push(resolve)));
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { getUserMedia, stop, resolve: (index: number) => resolves[index]({ getTracks: () => [{ stop }] } as unknown as MediaStream) };
}

it("StrictMode recovery with the route's empty-intent shape enables Load Lead", async () => {
  const fetcher = await mount();
  fireEvent.click(button("Load Lead"));
  await screen.findByText("Fixture lead");
  expect(fetcher.mock.calls.filter(([url]) => url === "/api/dialer/intents")).toHaveLength(2);
  expect(button("Prepare browser calling").disabled).toBe(false);
});

it("explains canceled microphone preparation after a visibility interruption", async () => {
  const microphone = pendingMicrophone();
  const fetcher = await mount();
  fireEvent.click(button("Prepare browser calling"));
  expect(button("Load Lead").disabled).toBe(true);
  visibility("hidden");
  visibility("visible");
  await act(async () => microphone.resolve(0));
  expect(screen.getByRole("alert").textContent).toMatch(/interrupted.*prepare.*again/i);
  expect(button("Load Lead").disabled).toBe(false);
  expect(microphone.stop).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls.every(([url]) => url === "/api/dialer/intents")).toBe(true);
});

it("an interrupted permission result cannot unlock a newer pending preparation", async () => {
  const microphone = pendingMicrophone();
  await mount();
  fireEvent.click(button("Prepare browser calling"));
  visibility("hidden"); visibility("visible");
  fireEvent.click(button("Prepare browser calling"));
  expect(microphone.getUserMedia).toHaveBeenCalledTimes(2);
  await act(async () => microphone.resolve(0));
  expect(button("Preparing microphone…").disabled).toBe(true);
  expect(button("Load Lead").disabled).toBe(true);
  visibility("hidden");
  await act(async () => microphone.resolve(1));
});
