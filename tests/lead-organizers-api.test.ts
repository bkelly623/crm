import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), tagFind: vi.fn(), listFind: vi.fn(), tagCreate: vi.fn(), listCreate: vi.fn(), leadFind: vi.fn(), leadUpdate: vi.fn(), listOne: vi.fn(), tagOne: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: m.profile }));
vi.mock("@/lib/prisma", () => ({ prisma: { tag: { findMany: m.tagFind, create: m.tagCreate, findFirst: m.tagOne }, leadList: { findMany: m.listFind, create: m.listCreate, findFirst: m.listOne }, lead: { findFirst: m.leadFind, update: m.leadUpdate } } }));
import { GET, POST } from "@/app/api/lead-organizers/[kind]/route";
const ctx = (kind = "tags") => ({ params: Promise.resolve({ kind }) });
const request = (body?: unknown, query = "") => new Request(`http://localhost/api/lead-organizers/tags${query}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); m.profile.mockResolvedValue({ id: "rep", role: "sales_rep" });
  m.tagFind.mockResolvedValue([]); m.listFind.mockResolvedValue([]);
  m.tagCreate.mockImplementation(async ({ data }) => ({ id: "tag", ...data }));
  m.listCreate.mockImplementation(async ({ data }) => ({ id: "list", ...data }));
});
it.each([null, { id: "rep", role: "client" }, { id: "rep", role: "hiring_manager" }, { id: "rep", role: "project_manager" }, { id: "rep", role: "unknown" }])("denies catalogs for %j before DB reads or writes", async actor => {
  m.profile.mockResolvedValue(actor);
  for (const kind of ["tags", "lists"]) {
    expect((await GET(request(), ctx(kind))).status).toBe(actor ? 403 : 401);
    expect((await POST(request({ name: "Private" }), ctx(kind))).status).toBe(actor ? 403 : 401);
  }
  expect(m.tagFind).not.toHaveBeenCalled(); expect(m.listCreate).not.toHaveBeenCalled();
});
it.each([{ name: " " }, { name: "x".repeat(61) }, { name: "Bad\u0000name" }, { name: "ok", ownerId: "other" }, {}])("rejects invalid tag payload %j", async body => {
  expect((await POST(request(body), ctx())).status).toBe(400); expect(m.tagCreate).not.toHaveBeenCalled();
});
it("rejects invalid kinds, malformed JSON and untrimmed identifiers", async () => {
  expect((await GET(request(), ctx("anything"))).status).toBe(400);
  expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }), ctx())).status).toBe(400);
  expect((await GET(request(undefined, "?leadId=%20lead-1"), ctx())).status).toBe(400);
  expect((await GET(request(undefined, "?after=bad"), ctx())).status).toBe(400);
});
it("creates self-owned lists and scopes rep catalog to owner", async () => {
  expect((await POST(request({ name: " Pennsylvania " }), ctx("lists"))).status).toBe(201);
  expect(m.listCreate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "Pennsylvania", nameKey: "pennsylvania", owner: { connect: { id: "rep" } } } }));
  await GET(request(), ctx("lists"));
  expect(m.listFind.mock.calls[0][0].where).toEqual({ ownerId: "rep" });
  expect((await POST(request({ name: "x".repeat(81) }), ctx("lists"))).status).toBe(400);
});
it.each(["admin", "sales_manager"])("lets %s see lists across owners", async role => {
  m.profile.mockResolvedValue({ id: "boss", role }); await GET(request(), ctx("lists"));
  expect(m.listFind.mock.calls[0][0].where).toEqual({});
});
it("hides membership on inaccessible leads", async () => {
  m.leadFind.mockResolvedValue(null);
  expect((await GET(request(undefined, "?leadId=lead-1"), ctx())).status).toBe(404);
  expect(m.tagFind).not.toHaveBeenCalled();
  expect(m.leadFind.mock.calls[0][0].where).toEqual({ id: "lead-1", OR: [{ setterId: "rep" }, { closerId: "rep" }] });
});
it("returns only this lead's membership with bounded cursor pagination", async () => {
  m.leadFind.mockResolvedValue({ id: "lead-1" });
  const items = Array.from({ length: 51 }, (_, i) => ({ id: `c${String(i).padStart(24, "0")}`, name: `Tag ${i}`, leads: i === 0 ? [{ leadId: "lead-1" }] : [] }));
  m.tagFind.mockResolvedValue(items);
  const result = await (await GET(request(undefined, "?leadId=lead-1"), ctx())).json();
  expect(result.items).toHaveLength(50); expect(result.nextCursor).toBe(items[49].id);
  expect(result.items[0]).toEqual({ id: items[0].id, name: "Tag 0", selected: true });
  expect(m.tagFind.mock.calls[0][0]).toMatchObject({ take: 51, orderBy: { id: "asc" }, select: { leads: { where: { leadId: "lead-1" } } } });
  await GET(request(undefined, `?after=${items[49].id}`), ctx());
  expect(m.tagFind.mock.calls[1][0].where).toEqual({ id: { gt: items[49].id } });
});
it("reports duplicate names as conflict and sanitizes database errors", async () => {
  m.tagCreate.mockRejectedValue({ code: "P2002" });
  expect((await POST(request({ name: "Repeat" }), ctx())).status).toBe(409);
  m.listFind.mockRejectedValue(new Error("private database"));
  const response = await GET(request(), ctx("lists"));
  expect(response.status).toBe(500); expect(await response.text()).not.toContain("private database");
});
it("creates a bounded normalized tag and lists the catalog", async () => {
  const result = await POST(request({ name: "  High   Priority  " }), ctx());
  expect(result.status).toBe(201);
  expect(m.tagCreate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "High Priority", nameKey: "high priority" } }));
  m.tagFind.mockResolvedValue([{ id: "tag", name: "High Priority" }]);
  expect(await (await GET(request(), ctx())).json()).toEqual({ items: [{ id: "tag", name: "High Priority", selected: false }], nextCursor: null });
});
