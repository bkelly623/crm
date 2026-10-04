import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  refreshed: [] as { name: string; value: string; options: CookieOptions }[],
  getUser: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => ({
    auth: { getUser: async () => {
      auth.getUser();
      options.cookies.getAll();
      if (auth.refreshed.length) options.cookies.setAll(auth.refreshed);
      return { data: { user: auth.user } };
    } },
  })),
}));
const preview = "https://ending-personals-rooms-participating.trycloudflare.com";
function request(path: string) {
  return new NextRequest(`https://localhost:3090${path}`, { headers: {
    host: "attacker.example",
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "http",
    forwarded: "host=attacker.example;proto=http",
  } });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", preview);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  auth.user = null;
  auth.refreshed = [];
  auth.getUser.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("session redirects behind a reverse proxy", () => {
  it.each([false, true])("drops sensitive query parameters and fragments (logged in: %s)", async (loggedIn) => {
    auth.user = loggedIn ? { id: "user-test" } : null;
    for (const origin of [preview, undefined]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
      const path = loggedIn ? "/login" : "/dashboard/leads";
      const response = await updateSession(request(`${path}?code=test-code&access_token=test-token&email=test%40example.test&next=https://attacker.example#test-fragment`));
      expect(response.headers.get("location")).toBe(`${origin ?? ""}${loggedIn ? "/dashboard" : "/login"}`);
    }
  });
  it.each([
    [false, "/login"], [false, "/"], [false, "/api/leads"],
    [true, "/dashboard"], [true, "/dashboard/leads"], [true, "/"],
  ] as const)("preserves normal pass-through and refresh (logged in: %s, path: %s)", async (loggedIn, path) => {
    auth.user = loggedIn ? { id: "user-test" } : null;
    auth.refreshed = [{ name: "session-test", value: "refreshed-test", options: { path: "/", secure: true } }];
    const response = await updateSession(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get("session-test")?.value).toBe("refreshed-test");
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
  it("accepts an HTTPS origin with a single trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", `${preview}/`);
    expect((await updateSession(request("/dashboard"))).headers.get("location")).toBe(`${preview}/login`);
  });
  it.each(["http://localhost.attacker.example", "http://192.168.1.1", "http://public.example"])("rejects non-loopback HTTP even in development: %s", async (origin) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    expect((await updateSession(request("/dashboard"))).headers.get("location")).toBe("/login");
  });
  it.each([false, true])("preserves refreshed and cleared auth cookies on redirect (logged in: %s)", async (loggedIn) => {
    auth.user = loggedIn ? { id: "user-test" } : null;
    auth.refreshed = [
      { name: "session-test", value: "refreshed-test", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3600 } },
      { name: "session-old-test", value: "", options: { path: "/", maxAge: 0 } },
    ];
    const incoming = request(loggedIn ? "/login" : "/dashboard");
    const response = await updateSession(incoming);
    for (const cookie of auth.refreshed) {
      expect(response.cookies.get(cookie.name)).toMatchObject({ name: cookie.name, value: cookie.value, ...cookie.options });
      expect(incoming.cookies.get(cookie.name)?.value).toBe(cookie.value);
    }
  });
  it.each(["http://127.0.0.1:3090", "http://localhost:3090", "http://[::1]:3090"])("permits explicit development loopback origin %s", async (origin) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    expect((await updateSession(request("/dashboard"))).headers.get("location")).toBe(`${origin}/login`);
  });
  it.each([
    undefined, "", "not-a-url", "//attacker.example", "http://public.example",
    "https://user:password@public.example", "https://public.example/path",
    "https://public.example/../", "https://public.example?token=test",
    "https://public.example#fragment", "https://public.example?", "https://public.example#",
    "https://public.example\\\\attacker", " https://public.example", "https://public.example\n",
    "https:public.example", "https:///public.example", "javascript:alert(1)",
    "http://127.0.0.1:3090", "http://localhost:3090",
  ])("uses a safe path-only fallback for absent or invalid production origin %j", async (origin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    for (const loggedIn of [false, true]) {
      auth.user = loggedIn ? { id: "user-test" } : null;
      const response = await updateSession(request(loggedIn ? "/login" : "/dashboard"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(loggedIn ? "/dashboard" : "/login");
    }
  });
  it("uses the configured preview for a logged-in login visit", async () => {
    auth.user = { id: "user-test" };
    const response = await updateSession(request("/login"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${preview}/dashboard`);
  });
  it("uses the configured HTTPS preview for unauthenticated dashboard redirects, not host headers", async () => {
    const response = await updateSession(request("/dashboard/leads"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${preview}/login`);
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
});
