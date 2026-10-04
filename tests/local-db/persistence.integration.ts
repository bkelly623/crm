import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient, type Profile } from "@prisma/client";
import { assertLocalUrl } from "./guard";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as leadRoute from "@/app/api/leads/[id]/route";
import * as taskRoute from "@/app/api/tasks/route";
import * as catalog from "@/app/api/lead-organizers/[kind]/route";
import * as membership from "@/app/api/leads/[id]/organizers/[kind]/route";

const url = assertLocalUrl(process.env.POSTGRES_PRISMA_URL ?? "");
// Independent connection/client, not the app singleton and not a Prisma mock.
const readback = new PrismaClient({ datasourceUrl: url, log: [] });
const ns = `local-app-${randomUUID()}`;
const ids = { owned: `${ns}-owned`, other: `${ns}-other`, unassigned: `${ns}-unassigned`, denied: `${ns}-denied` };
const profiles: Profile[] = [];
const createdLeads: string[] = [];
const tasks = new Set<string>();
const tags = new Set<string>();
const lists = new Set<string>();
const links: { kind: "tags" | "lists"; leadId: string; organizerId: string }[] = [];
const organizerNames: { kind: "tags" | "lists"; name: string }[] = [];
let rep: Profile, other: Profile, manager: Profile, client: Profile;
let identityVerified = false;
let baseline: unknown;
const tables = ["profiles", "leads", "tasks", "calls", "smart_views", "org_settings", "tags", "lead_tags", "lead_lists", "lead_list_memberships"];
async function snapshot() {
  const result = [];
  for (const table of tables) result.push(await readback.$queryRaw(Prisma.sql`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${Prisma.raw(`"${table}"`)} t`));
  return result;
}
function actor(profile: Profile | null) { vi.mocked(getCurrentProfile).mockResolvedValue(profile); }
function request(method: string, body?: unknown) {
  return new Request("http://127.0.0.1/local-in-process-only", { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) });
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const kindContext = (kind: "tags" | "lists") => ({ params: Promise.resolve({ kind }) });
const linkContext = (kind: "tags" | "lists", id = ids.owned) => ({ params: Promise.resolve({ kind, id }) });
async function createTask() {
  const response = await taskRoute.POST(request("POST", { leadId: ids.owned, note: `${ns} follow-up`, dueAt: "2030-01-02T03:04:05.678Z" }));
  const body = await response.json();
  if (body.task?.id) tasks.add(body.task.id);
  expect(response.status).toBe(201);
  return body.task as { id: string; status: string; dueAt: string; userId: string };
}
async function createOrganizer(kind: "tags" | "lists", suffix: string) {
  const name = `${ns} ${suffix}`;
  organizerNames.push({ kind, name });
  const response = await catalog.POST(request("POST", { name }), kindContext(kind));
  const body = await response.json();
  if (body.item?.id) (kind === "tags" ? tags : lists).add(body.item.id);
  expect(response.status).toBe(201);
  return body.item as { id: string; name: string };
}
async function setLink(kind: "tags" | "lists", organizerId: string, id = ids.owned) {
  links.push({ kind, leadId: id, organizerId });
  return membership.PUT(request("PUT", { organizerId }), linkContext(kind, id));
}

beforeAll(async () => {
  assertLocalUrl(url);
  const expected = [{ database: "crm_local_staging", port: 5432 }];
  for (const db of [prisma, readback]) {
    expect(await db.$queryRaw`SELECT current_database() AS database, inet_server_port() AS port`).toEqual(expected);
  }
  identityVerified = true; // No write until both actual connections prove identity.
  baseline = await snapshot();
  for (const role of ["sales_rep", "sales_rep", "sales_manager", "client"] as const) {
    const id = randomUUID();
    profiles.push(await readback.profile.create({ data: { id, email: `${ns}-${id}@example.invalid`, fullName: `${ns} synthetic`, role } }));
  }
  [rep, other, manager, client] = profiles;
  for (const [id, setterId] of [[ids.owned, rep.id], [ids.other, other.id], [ids.unassigned, null], [ids.denied, client.id]] as const) {
    await readback.lead.create({ data: { id, businessName: `${ns} synthetic business`, setterId, source: "manual", segment: "active", notes: "Synthetic initial notes", phone: null } });
    createdLeads.push(id);
  }
});

