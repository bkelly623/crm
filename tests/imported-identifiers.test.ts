import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), many: vi.fn(), first: vi.fn(), lists: vi.fn(), list: vi.fn(), update: vi.fn(), remove: vi.fn(), inventory: vi.fn(), query: vi.fn(), create: vi.fn(), lease: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.auth }));
vi.mock("@/lib/twilio/number-inventory", () => ({ ownedVoiceNumber: m.inventory }));
vi.mock("@/lib/twilio/intent-status", () => ({ readIntentStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { profile: { findUnique: m.profile }, lead: { findFirst: m.first, findMany: m.many, update: m.update }, leadList: { findMany: m.lists, findFirst: m.list }, leadListMembership: { deleteMany: m.remove }, $queryRaw: m.query, callIntent: { create: m.create }, callIntentLease: { findFirst: m.lease, deleteMany: vi.fn() } };
  return { prisma: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } };
});
import { GET as catalog } from "@/app/api/lead-organizers/[kind]/route";
import { GET as queue } from "@/app/api/dialer/next-lead/route";
import { POST as issue } from "@/app/api/dialer/intents/route";
import { GET as leads } from "@/app/api/leads/route";
import { GET as detail, PATCH as patchLead } from "@/app/api/leads/[id]/route";
import { PUT as add, DELETE as remove } from "@/app/api/leads/[id]/organizers/[kind]/route";
import { organizerIdentifier } from "@/lib/leads/organizer-validation";
import { fixtureLead, matches } from "./support/lead-query-fixture";

// Exact persisted IDs; all other fields are synthetic. No real DB/provider calls.
const verifiedList = "verified-list-41ac9df9-f2cd-4793-9025-71921a609c08";
const pilotList = "pilot-list-107c30fb-4431-47db-8abc-449275d999d6";
const imported = ["verified-d3c09531-2ded-49ac-97ae-6822b488ee6f", "verified-c2071910-3c79-4227-b2a5-1a59d7935c06", "verified-da63434a-dcc7-4d66-84f1-1e02283a39d5"].sort();
const user = "00000000-0000-4000-8000-000000000001";
const callerIdSid = "PN" + "1".repeat(32);
type Row = Record<string, unknown>;
let rows: Row[], listRows: Row[];
const req = (query = "") => new Request(`https://crm.example.test/api/test?${query}`);
const body = (value: unknown, method = "POST") => new Request("https://crm.example.test/api/test", { method, body: JSON.stringify(value) });
const context = (id: string) => ({ params: Promise.resolve({ id, kind: "lists" }) });
const catalogContext = () => ({ params: Promise.resolve({ kind: "lists" }) });
const select = (data: Row[], where: unknown) => data.filter(row => matches(row, where)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("TWILIO_CALLING_ENABLED", "true");
  const profile = { id: user, role: "sales_rep" };
  m.auth.mockResolvedValue(profile);
  m.profile.mockImplementation(({ where }) => where.id === user ? profile : null);
  listRows = [verifiedList, pilotList].map(id => ({ id, name: "Synthetic list", ownerId: user }));
  rows = imported.map(id => fixtureLead(id, { setterId: user, phone: "+12025550123", lists: listRows.map(list => ({ listId: list.id, list })) }));
  m.list.mockImplementation(({ where }) => select(listRows, where)[0] ?? null);
  m.lists.mockImplementation(({ where, take, select: fields }) => select(listRows, where).slice(0, take).map(list => ({ ...list, leads: fields.leads ? rows.filter(lead => matches(lead, fields.leads.where.lead) && lead.id === fields.leads.where.leadId && (lead.lists as Row[]).some(link => link.listId === list.id)).map(lead => ({ leadId: lead.id })) : [] })));
  m.first.mockImplementation(({ where }) => select(rows, where)[0] ?? null);
  m.many.mockImplementation(({ where, take }) => select(rows, where).slice(0, take));
  m.update.mockImplementation(({ where, data }) => {
    const row = select(rows, where)[0];
    if (!row) throw new Error("Synthetic scoped write denied");
    if (data.lists) {
      const upsert = data.lists.upsert;
      for (const branch of [upsert.create, upsert.update]) if (!select(listRows, branch.list.connect).length) throw new Error("Synthetic list ownership denied");
    }
    return row;
  });
  m.remove.mockImplementation(({ where }) => ({ count: rows.reduce((count, lead) => count + (lead.lists as Row[]).filter(link => matches({ ...link, leadId: lead.id, lead }, where)).length, 0) }));
  m.inventory.mockResolvedValue({ sid: callerIdSid, accountSid: "AC" + "0".repeat(32), phoneNumber: "+12025550124" });
  m.lease.mockResolvedValue(null);
  m.query.mockImplementation((sql: TemplateStringsArray) => sql.join("").includes("SELECT clock_timestamp()") ? [{ now: new Date("2030-01-01T00:00:00Z") }] : []);
});

