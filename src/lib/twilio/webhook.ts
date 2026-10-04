import twilio from "twilio";

// Returns the same parsed fields that were authenticated; callers never reparse.
export async function authenticateTwilioForm(request: Request): Promise<
  { ok: true; form: FormData } | { ok: false; status: number }
> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const configured = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!token || /\s/.test(token) || !configured || /\s/.test(configured)) {
    return { ok: false, status: 503 };
  }
  let base: URL;
  try {
    base = new URL(configured);
    if (base.protocol !== "https:" || (configured !== base.origin && configured !== base.origin + "/")) {
      return { ok: false, status: 503 };
    }
  } catch {
    return { ok: false, status: 503 };
  }
  // Only Twilio's URL-encoded POST protocol is supported, not JSON/bodySHA256
  // or multipart. Reject duplicate keys rather than choosing first/last values.
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded") return { ok: false, status: 415 };
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400 };
  }
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of form) {
    if (Object.hasOwn(params, key) || typeof value !== "string") return { ok: false, status: 400 };
    params[key] = value;
  }
  const url = new URL(request.url);
  // Request authority and all host/forwarded headers are deliberately ignored.
  // Preserve query order/encoding: never rebuild it with URLSearchParams.
  const canonicalUrl = base.origin + url.pathname + url.search;
  if (!twilio.validateRequest(token, request.headers.get("x-twilio-signature") ?? "", canonicalUrl, params)) {
    return { ok: false, status: 403 };
  }
  return { ok: true, form };
}