afterAll(async () => {
  try {
    if (!identityVerified) return;
    assertLocalUrl(url);
    // Recover IDs from exact owned fixtures if an assertion/response failed after commit.
    for (const row of await readback.task.findMany({ where: { leadId: { in: createdLeads }, userId: { in: profiles.map(p => p.id) } }, select: { id: true } })) tasks.add(row.id);
    for (const entry of organizerNames) {
      if (entry.kind === "tags") {
        for (const row of await readback.tag.findMany({ where: { name: entry.name }, select: { id: true } })) tags.add(row.id);
      } else {
        for (const row of await readback.leadList.findMany({ where: { name: entry.name, ownerId: { in: profiles.map(p => p.id) } }, select: { id: true } })) lists.add(row.id);
      }
    }
    // Deletions are exclusively exact IDs/composite IDs; no prefix/table-wide deletion.
    for (const link of links) {
      if (link.kind === "tags") await readback.leadTag.deleteMany({ where: { leadId: link.leadId, tagId: link.organizerId } });
      else await readback.leadListMembership.deleteMany({ where: { leadId: link.leadId, listId: link.organizerId } });
    }
    for (const id of tasks) await readback.task.deleteMany({ where: { id } });
    for (const id of tags) await readback.tag.deleteMany({ where: { id } });
    for (const id of lists) await readback.leadList.deleteMany({ where: { id } });
    for (const id of createdLeads) await readback.lead.deleteMany({ where: { id } });
    for (const profile of profiles) await readback.profile.deleteMany({ where: { id: profile.id } });
    expect(await snapshot()).toEqual(baseline);
    console.info("LOCAL_DB_CLEANUP_PASS: exact fixtures removed; all 10 table counts/content digests equal pre-run baseline");
  } finally {
    await Promise.all([readback.$disconnect(), prisma.$disconnect()]);
  }
});

