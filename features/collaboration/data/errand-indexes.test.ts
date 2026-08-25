import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The composite indexes the errand queries need, pinned to `firestore.indexes.json`.
 *
 * A deliberate copy of `features/lease/data/lease-indexes.test.ts`, and the duplication is the
 * point: that file's own note says it is worth copying for the next collection, because the gap it
 * guards is the one hole in this project's whole verification bar. The emulator the drivers run
 * against **does not enforce composite indexes at all**, so a missing one passes `pnpm verify`,
 * `pnpm build`, `pnpm test:rules` and every browser driver, and the first thing to say otherwise is
 * a `9 FAILED_PRECONDITION` on production — which is exactly how `/arriendos` broke the first time
 * it was opened there.
 *
 * No test can ask Firestore what it will require. What this one does is refuse to let the pair
 * drift: a query added without its index, or an index deleted, fails in milliseconds rather than on
 * somebody's screen. Colocated with the queries it guards so the two are read together.
 */
type Index = {
  readonly collectionGroup: string;
  readonly queryScope: string;
  readonly fields: readonly { readonly fieldPath: string; readonly order?: string }[];
};

const INDEXES: readonly Index[] = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).indexes;

/** One equality `where` plus one descending `orderBy` — the shape both errand queries ask for. */
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

describe("the errands' Firestore indexes", () => {
  /*
   * Two queries because Firestore cannot OR across two fields, so an errand is read once from the
   * collaborator's side and once from the landlord's. Each needs its own index.
   */
  it("cover both sides of the errand list", () => {
    expect(hasIndex("errands", "collaboratorUid", "dueAt")).toBe(true);
    expect(hasIndex("errands", "landlordUid", "dueAt")).toBe(true);
  });

  /** And the helper can say no: without this, the one above would pass on an empty file. */
  it("would notice a missing one", () => {
    expect(hasIndex("errands", "propertyId", "dueAt")).toBe(false);
    expect(hasIndex("errands", "collaboratorUid", "createdAt")).toBe(false);
  });
});
