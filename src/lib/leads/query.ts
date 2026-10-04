import { z } from "zod";
import { leadIdentifier, organizerIdentifier } from "./organizer-validation";
export const listQuery = z.object({
  segment: z.enum(["active", "won", "trashed", "all"]).default("active"),
  q: z.string().max(300).optional(), myLeads: z.enum(["true", "false"]).optional(),
  listId: organizerIdentifier.optional(), tagId: organizerIdentifier.optional(),
  after: leadIdentifier.optional(),
}).strict();
/** Repeated scalar parameters are rejected, not silently last-wins. */
export function scalarQuery(params: URLSearchParams) {
  if (new Set(params.keys()).size !== Array.from(params.keys()).length) return null;
  return Object.fromEntries(params);
}