describe("real local PostgreSQL + current handlers; auth explicitly mocked", () => {
  it("rejects nonlocal, wrong-port/database and URL override attempts before writes", () => {
    const base = "postgresql://synthetic:synthetic@127.0.0.1:55437/crm_local_staging?connection_limit=2";
    expect(assertLocalUrl(base)).toBe(base);
    for (const bad of [base.replace("127.0.0.1", "localhost"), base.replace("127.0.0.1", "example.invalid"), base.replace("55437", "5432"), base.replace("crm_local_staging", "postgres"), `${base}&host=example.invalid`, `${base}#x`]) expect(() => assertLocalUrl(bad)).toThrow();
  });

  it("GET/PATCH persists edited fields and shared multiline Notes through independent reads", async () => {
    actor(rep);
    const response = await leadRoute.GET(request("GET"), context(ids.owned));
    expect(response.status).toBe(200);
    expect((await response.json()).lead.id).toBe(ids.owned);
    const notes = "Synthetic shared Notes\nUnicode café — no authored history";
    const patch = await leadRoute.PATCH(request("PATCH", { businessName: `${ns} edited`, notes, segment: "won", email: "synthetic@example.invalid" }), context(ids.owned));
    expect(patch.status).toBe(200);
    expect(await readback.lead.findUniqueOrThrow({ where: { id: ids.owned } })).toMatchObject({ businessName: `${ns} edited`, notes, segment: "won", source: "manual", setterId: rep.id, email: "synthetic@example.invalid" });
    expect((await (await leadRoute.GET(request("GET"), context(ids.owned))).json()).lead.notes).toBe(notes);
    expect((await leadRoute.PATCH(request("PATCH", { notes: null }), context(ids.owned))).status).toBe(200);
    expect((await readback.lead.findUniqueOrThrow({ where: { id: ids.owned } })).notes).toBeNull();
  });

  it("creates/completes an owned task and round-trips a real timestamptz instant", async () => {
    actor(rep);
    const task = await createTask();
    expect(task).toMatchObject({ status: "open", userId: rep.id, dueAt: "2030-01-02T03:04:05.678Z" });
    const stored = await readback.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.dueAt.toISOString()).toBe(task.dueAt);
    expect(stored.note).toBe(`${ns} follow-up`);
    expect((await (await leadRoute.GET(request("GET"), context(ids.owned))).json()).lead.tasks.map((t: { id: string }) => t.id)).toContain(task.id);
    const response = await taskRoute.PATCH(request("PATCH", { id: task.id, status: "completed" }));
    expect(await response.json()).toEqual({ updated: 1 });
    expect((await readback.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("completed");
    expect((await (await leadRoute.GET(request("GET"), context(ids.owned))).json()).lead.tasks.map((t: { id: string }) => t.id)).not.toContain(task.id);
  });

  it("denies another task owner, including a manager, without changing persisted status", async () => {
    actor(rep);
    const task = await createTask();
    for (const who of [other, manager]) {
      actor(who);
      const response = await taskRoute.PATCH(request("PATCH", { id: task.id, status: "completed" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ updated: 0 });
      expect((await readback.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("open");
    }
  });

  it.each(["tags", "lists"] as const)("creates %s, repeats membership add/remove idempotently, without copying leads", async (kind) => {
    actor(rep);
    const item = await createOrganizer(kind, kind);
    const stored = kind === "tags" ? await readback.tag.findUniqueOrThrow({ where: { id: item.id } }) : await readback.leadList.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.name).toBe(item.name);
    expect(stored.nameKey).toBe(item.name.toLowerCase());
    expect(stored.createdAt).toBeInstanceOf(Date);
    if ("ownerId" in stored) expect(stored.ownerId).toBe(rep.id);
    const count = await readback.lead.count();
    for (let i = 0; i < 2; i++) expect((await setLink(kind, item.id)).status).toBe(200);
    const where = kind === "tags" ? { leadId: ids.owned, tagId: item.id } : { leadId: ids.owned, listId: item.id };
    const linkCount = () => kind === "tags" ? readback.leadTag.count({ where }) : readback.leadListMembership.count({ where });
    expect(await linkCount()).toBe(1);
    const response = await catalog.GET(new Request(`http://127.0.0.1/api/lead-organizers/${kind}?leadId=${ids.owned}`), kindContext(kind));
    expect(response.status).toBe(200);
    expect((await response.json()).items).toContainEqual({ id: item.id, name: item.name, selected: true });
    for (let i = 0; i < 2; i++) expect((await membership.DELETE(request("DELETE", { organizerId: item.id }), linkContext(kind))).status).toBe(200);
    expect(await linkCount()).toBe(0);
    expect(await readback.lead.count()).toBe(count);
  });

  it("denies a foreign list owner and out-of-scope/unassigned lead memberships", async () => {
    actor(other);
    const foreignList = await createOrganizer("lists", "foreign");
    actor(rep);
    expect((await setLink("lists", foreignList.id)).status).toBe(404);
    const tag = await createOrganizer("tags", "scope");
    for (const id of [ids.other, ids.unassigned]) expect((await setLink("tags", tag.id, id)).status).toBe(404);
    expect(await readback.leadListMembership.count({ where: { listId: foreignList.id } })).toBe(0);
    expect(await readback.leadTag.count({ where: { tagId: tag.id } })).toBe(0);
  });

  it("denies other-owner/unassigned lead reads, edits and task creation with no DB effects", async () => {
    actor(rep);
    for (const id of [ids.other, ids.unassigned]) {
      const before = await readback.lead.findUniqueOrThrow({ where: { id } });
      expect((await leadRoute.GET(request("GET"), context(id))).status).toBe(404);
      expect((await leadRoute.PATCH(request("PATCH", { notes: "must not persist" }), context(id))).status).toBe(404);
      expect((await taskRoute.POST(request("POST", { leadId: id, note: "denied", dueAt: "2030-01-01T00:00:00Z" }))).status).toBe(404);
      expect(await readback.lead.findUniqueOrThrow({ where: { id } })).toEqual(before);
      expect(await readback.task.count({ where: { leadId: id } })).toBe(0);
    }
    expect((await leadRoute.PATCH(request("PATCH", { setterId: other.id }), context(ids.owned))).status).toBe(403);
    expect((await readback.lead.findUniqueOrThrow({ where: { id: ids.owned } })).setterId).toBe(rep.id);
  });

  it("denies non-sales even when assigned, and anonymous access, across all handler writes", async () => {
    actor(rep);
    const task = await createTask();
    const tag = await createOrganizer("tags", "role-denial");
    for (const who of [client, null]) {
      actor(who);
      const status = who ? 403 : 401;
      const before = await snapshot();
      expect((await leadRoute.GET(request("GET"), context(ids.denied))).status).toBe(status);
      expect((await leadRoute.PATCH(request("PATCH", { notes: "denied" }), context(ids.denied))).status).toBe(status);
      expect((await taskRoute.POST(request("POST", { leadId: ids.denied, note: "denied", dueAt: "2030-01-01T00:00:00Z" }))).status).toBe(status);
      expect((await taskRoute.PATCH(request("PATCH", { id: task.id, status: "completed" }))).status).toBe(status);
      expect((await catalog.POST(request("POST", { name: `${ns} denied` }), kindContext("tags"))).status).toBe(status);
      expect((await catalog.GET(request("GET"), kindContext("lists"))).status).toBe(status);
      expect((await setLink("tags", tag.id, ids.denied)).status).toBe(status);
      expect((await membership.DELETE(request("DELETE", { organizerId: tag.id }), linkContext("tags", ids.denied))).status).toBe(status);
      expect(await snapshot()).toEqual(before);
    }
  });

  it("permits manager unassigned access and persists authorized UUID assignment", async () => {
    actor(manager);
    expect((await leadRoute.GET(request("GET"), context(ids.unassigned))).status).toBe(200);
    expect((await leadRoute.PATCH(request("PATCH", { closerId: rep.id }), context(ids.unassigned))).status).toBe(200);
    expect((await readback.lead.findUniqueOrThrow({ where: { id: ids.unassigned } })).closerId).toBe(rep.id);
    actor(rep);
    expect((await leadRoute.GET(request("GET"), context(ids.unassigned))).status).toBe(200);
  });

  it("keeps one master lead in two real named lists", async () => {
    actor(rep);
    const first = await createOrganizer("lists", "first");
    const second = await createOrganizer("lists", "second");
    const before = await readback.lead.count();
    for (const item of [first, second]) expect((await setLink("lists", item.id)).status).toBe(200);
    expect(await readback.leadListMembership.count({ where: { leadId: ids.owned, listId: { in: [first.id, second.id] } } })).toBe(2);
    expect(await readback.lead.count()).toBe(before);
    expect(await readback.lead.count({ where: { id: ids.owned } })).toBe(1);
  });

  it("revokes task completion after real manager reassignment of its lead", async () => {
    actor(rep);
    const task = await createTask();
    actor(manager);
    expect((await leadRoute.PATCH(request("PATCH", { setterId: other.id }), context(ids.owned))).status).toBe(200);
    actor(rep);
    const response = await taskRoute.PATCH(request("PATCH", { id: task.id, status: "completed" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 0 });
    expect((await readback.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("open");
    actor(manager);
    expect((await leadRoute.PATCH(request("PATCH", { setterId: rep.id }), context(ids.owned))).status).toBe(200);
  });

  it("confirms native UUID/enums/timestamptz versus draft timestamp types and atomic ORM rollback", async () => {
    const types = await readback.$queryRaw<{ table_name: string; column_name: string; udt_name: string; datetime_precision: number | null }[]>`SELECT table_name, column_name, udt_name, datetime_precision FROM information_schema.columns WHERE table_schema='public' AND ((table_name='profiles' AND column_name IN ('id','role','created_at')) OR (table_name='tasks' AND column_name IN ('due_at','status')) OR (table_name='tags' AND column_name='created_at') OR (table_name='lead_lists' AND column_name='owner_id'))`;
    expect(types).toEqual(expect.arrayContaining([
      expect.objectContaining({ table_name: "profiles", column_name: "id", udt_name: "uuid" }),
      expect.objectContaining({ table_name: "profiles", column_name: "role", udt_name: "UserRole" }),
      expect.objectContaining({ table_name: "profiles", column_name: "created_at", udt_name: "timestamptz", datetime_precision: 6 }),
      expect.objectContaining({ table_name: "tasks", column_name: "due_at", udt_name: "timestamptz", datetime_precision: 6 }),
      expect.objectContaining({ table_name: "tasks", column_name: "status", udt_name: "TaskStatus" }),
      expect.objectContaining({ table_name: "tags", column_name: "created_at", udt_name: "timestamp", datetime_precision: 3 }),
      expect.objectContaining({ table_name: "lead_lists", column_name: "owner_id", udt_name: "uuid" }),
    ]));
    const before = await readback.lead.findUniqueOrThrow({ where: { id: ids.owned } });
    await expect(prisma.$transaction(async tx => {
      await tx.lead.update({ where: { id: ids.owned }, data: { notes: "rollback sentinel" } });
      // Real missing UUID FK rejects second write; first write must roll back.
      await tx.lead.update({ where: { id: ids.owned }, data: { setterId: randomUUID() } });
    })).rejects.toMatchObject({ code: "P2003" });
    expect(await readback.lead.findUniqueOrThrow({ where: { id: ids.owned } })).toEqual(before);
    await expect(readback.profile.findUnique({ where: { id: "not-a-uuid" } })).rejects.toMatchObject({ code: "P2023" });
  });
});
