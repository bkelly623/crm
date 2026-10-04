import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn() }));
import { getCurrentProfile } from "@/lib/auth";
import { GET } from "@/app/api/twilio/token/route";

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "offline-user", role: "sales_rep" } as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>);
  // Synthetic fixture values; real Twilio JWT construction is offline.
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC" + "0".repeat(32));
  vi.stubEnv("TWILIO_API_KEY", "SK" + "0".repeat(32));
  vi.stubEnv("TWILIO_API_SECRET", "offline-test-not-a-real-secret");
  vi.stubEnv("TWILIO_TWIML_APP_SID", "AP" + "0".repeat(32));
});

describe("token calling gate", () => {
  it.each([undefined, "", "+15005550008", "not-a-list"])("retains authenticated offline token issuance without legacy recipient config %s", async legacy => {
    vi.stubEnv("TWILIO_TEST_RECIPIENT_ALLOWLIST", legacy);
    vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    const payload = JSON.parse(Buffer.from(body.token.split(".")[1], "base64url").toString());
    expect(payload.grants.identity).toBe("offline-user");
    expect(payload.grants.voice.outgoing.application_sid).toBe(process.env.TWILIO_TWIML_APP_SID);
    expect(payload.grants.voice.incoming).toBeUndefined();
  });
  it("still denies unauthenticated users when enabled", async () => {
    vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
  it.each(["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_SECRET", "TWILIO_TWIML_APP_SID"])("still denies missing %s when enabled", async (key) => {
    vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
    vi.stubEnv(key, "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("token");
  });
  it.each([undefined, "", "false", "1", "TRUE", " true "])("denies flag %s before auth or token issuance", async (flag) => {
    vi.stubEnv("TWILIO_CALLING_ENABLED", flag);
    vi.stubEnv("NEXT_PUBLIC_TWILIO_CALLING_ENABLED", "true");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Outbound calling disabled" });
    expect(getCurrentProfile).not.toHaveBeenCalled();
  });
});
