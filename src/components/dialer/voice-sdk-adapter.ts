import type { DialerDependencies } from "./browser-dialer";

// This module has no top-level SDK import: SSR and review-only sessions never
// construct a device. The caller explicitly grants microphone access first.
export const browserDependencies: DialerDependencies = {
  fetch: (input, init) => fetch(input, init),
  async microphone() {
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Secure microphone access unavailable");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  },
  async createDevice(token) {
    const { Device } = await import("@twilio/voice-sdk");
    if (!Device.isSupported) throw new Error("Browser voice unsupported");
    // Outgoing only. Do not register for inbound calls or alter inbound routing.
    return new Device(token, { tokenRefreshMs: 60000, logLevel: "error" });
  },
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: timer => clearTimeout(timer),
};
