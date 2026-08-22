/**
 * Tests for firestore.rules. Every block covers the allowed case AND the denied one:
 * a rule without a negative case proves nothing.
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  anonymous,
  actingAs,
  createTestEnvironment,
  publishedProperty,
  CONTRACT_ID,
  PROPERTY_ID,
  APPLICATION_ID,
  seed,
  UID_ADMIN,
  UID_TENANT,
  UID_LANDLORD,
  UID_THIRD_PARTY,
} from "./helpers";

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

describe("users", () => {
  it("the owner reads their profile", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertSucceeds(getDoc(doc(db, `users/${UID_TENANT}`)));
  });

  it("a third party does NOT read someone else's profile", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    await assertFails(getDoc(doc(db, `users/${UID_TENANT}`)));
  });

  it("nobody enumerates users (admin only)", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(getDocs(collection(db, "users")));
    await assertSucceeds(getDocs(collection(actingAs(env, UID_ADMIN, "admin"), "users")));
  });

  it("the user CANNOT escalate their own role", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(db, `users/${UID_TENANT}`), { phone: "+573009999999" }));
  });

  it("identity documents are private to the owner", async () => {
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `users/${UID_TENANT}/documents/id-front`)),
    );
    // neither a third party nor the property's landlord sees the national id
    await assertFails(
      getDoc(
        doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `users/${UID_TENANT}/documents/id-front`),
      ),
    );
    await assertFails(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `users/${UID_TENANT}/documents/id-front`)),
    );
  });

  it("an identity document CANNOT point at another user's storage", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(
      setDoc(doc(db, `users/${UID_TENANT}/documents/forged`), {
        type: "id_front",
        storagePath: `applicants/${UID_THIRD_PARTY}/id-front.jpg`,
        uploadedAt: new Date(),
      }),
    );
  });

  it("identity documents are append-only for the owner", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(deleteDoc(doc(db, `users/${UID_TENANT}/documents/id-front`)));
  });
});

describe("properties", () => {
  it("the published catalog is visible without signing in", async () => {
    await assertSucceeds(getDoc(doc(anonymous(env), `properties/${PROPERTY_ID}`)));
  });

  it("a draft is NOT visible to third parties, but is to its owner", async () => {
    await assertFails(getDoc(doc(anonymous(env), "properties/property-draft")));
    await assertFails(
      getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), "properties/property-draft")),
    );
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), "properties/property-draft")),
    );
  });

  it("a tenant CANNOT create properties", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(
      addDoc(collection(db, "properties"), publishedProperty({ landlordUid: UID_TENANT })),
    );
  });

  it("a landlord CANNOT publish on someone else's behalf", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(
      addDoc(collection(db, "properties"), publishedProperty({ landlordUid: UID_THIRD_PARTY })),
    );
  });

  it("a landlord publishes their own property", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertSucceeds(addDoc(collection(db, "properties"), publishedProperty()));
  });

  it("the public document CANNOT carry the street address", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    // inside `area`...
    await assertFails(
      addDoc(collection(db, "properties"), publishedProperty({
        area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas", line: "Calle 60 #10-20" },
      })),
    );
    // ...or as a top-level `address`
    await assertFails(
      addDoc(collection(db, "properties"), publishedProperty({ address: { line: "Calle 60 #10-20" } })),
    );
  });

  it("rejects a property with no photos", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(addDoc(collection(db, "properties"), publishedProperty({ photos: [] })));
  });

  it("rejects a lease shorter than the product allows", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(addDoc(collection(db, "properties"), publishedProperty({ minLeaseMonths: 1 })));
  });

  it("rejects a parking value outside the three options", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(addDoc(collection(db, "properties"), publishedProperty({ parking: 2 })));
    await assertFails(addDoc(collection(db, "properties"), publishedProperty({ parking: "garaje" })));
  });

  it("rejects a stratum outside 1-6", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(addDoc(collection(db, "properties"), publishedProperty({ stratum: 7 })));
  });

  it("the exact address is private: only the owner and admin read it", async () => {
    const path = `properties/${PROPERTY_ID}/private/location`;
    await assertSucceeds(getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), path)));
    await assertSucceeds(getDoc(doc(actingAs(env, UID_ADMIN, "admin"), path)));
    // an interested tenant sees the listing but NOT the street
    await assertSucceeds(getDoc(doc(anonymous(env), `properties/${PROPERTY_ID}`)));
    await assertFails(getDoc(doc(actingAs(env, UID_TENANT, "tenant"), path)));
    await assertFails(getDoc(doc(anonymous(env), path)));
  });

  it("nobody writes the private address from the client, not even the owner", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(
      setDoc(doc(db, `properties/${PROPERTY_ID}/private/location`), { line: "Otra dirección" }),
    );
  });

  it("rejects an invalid rent (negative or float)", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(updateDoc(doc(db, `properties/${PROPERTY_ID}`), { rent: -1 }));
    await assertFails(updateDoc(doc(db, `properties/${PROPERTY_ID}`), { rent: 1800000.5 }));
    await assertSucceeds(updateDoc(doc(db, `properties/${PROPERTY_ID}`), { rent: 1_900_000 }));
  });

  it("the landlord CANNOT transfer the property by changing landlordUid", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(
      updateDoc(doc(db, `properties/${PROPERTY_ID}`), { landlordUid: UID_THIRD_PARTY }),
    );
  });
});

describe("applications", () => {
  it("the tenant and the landlord read it; a third party does NOT", async () => {
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `applications/${APPLICATION_ID}`)),
    );
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `applications/${APPLICATION_ID}`)),
    );
    await assertFails(
      getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `applications/${APPLICATION_ID}`)),
    );
    await assertFails(getDoc(doc(anonymous(env), `applications/${APPLICATION_ID}`)));
  });

  it("nobody can sweep the whole collection", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    await assertFails(getDocs(collection(db, "applications")));
    await assertFails(getDocs(query(collection(db, "applications"), limit(1000))));
  });

  it("the tenant lists only their own", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertSucceeds(
      getDocs(
        query(collection(db, "applications"), where("tenantUid", "==", UID_TENANT), limit(20)),
      ),
    );
    // ...and not another tenant's
    await assertFails(
      getDocs(
        query(collection(db, "applications"), where("tenantUid", "==", UID_THIRD_PARTY), limit(20)),
      ),
    );
  });

  it("an application is born 'pending': nobody self-approves on create", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    const base = {
      propertyId: PROPERTY_ID,
      tenantUid: UID_THIRD_PARTY,
      landlordUid: UID_LANDLORD,
      createdAt: new Date(),
    };
    await assertFails(addDoc(collection(db, "applications"), { ...base, status: "approved" }));
    await assertSucceeds(addDoc(collection(db, "applications"), { ...base, status: "pending" }));
  });

  it("cannot apply on someone else's behalf", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    await assertFails(
      addDoc(collection(db, "applications"), {
        propertyId: PROPERTY_ID,
        tenantUid: UID_TENANT, // impersonation
        landlordUid: UID_LANDLORD,
        status: "pending",
        createdAt: new Date(),
      }),
    );
  });

  it("cannot apply to a property that does not exist", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    await assertFails(
      addDoc(collection(db, "applications"), {
        propertyId: "does-not-exist",
        tenantUid: UID_THIRD_PARTY,
        landlordUid: UID_LANDLORD,
        status: "pending",
        createdAt: new Date(),
      }),
    );
  });

  it("the denormalized landlordUid cannot be forged", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant");
    await assertFails(
      addDoc(collection(db, "applications"), {
        propertyId: PROPERTY_ID,
        tenantUid: UID_THIRD_PARTY,
        landlordUid: UID_THIRD_PARTY, // claims to own someone else's property
        status: "pending",
        createdAt: new Date(),
      }),
    );
  });

  it("the tenant can only withdraw, NOT approve", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(
      updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "approved" }),
    );
    await assertSucceeds(
      updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "withdrawn" }),
    );
  });

  it("the landlord approves or rejects; a third party does not", async () => {
    await assertSucceeds(
      updateDoc(
        doc(actingAs(env, UID_LANDLORD, "landlord"), `applications/${APPLICATION_ID}`),
        { status: "approved" },
      ),
    );
    await assertFails(
      updateDoc(
        doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `applications/${APPLICATION_ID}`),
        { status: "approved" },
      ),
    );
  });

  it("an already resolved application cannot be reopened", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertSucceeds(
      updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "rejected" }),
    );
    await assertFails(
      updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "approved" }),
    );
  });

  it("the landlord CANNOT touch fields other than status/notes", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(
      updateDoc(doc(db, `applications/${APPLICATION_ID}`), { tenantUid: UID_THIRD_PARTY }),
    );
  });

  it("nobody deletes applications except admin", async () => {
    await assertFails(
      deleteDoc(doc(actingAs(env, UID_TENANT, "tenant"), `applications/${APPLICATION_ID}`)),
    );
    await assertSucceeds(
      deleteDoc(doc(actingAs(env, UID_ADMIN, "admin"), `applications/${APPLICATION_ID}`)),
    );
  });
});

describe("contracts and payments", () => {
  it("only the parties read the contract", async () => {
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `contracts/${CONTRACT_ID}`)),
    );
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `contracts/${CONTRACT_ID}`)),
    );
    await assertFails(
      getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `contracts/${CONTRACT_ID}`)),
    );
  });

  it("contracts are NOT listable from the client", async () => {
    await assertFails(getDocs(collection(actingAs(env, UID_TENANT, "tenant"), "contracts")));
  });

  it("the client does NOT write contracts or payments (backend only)", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(updateDoc(doc(db, `contracts/${CONTRACT_ID}`), { rent: 1 }));
    await assertFails(
      setDoc(doc(db, `contracts/${CONTRACT_ID}/payments/made-up`), {
        amount: 0,
        status: "current",
      }),
    );
  });

  it("the parties read the payments; a third party does NOT", async () => {
    await assertSucceeds(
      getDoc(
        doc(actingAs(env, UID_TENANT, "tenant"), `contracts/${CONTRACT_ID}/payments/payment-1`),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          actingAs(env, UID_THIRD_PARTY, "tenant"),
          `contracts/${CONTRACT_ID}/payments/payment-1`,
        ),
      ),
    );
  });
});

describe("default closure", () => {
  it("an undeclared collection is denied", async () => {
    const db = actingAs(env, UID_ADMIN, "admin");
    await assertFails(getDoc(doc(db, "made_up_collection/x")));
    await assertFails(setDoc(doc(db, "made_up_collection/x"), { a: 1 }));
  });
});
