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
  orderBy,
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
  NOTIFICATION_ID,
  INCIDENT_ID,
  LEASE_ID,
  PERIOD_ID,
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

  it("the public document CANNOT carry the exact map point", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    const area = { neighborhood: "Palermo", city: "Manizales", department: "Caldas" };

    // A coordinate to five decimals is the address in another alphabet: it belongs in
    // `private/location`, never here.
    await assertFails(
      addDoc(collection(db, "properties"), publishedProperty({
        area: { ...area, point: { lat: 5.06786, lng: -75.49123 } },
      })),
    );
    // ...and the blunted one is accepted, which is what makes the test above mean something.
    await assertSucceeds(
      addDoc(collection(db, "properties"), publishedProperty({
        area: { ...area, approx: { lat: 5.0675, lng: -75.4925 } },
      })),
    );
  });

  it("rejects a published coordinate that is not a coordinate", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    const area = { neighborhood: "Palermo", city: "Manizales", department: "Caldas" };
    const withApprox = (approx: unknown) =>
      addDoc(collection(db, "properties"), publishedProperty({ area: { ...area, approx } }));

    // the pair swapped: Antarctica
    await assertFails(withApprox({ lat: -75.4925, lng: 5.0675 }));
    // a zeroed default: the Gulf of Guinea
    await assertFails(withApprox({ lat: 0, lng: 0 }));
    // strings that never met the schema
    await assertFails(withApprox({ lat: "5.0675", lng: "-75.4925" }));
    // an extra key smuggled in beside them
    await assertFails(withApprox({ lat: 5.0675, lng: -75.4925, line: "Calle 60 #10-20" }));
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

  it("the exact map point is as private as the street it is", async () => {
    // It lives in the same document, so it inherits the same rule — and this pins that it
    // stays there, because the temptation is always to move a coordinate somewhere handier.
    const path = `properties/${PROPERTY_ID}/private/location`;
    await assertSucceeds(getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), path)));
    await assertFails(getDoc(doc(actingAs(env, UID_TENANT, "tenant"), path)));
    await assertFails(getDoc(doc(anonymous(env), path)));
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

  /*
   * Every write goes through a Server Action with the Admin SDK. The stage machine — one
   * stage forward, only while open, only by the landlord — cannot be expressed here, and a
   * rule that half-enforced it would be a rule someone trusts.
   */
  it("nobody writes an application from the client, not even its own parties", async () => {
    const application = {
      propertyId: PROPERTY_ID,
      tenantUid: UID_THIRD_PARTY,
      landlordUid: UID_LANDLORD,
      stage: "submitted",
      status: "open",
      createdAt: new Date(),
    };

    await assertFails(
      addDoc(collection(actingAs(env, UID_THIRD_PARTY, "tenant"), "applications"), application),
    );
    await assertFails(
      addDoc(collection(actingAs(env, UID_LANDLORD, "landlord"), "applications"), application),
    );
  });

  it("the tenant cannot move their own process forward", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(updateDoc(doc(db, `applications/${APPLICATION_ID}`), { stage: "approved" }));
    await assertFails(updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "withdrawn" }));
  });

  /*
   * The signature stage is gated on the signed contract existing, so `contract` is now a field
   * that would move the process if a client could write it. Neither party may: the file goes
   * through the Server Action, which is the only place that can check "the landlord of *this*
   * application, on *this* stage".
   */
  it("neither party can claim the contract is signed from the client", async () => {
    const signed = {
      contract: {
        path: "contracts/forged/whatever.pdf",
        fileName: "whatever.pdf",
        contentType: "application/pdf",
        bytes: 10,
        uploadedAt: "2026-09-20T15:00:00.000Z",
        note: "",
      },
    };
    await assertFails(
      updateDoc(doc(actingAs(env, UID_TENANT, "tenant"), `applications/${APPLICATION_ID}`), signed),
    );
    await assertFails(
      updateDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `applications/${APPLICATION_ID}`), signed),
    );
  });

  /*
   * El reto de firma vive en su propia colección justamente porque las dos partes pueden leer el
   * documento de la postulación, y el hash de un código de seis dígitos se rompe con un millón de
   * intentos: guardarlo ahí dejaría a una parte firmar como la otra. Esto fija que ningún cliente
   * la alcanza — la clausura explícita del final de las reglas es lo que lo garantiza, y este test
   * es lo que avisa si alguien declara la colección más arriba sin darse cuenta.
   */
  it("nobody can read or write a signature challenge from the client", async () => {
    const id = `${APPLICATION_ID}_tenant`;
    for (const [uid, role] of [
      [UID_TENANT, "tenant"],
      [UID_LANDLORD, "landlord"],
      [UID_THIRD_PARTY, "tenant"],
    ] as const) {
      const db = actingAs(env, uid, role);
      await assertFails(getDoc(doc(db, `signatureChallenges/${id}`)));
      await assertFails(setDoc(doc(db, `signatureChallenges/${id}`), { codeHash: "x" }));
      await assertFails(getDocs(collection(db, "signatureChallenges")));
    }
    await assertFails(getDoc(doc(anonymous(env), `signatureChallenges/${id}`)));
  });

  /*
   * El primer canon añade dos cosas que moverían el proceso si un cliente pudiera escribirlas: los
   * datos de cobro y, sobre todo, **el veredicto** — que es lo único que cierra la etapa. Un
   * inquilino que pudiera escribir `confirmed` cerraría el arriendo sin que el dinero llegara.
   */
  it("neither party can write the payout or forge the receipt verdict", async () => {
    const forged = {
      firstPayment: {
        payout: {
          method: "nequi",
          phone: "+573001234567",
          key: "",
          accountType: "",
          accountNumber: "",
          bankName: "",
          holderName: "Quien Sea",
          holderDocument: "CC 1",
          note: "",
        },
        receipt: null,
        verdict: { status: "confirmed", at: "2026-10-01T16:00:00.000Z", reason: "" },
      },
    };
    for (const [uid, role] of [
      [UID_TENANT, "tenant"],
      [UID_LANDLORD, "landlord"],
    ] as const) {
      const db = actingAs(env, uid, role);
      await assertFails(updateDoc(doc(db, `applications/${APPLICATION_ID}`), forged));
      await assertFails(
        updateDoc(doc(db, `applications/${APPLICATION_ID}`), {
          "firstPayment.verdict": { status: "confirmed", at: "2026-10-01T16:00:00.000Z", reason: "" },
        }),
      );
    }
  });

  it("the landlord cannot advance or reject it from the client either", async () => {
    const db = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(updateDoc(doc(db, `applications/${APPLICATION_ID}`), { stage: "tenant_data" }));
    await assertFails(updateDoc(doc(db, `applications/${APPLICATION_ID}`), { status: "rejected" }));
  });

  it("nobody deletes an application: a process that happened, happened", async () => {
    await assertFails(deleteDoc(doc(actingAs(env, UID_TENANT, "tenant"), `applications/${APPLICATION_ID}`)));
    await assertFails(
      deleteDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `applications/${APPLICATION_ID}`)),
    );
  });
});

