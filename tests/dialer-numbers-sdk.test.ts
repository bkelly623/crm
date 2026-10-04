import { expect, it, vi } from "vitest";
import RequestClient from "twilio/lib/base/RequestClient";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn(async () => ({ id: "rep", role: "sales_rep" })) }));
import { GET } from "@/app/api/dialer/numbers/route";

it("real SDK builds only account inventory GETs with bounded numeric pagination and serializes minimal resources", async () => {
  const accountSid = "AC" + "0".repeat(32);
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic-token");
  // Mock the actual SDK HTTP boundary, not fetch (Twilio uses its own transport).
  const request = vi.spyOn(RequestClient.prototype, "request").mockResolvedValue({ statusCode: 200, headers: {}, body: {
    incoming_phone_numbers: [{ account_sid: accountSid, sid: "PN" + "1".repeat(32), phone_number: "+12025550101", friendly_name: "Demo", capabilities: { voice: true }, voice_url: "https://private.invalid" }],
    next_page_uri: `/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?Page=2&PageSize=50`,
  } });
  const result = await GET(new Request("https://crm.test/api/dialer/numbers?page=1"));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ numbers: [{ sid: "PN" + "1".repeat(32), phoneNumber: "+12025550101", friendlyName: "Demo" }], nextPage: 2, hasMore: true, truncated: false });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toMatchObject({ method: "get", uri: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`, params: { Page: 1, PageSize: 50 } });
});
