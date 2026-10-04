import { afterEach, beforeEach, vi } from "vitest";

// Unexpected fetches fail instead of reaching any external service.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in safety tests"); }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
