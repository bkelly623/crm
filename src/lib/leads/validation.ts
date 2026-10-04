import { z } from "zod";
import { SDR_STATUSES } from "./constants";
const text = z.string().trim().max(300).nullable().transform(v => v || null);
export const leadEditSchema = z.object({
  businessName: z.string().trim().min(1).max(300),
  contactName: text, phone: z.string().trim().max(50).regex(/^(?:[+\d().\s-]*\d[\d().\s-]*)?$/).nullable().transform(v => v || null),
  email: z.union([z.string().trim().email().max(254), z.literal(""), z.null()]).transform(v => v || null),
  website: z.union([z.string().trim().url().max(2000).refine(v => /^https?:\/\//i.test(v)), z.literal(""), z.null()]).transform(v => v || null),
  revenue: text, location: text, industry: text, sicCode: text, market: text, type: text,
  sdrStatus: z.enum(SDR_STATUSES.map(s => s.value) as [string, ...string[]]),
  segment: z.enum(["active", "won", "trashed"]),
  notes: z.string().max(20000).nullable(),
}).partial().strict().refine(v => Object.keys(v).length > 0, "No changes supplied");
export const leadUpdateSchema = leadEditSchema.innerType().extend({
  setterId: z.string().uuid().nullable().optional(),
  closerId: z.string().uuid().nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 0, "No changes supplied");
export const followUpSchema = z.object({
  leadId: z.string().min(1).max(200).refine(v => v === v.trim()),
  note: z.string().trim().min(1).max(2000),
  dueAt: z.string().datetime().refine(v => Number.isFinite(new Date(v).getTime())),
});
