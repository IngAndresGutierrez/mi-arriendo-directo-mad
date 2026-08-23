import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The composite indexes the tenancy's queries need, pinned to `firestore.indexes.json`.
 *
 * **This test exists because the whole verification bar missed one.** `listLeasesFor` runs
 * `where("tenantUid", "==", …).orderBy("createdAt", "desc")`, which Firestore refuses without a
 * composite index — and the emulator the browser drivers run against **does not enforce indexes at
 * all**. So `pnpm verify`, `pnpm build`, `pnpm test:rules` and thirty-five green drivers all passed,
 * and the first thing that said otherwise was a `9 FAILED_PRECONDITION` on production.
 *
 * No test can ask Firestore what it will require. What this one can do is refuse to let the pair
 * drift: a query added here without its index, or an index deleted, fails in seven milliseconds
 * instead of on somebody's screen. Colocated with the queries it guards, so the two are read
 * together.
 */
type Index = {
  readonly collectionGroup: string;
  readonly queryScope: string;
  readonly fields: readonly { readonly fieldPath: string; readonly order?: string }[];
};

const INDEXES: readonly Index[] = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).indexes;

/** One `where` on an equality plus one `orderBy` — the shape `listLeasesFor` asks for twice. */
function hasIndex(collectionGroup: string, equality: string, descending: string): boolean {
  return INDEXES.some(
    (index) =>
      index.collectionGroup === collectionGroup &&
      index.queryScope === "COLLECTION" &&
      index.fields.length === 2 &&
      index.fields[0]?.fieldPath === equality &&
      index.fields[0]?.order === "ASCENDING" &&
      index.fields[1]?.fieldPath === descending &&
      index.fields[1]?.order === "DESCENDING",
  );
}

describe("the tenancy's Firestore indexes", () => {
  /*
   * Dos consultas porque Firestore no sabe hacer un OR entre dos campos, así que `listLeasesFor`
   * pregunta una vez por cada lado del arriendo. Cada una necesita su índice.
   */
  it("cover both sides of listLeasesFor", () => {
    expect(hasIndex("leases", "tenantUid", "createdAt")).toBe(true);
    expect(hasIndex("leases", "landlordUid", "createdAt")).toBe(true);
  });

  /** Y el helper sabe decir que no: si no, el de arriba pasaría con el fichero vacío. */
  it("would notice a missing one", () => {
    expect(hasIndex("leases", "propertyId", "createdAt")).toBe(false);
    expect(hasIndex("inventado", "tenantUid", "createdAt")).toBe(false);
  });
});
