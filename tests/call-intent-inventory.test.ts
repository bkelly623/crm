import { expect, it, vi } from "vitest";
import RequestClient from "twilio/lib/base/RequestClient";
vi.mock("server-only", () => ({}));
import * as inventory from "@/lib/twilio/number-inventory";
const accountSid = "AC" + "0".repeat(32), sid = "PN" + "1".repeat(32);
it.each([
  { account_sid: "AC" + "2".repeat(32) }, { sid: "PN" + "2".repeat(32) },
  { capabilities: { voice: false } }, { capabilities: { voice: "true" } },
  { phone_number: "2025550101" }, { phone_number: "+012345678" },
])("refuses stale/foreign/nonvoice or malformed provider resource %j", async extra => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  vi.spyOn(RequestClient.prototype, "request").mockResolvedValue({ statusCode: 200, headers: {}, body: { account_sid: accountSid, sid, phone_number: "+12025550101", capabilities: { voice: true }, ...extra } });
  await expect(inventory.ownedVoiceNumber(sid)).rejects.toThrow();
});
it.each(["https://evil.invalid", "PNbad", " PN" + "1".repeat(32)])("invalid PN never reaches SDK: %s", async invalid => {
  const http = vi.spyOn(RequestClient.prototype, "request").mockRejectedValue(new Error("Forbidden network"));
  await expect(inventory.ownedVoiceNumber(invalid)).rejects.toThrow();
  expect(http).not.toHaveBeenCalled();
});
it("rejects provider failures rather than using the selected browser number as fallback", async () => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  vi.spyOn(RequestClient.prototype, "request").mockRejectedValue(new Error("Synthetic provider failure"));
  await expect(inventory.ownedVoiceNumber(sid)).rejects.toThrow();
});
it("revalidates an exact PN using only the account-owned SDK GET", async () => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid); vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic");
  const http = vi.spyOn(RequestClient.prototype, "request").mockResolvedValue({ statusCode: 200, headers: {}, body: { account_sid: accountSid, sid, phone_number: "+12025550101", capabilities: { voice: true } } });
  expect(await inventory.ownedVoiceNumber(sid)).toEqual({ accountSid, sid, phoneNumber: "+12025550101" });
  expect(http).toHaveBeenCalledTimes(1);
  expect(http.mock.calls[0][0]).toMatchObject({ method: "get", uri: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${sid}.json` });
});
