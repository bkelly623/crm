import { prisma } from "@/lib/prisma";
import { salesLeadScope } from "@/lib/leads/access";

export type CallsToday = { count: number; timezone: string; day: string; endsAt: string; checkedAt: string };

// Find calendar-day transitions rather than adding 24 hours: DST days may
// contain 23 or 25 hours (and some zones change offset at midnight).
export function callDayWindow(now: Date, requestedTimezone?: string) {
  let timezone = requestedTimezone || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now); }
  catch { timezone = "UTC"; }
  const formatter = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dateKey = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const timestamp = now.getTime();
  const day = dateKey(timestamp);
  const boundary = (lo: number, hi: number, after: boolean) => {
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const key = dateKey(mid);
      if (after ? key > day : key >= day) hi = mid;
      else lo = mid + 1;
    }
    return new Date(lo);
  };
  const margin = 48 * 60 * 60 * 1000;
  return { timezone, day, start: boundary(timestamp - margin, timestamp, false), end: boundary(timestamp, timestamp + margin, true) };
}

export async function getCallsToday(profile: { id: string; role: string; timezone?: string }, now = new Date()): Promise<CallsToday> {
  const scope = salesLeadScope(profile);
  if (!scope) throw new Error("Forbidden");
  const { timezone, day, start, end } = callDayWindow(now, profile.timezone);
  const count = await prisma.call.count({ where: { userId: profile.id, lead: scope, startedAt: { gte: start, lt: end } } });
  return { count, timezone, day, endsAt: end.toISOString(), checkedAt: now.toISOString() };
}
