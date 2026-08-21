/**
 * Public catalog behaviour: which anonymous queries are allowed.
 * `list` is evaluated per candidate document, so the query itself must be bounded.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { anonymous, createTestEnvironment, seed } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

describe("public catalog (anonymous)", () => {
  it("list with NO filter: the draft pollutes the result -> denied", async () => {
    await assertFails(getDocs(collection(anonymous(env), "properties")));
  });

  it("list filtering by status == 'available' -> allowed", async () => {
    await assertSucceeds(
      getDocs(
        query(collection(anonymous(env), "properties"), where("status", "==", "available"), limit(20)),
      ),
    );
  });

  it("list filtered by city + status (the catalog's real query) -> allowed", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(anonymous(env), "properties"),
          where("city", "==", "Bogotá"),
          where("status", "==", "available"),
          limit(20),
        ),
      ),
    );
  });

  it("list filtering by status == 'draft' -> denied", async () => {
    await assertFails(
      getDocs(query(collection(anonymous(env), "properties"), where("status", "==", "draft"))),
    );
  });

  // Real Firestore behaviour (verified against the emulator): an unfiltered `list` is
  // denied even when the collection is EMPTY. The rule must be verifiable from the
  // query, not from the result. Practical consequence: the public catalog must ALWAYS
  // query with where("status", "==", "available").
  it("empty collection with no filter -> denied all the same", async () => {
    await env.clearFirestore();
    await assertFails(getDocs(collection(anonymous(env), "properties")));
  });
});
