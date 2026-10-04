import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

function sessionRedirect(path: "/login" | "/dashboard", sessionResponse: NextResponse) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  let origin: string | undefined;
  // Accept only an explicit origin, not URL parser repairs, credentials or paths.
  if (configured && /^https?:\/\/[^/\\\s?#@]+\/?$/.test(configured)) {
    try {
      const url = new URL(configured);
      const developmentLoopback = process.env.NODE_ENV === "development"
        && url.protocol === "http:"
        && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.protocol === "https:" || developmentLoopback) origin = url.origin;
    } catch {
      // Invalid configuration falls back to a fixed same-origin path below.
    }
  }
  // A relative Location preserves the browser's origin without trusting Host,
  // forwarded headers or Next's internal proxy URL. Never copy query parameters.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: origin ? new URL(path, origin).href : path },
  });
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!user && isDashboard) {
    return sessionRedirect("/login", supabaseResponse);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return sessionRedirect("/dashboard", supabaseResponse);
  }

  return supabaseResponse;
}
