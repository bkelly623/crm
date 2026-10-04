// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { browserDependencies } from "@/components/dialer/voice-sdk-adapter";
it("preflights HTTPS microphone and releases its stream", async () => {
  vi.stubGlobal("isSecureContext", true);
  const stop = vi.fn(), getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  await browserDependencies.microphone();
  expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true }); expect(stop).toHaveBeenCalledOnce();
});
it("rejects insecure or unsupported audio before requesting permission", async () => {
  vi.stubGlobal("isSecureContext", false);
  await expect(browserDependencies.microphone()).rejects.toThrow();
});
it("loads installed official SDK dynamically, refusing unsupported browsers", async () => {
  const { Device } = await import("@twilio/voice-sdk");
  vi.spyOn(Device, "isSupported", "get").mockReturnValue(false);
  await expect(browserDependencies.createDevice("fixture")).rejects.toThrow();
});
it("constructs real installed Device with outgoing-only adapter and no register/network", async () => {
  const { Device } = await import("@twilio/voice-sdk");
  vi.spyOn(Device, "isSupported", "get").mockReturnValue(true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { enumerateDevices: vi.fn(async () => []), addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  const register = vi.spyOn(Device.prototype, "register").mockResolvedValue();
  const device = await browserDependencies.createDevice("synthetic-token");
  expect(device).toBeInstanceOf(Device); expect(register).not.toHaveBeenCalled();
  device.destroy();
});