it.each([verifiedList, pilotList])("catalog → queue → real intent handler accepts unchanged persisted IDs (%s)", async listId => {
  const inventory = await catalog(req(), catalogContext());
  expect(inventory.status).toBe(200);
  expect((await inventory.json()).items.some((item: { id: string }) => item.id === listId)).toBe(true);
  const excluded: string[] = [];
  for (const leadId of imported) {
    const response = await queue(req(new URLSearchParams([['listId', listId], ...excluded.map(id => ['exclude', id])]).toString()));
    expect(response.status).toBe(200);
    expect((await response.json()).lead.id).toBe(leadId);
    const intent = await issue(body({ leadId, callerIdSid }));
    expect(intent.status).toBe(201);
    expect(m.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ leadId, userId: user }) });
    excluded.push(leadId);
  }
  expect((await (await queue(req(new URLSearchParams([['listId', listId], ...excluded.map(id => ['exclude', id])]).toString()))).json()).lead).toBeNull();
  // Both authorization reads in the actual reservation service evaluated fixtures.
  expect(m.inventory).toHaveBeenCalledTimes(imported.length);
});

it("supports filtered leads, lead cursors, selected memberships and organizer cursors", async () => {
  const response = await leads(req(`listId=${verifiedList}&after=${imported[0]}`));
  expect(response.status).toBe(200);
  expect((await response.json()).leads.map((row: Row) => row.id)).toEqual(imported.slice(1));
  const response2 = await catalog(req(`leadId=${imported[0]}&after=${pilotList}`), catalogContext());
  expect(response2.status).toBe(200);
  expect((await response2.json()).items).toEqual([{ id: verifiedList, name: "Synthetic list", selected: true }]);
});
it.each(imported)("detail read/write and membership add/remove preserve imported ID %s", async id => {
  expect((await detail(req(), context(id))).status).toBe(200);
  expect((await patchLead(body({ sdrStatus: "follow_up_needed" }, "PATCH"), context(id))).status).toBe(200);
  expect((await add(body({ organizerId: verifiedList }, "PUT"), context(id))).status).toBe(200);
  expect((await remove(body({ organizerId: verifiedList }, "DELETE"), context(id))).status).toBe(200);
});
it("rejects another owner's imported list without querying candidates or creating an intent", async () => {
  listRows.forEach(row => { row.ownerId = "other"; });
  expect((await (await catalog(req(), catalogContext())).json()).items).toEqual([]);
  for (const handler of [queue, leads]) expect((await handler(req(`listId=${verifiedList}`))).status).toBe(404);
  expect(m.first).not.toHaveBeenCalled();
  expect((await add(body({ organizerId: verifiedList }, "PUT"), context(imported[0]))).status).toBe(404);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("list membership never grants access to another owner's imported lead", async () => {
  rows.forEach(row => { row.setterId = "other"; });
  expect((await (await queue(req(`listId=${verifiedList}`))).json()).lead).toBeNull();
  expect((await (await leads(req(`listId=${verifiedList}`))).json()).leads).toEqual([]);
  for (const id of imported) {
    expect((await issue(body({ leadId: id, callerIdSid }))).status).toBe(409);
    expect((await detail(req(), context(id))).status).toBe(404);
    expect((await patchLead(body({ sdrStatus: "follow_up_needed" }, "PATCH"), context(id))).status).toBe(404);
    expect((await catalog(req(`leadId=${id}`), catalogContext())).status).toBe(404);
    expect((await add(body({ organizerId: verifiedList }, "PUT"), context(id))).status).toBe(404);
  }
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.inventory).not.toHaveBeenCalled();
});
it.each(["bad", verifiedList + "' OR 1=1--", verifiedList + "\n", " " + pilotList, verifiedList.toUpperCase(), verifiedList.replace("41ac9df9", "zzzzzzzz"), verifiedList.replace("4793", "0793"), verifiedList.replace("9025", "7025"), "other-list-41ac9df9-f2cd-4793-9025-71921a609c08", "x".repeat(201)])("rejects malformed organizer ID without DB access: %j", async id => {
  expect(organizerIdentifier.safeParse(id).success).toBe(false);
  const encoded = encodeURIComponent(id);
  for (const handler of [queue, leads]) expect((await handler(req(`listId=${encoded}`))).status).toBe(400);
  expect((await catalog(req(`after=${encoded}`), catalogContext())).status).toBe(400);
  expect((await add(body({ organizerId: id }, "PUT"), context(imported[0]))).status).toBe(400);
  expect(m.list).not.toHaveBeenCalled(); expect(m.first).not.toHaveBeenCalled(); expect(m.lists).not.toHaveBeenCalled();
});
it.each(["", " lead", "x".repeat(201)])("invalid lead input is denied by queue, catalog, membership and intent: %j", async leadId => {
  expect((await queue(req(`exclude=${encodeURIComponent(leadId)}`))).status).toBe(400);
  expect((await catalog(req(`leadId=${encodeURIComponent(leadId)}`), catalogContext())).status).toBe(400);
  expect((await add(body({ organizerId: verifiedList }, "PUT"), context(leadId))).status).toBe(400);
  expect((await issue(body({ leadId, callerIdSid }))).status).toBe(400);
  expect(m.first).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
});
it.each(["c12345678", "cm123456789012345678901234", "c" + "a".repeat(24), "c" + "a".repeat(99)])("retains bounded alphanumeric CUID support: %s", id => {
  expect(organizerIdentifier.parse(id)).toBe(id);
});
it.each(["c1234567", "cabc!@#$%^", "c" + "a".repeat(100), "c" + "a".repeat(24) + "\n"])("rejects malformed or oversized CUID-like value: %j", id => {
  expect(organizerIdentifier.safeParse(id).success).toBe(false);
});
it.each(["admin", "sales_manager"])("preserves %s access to other-owned imported lists", async role => {
  m.auth.mockResolvedValue({ id: user, role });
  listRows.forEach(row => { row.ownerId = "other"; });
  rows.forEach(row => { row.setterId = "other"; });
  expect((await (await catalog(req(), catalogContext())).json()).items).toHaveLength(2);
  expect((await queue(req(`listId=${verifiedList}`))).status).toBe(200);
  expect((await (await leads(req(`listId=${verifiedList}`))).json()).leads).toHaveLength(3);
});
it("rechecks imported lead assignment under transaction locks after inventory", async () => {
  m.inventory.mockImplementation(async () => {
    rows.forEach(row => { row.setterId = "other"; });
    return { sid: callerIdSid, accountSid: "AC" + "0".repeat(32), phoneNumber: "+12025550124" };
  });
  expect((await issue(body({ leadId: imported[0], callerIdSid }))).status).toBe(409);
  expect(m.first).toHaveBeenCalledTimes(2);
  expect(m.create).not.toHaveBeenCalled();
});
it.each(["dnc", "wrong_number", "not_interested"])("does not admit imported %s leads through queue or intent", async sdrStatus => {
  rows.forEach(row => { row.sdrStatus = sdrStatus; });
  expect((await (await queue(req(`listId=${verifiedList}`))).json()).lead).toBeNull();
  expect((await issue(body({ leadId: imported[0], callerIdSid }))).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled();
});
it("injection-shaped lead strings stay literal scoped lookup values and never authorize access", async () => {
  const leadId = imported[0] + "' OR 1=1--";
  expect((await detail(req(), context(leadId))).status).toBe(404);
  expect((await issue(body({ leadId, callerIdSid }))).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled(); expect(m.query).not.toHaveBeenCalled();
});
