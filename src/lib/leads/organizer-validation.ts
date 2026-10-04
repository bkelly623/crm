import { z } from "zod";
export const organizerKind = z.enum(["tags", "lists"]);
export const leadIdentifier = z.string().min(1).max(200).refine(v => v === v.trim());
// Prisma-generated CUIDs and the two persisted, explicitly named import formats.
// UUID imports are lowercase v4 with RFC variant bits; never trim/rewrite IDs.
// This is syntax validation only: every lookup still enforces its existing scope.
export const organizerIdentifier = z.string().max(100).regex(/^(?:c[a-z0-9]{8,99}|(?:verified|pilot)-list-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/).refine(v => v === v.trim());
export const catalogQuery = z.object({ leadId: leadIdentifier.optional(), after: organizerIdentifier.optional() }).strict();
export const membershipBody = z.object({ organizerId: organizerIdentifier }).strict();
export function organizerName(kind: "tags" | "lists") {
  const max = kind === "tags" ? 60 : 80;
  return z.object({ name: z.string().max(300).refine(v => !/[\p{Cc}\p{Cf}]/u.test(v), "Control characters are not allowed")
    .transform(v => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(max))
    .refine(v => v.toLowerCase().length <= max) }).strict();
}
