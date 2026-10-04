import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn(async () => ({ id: "actor", role: "admin", email: "test@example.test" })) }));
const m = vi.hoisted(() => ({ calls: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { count: vi.fn(async () => 0) }, task: { count: vi.fn(async () => 0) }, call: { count: vi.fn(async () => 0), findMany: m.calls } } }));
import Home from "@/app/dashboard/page";
import Calls from "@/app/dashboard/call-history/page";
import Appointments from "@/app/dashboard/appointments/page";
import Leaderboard from "@/app/dashboard/leaderboard/page";
import Sequences from "@/app/dashboard/pipeline/page";
import Reports from "@/app/dashboard/executive/page";
import Playbook from "@/app/dashboard/sales-training/page";
beforeEach(() => { m.calls.mockResolvedValue([]); });
it.each([["Appointments", Appointments], ["Leaderboard", Leaderboard], ["Sequences", Sequences], ["Reports", Reports], ["Playbook", Playbook]] as const)("%s is explicitly unavailable without live-dialing or schedule promises", async (title, page) => {
  const html = renderToStaticMarkup(await page());
  expect(html).toContain(`>${title}</h1>`); expect(html).toContain("Not available yet");
  expect(html).toContain("Calling is disabled");
  expect(html).not.toMatch(/are live|ships next|Phase [0-9]/);
  if (title === "Sequences") expect(html).toContain("No sequences run and no messages are sent");
});
it("Home offers review, not a live caller", async () => {
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain("Review leads"); expect(html).toContain("Calling is disabled");
  expect(html).not.toMatch(/Start dialing|power dial flow|run the dialer/);
});
it("Call log empty state never encourages unavailable calling", async () => {
  const html = renderToStaticMarkup(await Calls());
  expect(html).toContain("Calling is disabled"); expect(html).not.toContain("Start dialing");
});
it("Call log labels capped rows as shown rather than a total", async () => {
  m.calls.mockResolvedValue(Array.from({ length: 200 }, (_, i) => ({ id: String(i), leadId: String(i), status: "completed", startedAt: new Date(), lead: { businessName: "Fixture", phone: "", contactName: null } })));
  const html = renderToStaticMarkup(await Calls());
  expect(html).toContain("200 calls shown"); expect(html).toContain("latest 200"); expect(html).toContain("server time");
});
