import type { ReactElement } from "react";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";

// Existing queue/catalog tests isolate their transports from the new mount-time
// recovery GET. Real recovery/active/error cases live in browser-dialer-ui tests.
export async function renderReviewDialer(element: ReactElement) {
  const transport = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/dialer/intents" && (!init?.method || init.method === "GET")) return Promise.resolve(Response.json({ intent: null }));
    return transport(input, init);
  });
  let result!: ReturnType<typeof render>;
  await act(async () => { result = render(element); });
  return result;
}
