import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSalesManager } from "./access";

/** Membership is an additional constraint, never a grant of lead access. */
export async function organizerConstraints(profile: { id: string; role: string }, selection: { listId?: string; tagId?: string }) {
  const constraints: Prisma.LeadWhereInput[] = [];
  if (selection.listId) {
    const owner = isSalesManager(profile) ? {} : { ownerId: profile.id };
    if (!await prisma.leadList.findFirst({ where: { id: selection.listId, ...owner }, select: { id: true } })) return null;
    constraints.push({ lists: { some: { listId: selection.listId, list: owner } } });
  }
  if (selection.tagId) {
    if (!await prisma.tag.findFirst({ where: { id: selection.tagId }, select: { id: true } })) return null;
    constraints.push({ tags: { some: { tagId: selection.tagId } } });
  }
  return constraints;
}
