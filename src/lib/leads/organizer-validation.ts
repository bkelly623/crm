import { z } from "zod";
export const organizerKind = z.enum(["tags", "lists"]);
export const leadIdentifier = z.string().min(1).max(200).refine(v => v === v.trim());
export const organizerIdentifier = z.string().cuid().max(100);
export const catalogQuery = z.object({ leadId: leadIdentifier.optional(), after: organizerIdentifier.optional() }).strict();
export const membershipBody = z.object({ organizerId: organizerIdentifier }).strict();
export function organizerName(kind: "tags" | "lists") {
  const max = kind === "tags" ? 60 : 80;
  return z.object({ name: z.string().max(300).refine(v => !/[\p{Cc}\p{Cf}]/u.test(v), "Control characters are not allowed")
    .transform(v => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(max))
    .refine(v => v.toLowerCase().length <= max) }).strict();
}
