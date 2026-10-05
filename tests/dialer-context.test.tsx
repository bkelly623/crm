// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderReviewDialer } from "./support/render-review-dialer";
import { DialerPanel } from "@/components/dialer/dialer-panel";
afterEach(cleanup);
it.each([true, false])("shows existing caller context inline without navigation (populated=%s)", async populated => {
  const lead = { id: "synthetic-context", businessName: "Synthetic Business", contactName: "Synthetic Contact", phone: "+12025550102", sdrStatus: "no_contact", industry: populated ? "Plumbing / HVAC" : null, location: populated ? "Synthetic City, PA" : null, website: populated ? "https://example.invalid/" + "long-path".repeat(30) : null };
  const fetcher = vi.fn(async () => Response.json({ lead }));
  vi.stubGlobal("fetch", fetcher);
  await renderReviewDialer(<DialerPanel smartViews={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Lead" }));
  await screen.findByText("Synthetic Business");
  const context = within(screen.getByRole("region", { name: "Caller context" }));
  expect(context.getByText("Industry")).toBeTruthy();
  expect(context.getByText("Location")).toBeTruthy();
  expect(context.getByText("Website")).toBeTruthy();
  if (populated) for (const value of [lead.industry!, lead.location!, lead.website!]) expect(context.getByText(value)).toBeTruthy();
  else expect(context.getAllByText("Not provided")).toHaveLength(3);
  expect(context.queryByRole("link")).toBeNull();
  expect(screen.getByText(/Synthetic Contact/)).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
