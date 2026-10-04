import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ adapter: vi.fn(), syncContact: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/integrations", () => ({ getIntegrationAdapter: mocks.adapter }));
vi.mock("@/lib/prisma", () => ({ prisma: { orgSettings: { findUnique: mocks.settings } } }));
import { POST } from "@/app/api/webhooks/ghl/route";
const secret = "offline-fixture-not-a-real-secret";
function request(header?: string, body = "{}") {
  return new Request("http://localhost/api/webhooks/ghl", { method: "POST", headers: header === undefined ? {} : { "x-ghl-webhook-secret": header }, body });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.adapter.mockResolvedValue({ syncContact: mocks.syncContact });
  mocks.syncContact.mockResolvedValue({ externalId: "offline-contact" });
});
it.each([undefined, "", "   "])("fails closed with unconfigured secret %j before parsing or integrations", async configured => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", configured);
  const req = request(secret);
  const parse = vi.spyOn(req, "json");
  expect((await POST(req)).status).toBe(503);
  expect(parse).not.toHaveBeenCalled();
  expect(mocks.adapter).not.toHaveBeenCalled();
  expect(mocks.syncContact).not.toHaveBeenCalled();
  expect(mocks.settings).not.toHaveBeenCalled();
});
it.each([undefined, "", "wrong"])("rejects absent/mismatched header %j before parsing", async header => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", secret);
  expect((await POST(request(header, "{"))).status).toBe(401);
  expect(mocks.adapter).not.toHaveBeenCalled();
  expect(mocks.syncContact).not.toHaveBeenCalled();
});
it("retains configured matching-secret contact sync through mocked boundary", async () => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", secret);
  const response = await POST(request(secret, JSON.stringify({ companyName: "Offline Company", contactId: "offline-contact" })));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, externalId: "offline-contact" });
  expect(mocks.syncContact).toHaveBeenCalledExactlyOnceWith({ businessName: "Offline Company", contactName: undefined, phone: undefined, email: undefined, externalId: "offline-contact", source: "ghl" });
});
