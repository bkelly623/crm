import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("server-only", () => ({}));
const { page, sdk } = vi.hoisted(() => { const page = vi.fn(); return { page, sdk: vi.fn(() => ({ incomingPhoneNumbers: { page } })) }; });
vi.mock("twilio", () => ({ default: sdk }));
import { getCurrentProfile } from "@/lib/auth";
type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
const actor = (role: string) => vi.mocked(getCurrentProfile).mockResolvedValue({ id: "rep", role } as Profile);
async function get(query = "") {
  const route = await import("@/app/api/dialer/numbers/route");
  return route.GET(new Request(`https://crm.test/api/dialer/numbers${query}`));
}
const accountSid = "AC" + "0".repeat(32);
beforeEach(() => {
  vi.clearAllMocks(); actor("sales_rep");
  vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid);
  vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic-token");
});
it.each(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"])("fails safely without %s", async key => {
  vi.stubEnv(key, "");
  const res = await get(); expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: "Number inventory unavailable" });
  expect(sdk).not.toHaveBeenCalled();
});
it.each(["admin", "sales_manager", "sales_rep", "closer", "hybrid"])("returns minimal owned voice inventory for %s", async role => {
  actor(role);
  const number = { accountSid, sid: "PN" + "1".repeat(32), phoneNumber: "+12025550101", friendlyName: "Demo office", capabilities: { voice: true }, voiceUrl: "private-routing" };
  page.mockResolvedValue({ instances: [number, { ...number, capabilities: { voice: false } }, { ...number, accountSid: "AC" + "2".repeat(32) }, { ...number, capabilities: {} }], nextPageUrl: null });
  const res = await get(); expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ numbers: [{ sid: number.sid, phoneNumber: number.phoneNumber, friendlyName: number.friendlyName }], nextPage: null, hasMore: false, truncated: false });
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(page).toHaveBeenCalledWith({ pageNumber: 0, pageSize: 50 });
  expect(sdk).toHaveBeenCalledWith(accountSid, "synthetic-token", { timeout: 10000, autoRetry: false });
});
it.each(["?page=-1", "?page=100", "?page=1.5", "?page=01", "?page=", "?page=1&page=2", "?page=https://evil.test", "?pageSize=1000", "?url=http://127.0.0.1"])("rejects malformed pagination %s", async query => {
  const res = await get(query); expect(res.status).toBe(400); expect(sdk).not.toHaveBeenCalled();
});
it("uses only fixed SDK pagination, including empty filtered pages", async () => {
  page.mockResolvedValue({ instances: [], nextPageUrl: "https://untrusted.invalid/do-not-fetch" });
  const res = await get("?page=3");
  expect(await res.json()).toEqual({ numbers: [], nextPage: 4, hasMore: true, truncated: false });
  expect(page).toHaveBeenCalledExactlyOnceWith({ pageNumber: 3, pageSize: 50 });
});
it("reports truncation honestly at the traversal bound", async () => {
  page.mockResolvedValue({ instances: [], nextPageUrl: "more" });
  expect(await (await get("?page=99")).json()).toEqual({ numbers: [], nextPage: null, hasMore: true, truncated: true });
});
it.each([["TWILIO_ACCOUNT_SID", " ACbad"], ["TWILIO_ACCOUNT_SID", "ACbad"], ["TWILIO_AUTH_TOKEN", " token "]])("rejects malformed server config %s=%s", async (key, value) => {
  vi.stubEnv(key, value); expect((await get()).status).toBe(503); expect(sdk).not.toHaveBeenCalled();
});
it("redacts provider failures and does not log secrets", async () => {
  page.mockRejectedValue(new Error("synthetic-token private-routing"));
  const res = await get(); expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "Number inventory unavailable" });
});
it("validates adapter bounds independently of the route", async () => {
  const { ownedVoiceNumbers } = await import("@/lib/twilio/number-inventory");
  for (const value of [-1, 100, 0.5, NaN, Infinity]) await expect(ownedVoiceNumbers(value)).rejects.toThrow();
  expect(sdk).not.toHaveBeenCalled();
});
it("omits invalid provider identifiers and falls back to the real phone as label", async () => {
  const number = { accountSid, sid: "PN" + "1".repeat(32), phoneNumber: "+12025550101", friendlyName: "", capabilities: { voice: true } };
  page.mockResolvedValue({ instances: [number, { ...number, sid: "bad" }, { ...number, phoneNumber: "not a number" }], nextPageUrl: null });
  expect((await (await get()).json()).numbers).toEqual([{ sid: number.sid, phoneNumber: number.phoneNumber, friendlyName: number.phoneNumber }]);
});
it.each(["client", "hiring_manager", "project_manager", "unknown"])("denies %s before SDK access", async role => {
  actor(role); expect((await get()).status).toBe(403); expect(sdk).not.toHaveBeenCalled();
});
it("denies anonymous access", async () => {
  vi.mocked(getCurrentProfile).mockResolvedValue(null);
  expect((await get()).status).toBe(401); expect(sdk).not.toHaveBeenCalled();
});