describe("tenantProfiles", () => {
  it("the tenant reads their own dossier", async () => {
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `tenantProfiles/${UID_TENANT}`)),
    );
  });

  /*
   * Not even a landlord with an open application on this tenant. What a landlord sees is the
   * snapshot frozen inside that application — what was declared to *them*. This document
   * follows the tenant to every other application they ever make.
   */
  it("nobody else reads it, landlord with an open application included", async () => {
    await assertFails(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `tenantProfiles/${UID_TENANT}`)),
    );
    await assertFails(
      getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `tenantProfiles/${UID_TENANT}`)),
    );
    await assertFails(getDoc(doc(anonymous(env), `tenantProfiles/${UID_TENANT}`)));
  });

  // A query over this collection is a list of everyone's income.
  it("the collection is not listable, not even by its own members", async () => {
    await assertFails(getDocs(collection(actingAs(env, UID_TENANT, "tenant"), "tenantProfiles")));
    await assertFails(
      getDocs(query(collection(actingAs(env, UID_TENANT, "tenant"), "tenantProfiles"), limit(1))),
    );
  });

  it("it is written by the server, never by the client", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(setDoc(doc(db, `tenantProfiles/${UID_TENANT}`), { monthlyIncome: 99_000_000 }));
    await assertFails(updateDoc(doc(db, `tenantProfiles/${UID_TENANT}`), { monthlyIncome: 1 }));
    await assertFails(deleteDoc(doc(db, `tenantProfiles/${UID_TENANT}`)));
  });

  describe("its documents", () => {
    it("the tenant reads the list of what they uploaded", async () => {
      const db = actingAs(env, UID_TENANT, "tenant");
      await assertSucceeds(getDoc(doc(db, `tenantProfiles/${UID_TENANT}/documents/doc-1`)));
      await assertSucceeds(getDocs(collection(db, `tenantProfiles/${UID_TENANT}/documents`)));
    });

    /*
     * Not even the landlord of an open application. What they get is a time-limited signed URL
     * per document, issued by the server — otherwise this collection would follow the tenant to
     * every other process they are ever part of.
     */
    it("nobody else does", async () => {
      await assertFails(
        getDocs(collection(actingAs(env, UID_LANDLORD, "landlord"), `tenantProfiles/${UID_TENANT}/documents`)),
      );
      await assertFails(
        getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `tenantProfiles/${UID_TENANT}/documents/doc-1`)),
      );
      await assertFails(getDoc(doc(anonymous(env), `tenantProfiles/${UID_TENANT}/documents/doc-1`)));
    });

    it("the client does not write the record either, only the server", async () => {
      const db = actingAs(env, UID_TENANT, "tenant");
      await assertFails(
        addDoc(collection(db, `tenantProfiles/${UID_TENANT}/documents`), { kind: "id_front" }),
      );
      await assertFails(deleteDoc(doc(db, `tenantProfiles/${UID_TENANT}/documents/doc-1`)));
    });
  });

});

