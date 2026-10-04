import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const schema = readFileSync("prisma/schema.prisma", "utf8");
it("keeps the unapplied SQL additive and denies direct public table access by default", () => {
  const sql = readFileSync("docs/schema-drafts/tags-lists.sql", "utf8");
  expect(sql).toContain("DRAFT ONLY — NOT APPLIED");
  expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/);
  expect(sql).not.toMatch(/ALTER TABLE "(?:leads|profiles|tasks|calls)"/);
  for (const table of ["tags", "lead_tags", "lead_lists", "lead_list_memberships"]) {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
    expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
  }
  expect(sql).toContain('PRIMARY KEY ("lead_id","list_id")');
});
it("stores tags and named lists as unique links to one master lead", () => {
  for (const model of ["Tag", "LeadTag", "LeadList", "LeadListMembership"]) expect(schema).toContain(`model ${model} {`);
  expect(schema).toContain("@@id([leadId, tagId])");
  expect(schema).toContain("@@id([leadId, listId])");
  expect(schema).toContain("@@unique([ownerId, nameKey])");
  expect(schema).toMatch(/nameKey\s+String\s+@unique/);
  expect(schema.match(/model Lead \{/g)).toHaveLength(1);
});
