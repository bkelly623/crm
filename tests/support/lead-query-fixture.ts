// Synthetic, deliberately small Prisma predicate evaluator for offline route tests.
// This checks composed predicates against fixture rows; it is NOT a database emulator.
type Row = Record<string, unknown>;
export function matches(row: Row, input: unknown): boolean {
  const where = input as Row;
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every(part => matches(row, part));
    if (key === "OR") return (value as unknown[]).some(part => matches(row, part));
    if (value === null || typeof value !== "object") return row[key] === value;
    const test = value as Row;
    if ("none" in test) return !(row[key] as Row[]).some(link => matches(link, test.none));
    if ("gte" in test) return row[key] != null && new Date(row[key] as string).getTime() >= new Date(test.gte as string).getTime();
    if ("some" in test) return (row[key] as Row[]).some(link => matches(link, test.some));
    if ("contains" in test) return String(row[key] ?? "").toLowerCase().includes(String(test.contains).toLowerCase());
    if ("not" in test) return row[key] !== test.not;
    if ("notIn" in test) return !(test.notIn as unknown[]).includes(row[key]);
    if ("in" in test) return (test.in as unknown[]).includes(row[key]);
    if ("gt" in test) return String(row[key]) > String(test.gt);
    return matches(row[key] as Row, test);
  });
}
export function fixtureLead(id: string, extra: Row = {}): Row {
  return { id, businessName: `Fixture ${id}`, phone: "15550000000", contactName: null, email: null, setterId: "rep", closerId: null, segment: "active", sdrStatus: "no_contact", lists: [], tags: [], calls: [], ...extra };
}