describe("the slug index", () => {
  it("is invisible to the client: not even the owner reads or writes it", async () => {
    const landlord = actingAs(env, UID_LANDLORD, "landlord");
    await assertFails(getDoc(doc(landlord, "propertySlugs/apartamento-en-palermo-manizales")));
    await assertFails(
      setDoc(doc(landlord, "propertySlugs/apartamento-en-palermo-manizales"), {
        propertyId: PROPERTY_ID,
      }),
    );
    // and nobody can hijack another listing's URL
    await assertFails(
      setDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), "propertySlugs/casa-en-cali"), {
        propertyId: PROPERTY_ID,
      }),
    );
    await assertFails(getDocs(collection(anonymous(env), "propertySlugs")));
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

describe("leases", () => {
  it("the tenant and the landlord read the tenancy; a third party does NOT", async () => {
    await assertSucceeds(getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `leases/${LEASE_ID}`)));
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `leases/${LEASE_ID}`)),
    );
    await assertFails(
      getDoc(doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `leases/${LEASE_ID}`)),
    );
    await assertFails(getDoc(doc(anonymous(env), `leases/${LEASE_ID}`)));
  });

  it("nobody sweeps the whole collection", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(getDocs(collection(db, "leases")));
    await assertFails(getDocs(query(collection(db, "leases"), limit(1000))));
  });

  it("each side lists only their own", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertSucceeds(
      getDocs(query(collection(db, "leases"), where("tenantUid", "==", UID_TENANT), limit(20))),
    );
    // Somebody else's tenancy is in the emulator, so this is denied by the rule and not by
    // the query coming back empty.
    await assertFails(
      getDocs(
        query(collection(db, "leases"), where("tenantUid", "==", "uid-other-tenant"), limit(20)),
      ),
    );
  });

  /*
   * La máquina no cabe en las reglas: el mes tiene que estar en el calendario de esta tenencia, un
   * veredicto pertenece al comprobante que juzgó, y el propietario confirma mientras el inquilino
   * sube. Todo eso son relaciones entre documentos y fechas.
   */
  it("no client writes a tenancy, not even its own parties", async () => {
    for (const [uid, role] of [
      [UID_TENANT, "tenant"],
      [UID_LANDLORD, "landlord"],
    ] as const) {
      const db = actingAs(env, uid, role);
      await assertFails(updateDoc(doc(db, `leases/${LEASE_ID}`), { monthlyCost: 1 }));
      await assertFails(setDoc(doc(db, "leases/lease-invented"), { tenantUid: uid }));
      await assertFails(deleteDoc(doc(db, `leases/${LEASE_ID}`)));
    }
  });

  describe("its months", () => {
    it("both parties read a month; a third party does NOT", async () => {
      await assertSucceeds(
        getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `leases/${LEASE_ID}/periods/${PERIOD_ID}`)),
      );
      await assertSucceeds(
        getDoc(
          doc(actingAs(env, UID_LANDLORD, "landlord"), `leases/${LEASE_ID}/periods/${PERIOD_ID}`),
        ),
      );
      await assertFails(
        getDoc(
          doc(actingAs(env, UID_THIRD_PARTY, "tenant"), `leases/${LEASE_ID}/periods/${PERIOD_ID}`),
        ),
      );
    });

    it("both parties list the months, and a stranger cannot", async () => {
      await assertSucceeds(
        getDocs(collection(actingAs(env, UID_TENANT, "tenant"), `leases/${LEASE_ID}/periods`)),
      );
      await assertFails(
        getDocs(collection(actingAs(env, UID_THIRD_PARTY, "tenant"), `leases/${LEASE_ID}/periods`)),
      );
    });

    /*
     * Lo que esto impide: que el inquilino se declare al día, o que el propietario escriba un
     * rechazo sin comprobante que rechazar.
     */
    it("neither party marks a month paid from the client", async () => {
      const tenant = actingAs(env, UID_TENANT, "tenant");
      await assertFails(
        updateDoc(doc(tenant, `leases/${LEASE_ID}/periods/${PERIOD_ID}`), {
          verdict: { status: "confirmed", at: new Date().toISOString(), reason: "" },
        }),
      );
      await assertFails(
        setDoc(doc(tenant, `leases/${LEASE_ID}/periods/2026-10`), { amount: 0, dueDate: "2026-10-15" }),
      );

      const landlord = actingAs(env, UID_LANDLORD, "landlord");
      await assertFails(
        updateDoc(doc(landlord, `leases/${LEASE_ID}/periods/${PERIOD_ID}`), {
          verdict: { status: "rejected", at: new Date().toISOString(), reason: "No llegó." },
        }),
      );
      await assertFails(deleteDoc(doc(landlord, `leases/${LEASE_ID}/periods/${PERIOD_ID}`)));
    });

    /*
     * Las partes se leen del padre, así que una tenencia que no existe no puede prestar acceso a
     * los meses que alguien invente debajo de ella.
     */
    it("a month under a tenancy that does not exist is denied", async () => {
      await assertFails(
        getDoc(doc(actingAs(env, UID_TENANT, "tenant"), "leases/lease-invented/periods/2026-09")),
      );
    });
  });

  describe("its incidents", () => {
    /*
     * Un incidente dice dónde vive alguien y qué está roto ahí. Lo leen las dos partes — el
     * inquilino lo reporta y el propietario es quien tiene que arreglarlo — y nadie más.
     */
    it("both parties read an incident; a third party and an anonymous visitor do NOT", async () => {
      await assertSucceeds(
        getDoc(
          doc(actingAs(env, UID_TENANT, "tenant"), `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`),
        ),
      );
      await assertSucceeds(
        getDoc(
          doc(
            actingAs(env, UID_LANDLORD, "landlord"),
            `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`,
          ),
        ),
      );
      await assertFails(
        getDoc(
          doc(
            actingAs(env, UID_THIRD_PARTY, "tenant"),
            `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`,
          ),
        ),
      );
      await assertFails(
        getDoc(doc(anonymous(env), `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`)),
      );
    });

    it("both parties list the incidents, and a stranger cannot", async () => {
      await assertSucceeds(
        getDocs(collection(actingAs(env, UID_TENANT, "tenant"), `leases/${LEASE_ID}/incidents`)),
      );
      await assertSucceeds(
        getDocs(
          collection(actingAs(env, UID_LANDLORD, "landlord"), `leases/${LEASE_ID}/incidents`),
        ),
      );
      await assertFails(
        getDocs(
          collection(actingAs(env, UID_THIRD_PARTY, "tenant"), `leases/${LEASE_ID}/incidents`),
        ),
      );
    });

    /*
     * El reporte lo escribe la Server Action, como todo lo que hay debajo de una tenencia. Lo que
     * esto impide en concreto: que el inquilino registre un adjunto que está en la carpeta de otra
     * persona — o que no existe en el bucket —, y que cualquiera de los dos reescriba o borre lo
     * que el otro reportó. Nada de eso se puede preguntar desde aquí.
     */
    it("neither party writes an incident from the client", async () => {
      const report = {
        title: "Se dañó la estufa",
        description: "No enciende ninguno de los cuatro puestos desde el sábado.",
        attachments: [],
        reporterUid: UID_TENANT,
        reporterName: "Ana Uno Pérez",
      };

      for (const [uid, role] of [
        [UID_TENANT, "tenant"],
        [UID_LANDLORD, "landlord"],
      ] as const) {
        const db = actingAs(env, uid, role);
        await assertFails(
          setDoc(doc(db, `leases/${LEASE_ID}/incidents/incident-invented`), report),
        );
        await assertFails(addDoc(collection(db, `leases/${LEASE_ID}/incidents`), report));
        await assertFails(
          updateDoc(doc(db, `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`), {
            title: "Otra cosa",
          }),
        );
        await assertFails(
          deleteDoc(doc(db, `leases/${LEASE_ID}/incidents/${INCIDENT_ID}`)),
        );
      }
    });

    /** Como con los meses: una tenencia inventada no presta acceso a lo que se cuelgue de ella. */
    it("an incident under a tenancy that does not exist is denied", async () => {
      await assertFails(
        getDoc(
          doc(actingAs(env, UID_TENANT, "tenant"), "leases/lease-invented/incidents/whatever"),
        ),
      );
    });

    /** Y la tenencia de otra pareja tampoco: el `get` del padre es lo que decide. */
    it("a party of one tenancy does not read another tenancy's incidents", async () => {
      await assertFails(
        getDocs(
          collection(actingAs(env, UID_TENANT, "tenant"), "leases/lease-someone-else/incidents"),
        ),
      );
    });
  });
});

describe("default closure", () => {
  it("an undeclared collection is denied", async () => {
    const db = actingAs(env, UID_ADMIN, "admin");
    await assertFails(getDoc(doc(db, "made_up_collection/x")));
    await assertFails(setDoc(doc(db, "made_up_collection/x"), { a: 1 }));
  });
});

describe("notifications", () => {
  it("each person reads their own", async () => {
    await assertSucceeds(
      getDoc(doc(actingAs(env, UID_TENANT, "tenant"), `notifications/${NOTIFICATION_ID}`)),
    );
  });

  it("nobody reads someone else's", async () => {
    await assertFails(
      getDoc(doc(actingAs(env, UID_LANDLORD, "landlord"), `notifications/${NOTIFICATION_ID}`)),
    );
    await assertFails(getDoc(doc(anonymous(env), `notifications/${NOTIFICATION_ID}`)));
  });

  // An unfiltered `list` would be everyone's notifications; the query has to prove whose it is.
  it("an unfiltered or unbounded list is denied", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(getDocs(collection(db, "notifications")));
    await assertFails(
      getDocs(query(collection(db, "notifications"), where("recipientUid", "==", UID_TENANT))),
    );
    await assertFails(
      getDocs(query(collection(db, "notifications"), where("recipientUid", "==", UID_TENANT), limit(500))),
    );
  });

  it("a bounded list of one's own is allowed", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(actingAs(env, UID_TENANT, "tenant"), "notifications"),
          where("recipientUid", "==", UID_TENANT),
          limit(20),
        ),
      ),
    );
  });

  /*
   * **La consulta exacta a la que se suscribe la campana**, con su `orderBy` y su `limit(15)`.
   *
   * El caso de arriba se quedaba a medias: probaba la forma —filtrada y acotada— pero no la que el
   * producto usa de verdad. Se añadió después de que un `INTERNAL ASSERTION FAILED` del SDK en el
   * navegador resultara ser un *listen* rechazado por el servidor en esa suscripción: lo primero que
   * hubo que averiguar fue si estas reglas la permitían, y no había una prueba que lo dijera.
   */
  it("permite exactamente la consulta de la campana", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(actingAs(env, UID_TENANT, "tenant"), "notifications"),
          where("recipientUid", "==", UID_TENANT),
          orderBy("createdAt", "desc"),
          limit(15),
        ),
      ),
    );
  });

  /*
   * `readAt` is the one field a client could plausibly own, and it still cannot write it: the
   * Server Action scopes the update to the caller's own uid, which no rule here could check as
   * precisely.
   */
  it("marking as read is the server's job, not the client's", async () => {
    const db = actingAs(env, UID_TENANT, "tenant");
    await assertFails(updateDoc(doc(db, `notifications/${NOTIFICATION_ID}`), { readAt: new Date() }));
    await assertFails(deleteDoc(doc(db, `notifications/${NOTIFICATION_ID}`)));
    await assertFails(
      addDoc(collection(db, "notifications"), { recipientUid: UID_TENANT, type: "application_received" }),
    );
  });
});
