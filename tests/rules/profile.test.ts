/**
 * Rules for `users/{uid}` after `/registro/completar-perfil`.
 *
 * The profile is written by the backend through the Admin SDK, but these rules are the
 * defence if the client writes directly: same shape validated, no role escalation.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  actingAs,
  completeProfileDoc,
  createTestEnvironment,
  seed,
  UID_TENANT,
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

/** Client with the email in the token, which the rules compare against `incoming().email`. */
function asNewUser(uid: string) {
  return actingAs(env, uid, "tenant", "new@example.com");
}

describe("create profile", () => {
  it("the owner creates their profile with every field", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertSucceeds(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "new@example.com",
      }),
    );
  });

  it("cannot create someone else's profile", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, "users/uid-someone-else"), {
        ...completeProfileDoc(),
        email: "new@example.com",
      }),
    );
  });

  it("the email must match the one in the token", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "other@example.com",
      }),
    );
  });

  it.each([
    ["gender", "gender"],
    ["phoneCountry", "phoneCountry"],
    ["address", "address"],
    ["birthDate", "birthDate"],
    ["phone", "phone"],
    ["termsAcceptedAt", "termsAcceptedAt"],
  ])("rejects a profile without %s", async (_case, field) => {
    const db = asNewUser(UID_THIRD_PARTY);
    const profile: Record<string, unknown> = {
      ...completeProfileDoc(),
      email: "new@example.com",
    };
    delete profile[field];
    await assertFails(setDoc(doc(db, `users/${UID_THIRD_PARTY}`), profile));
  });

  it.each([
    ["national number with no country code", "3001234567"],
    ["number with spaces", "+57 300 123 4567"],
    ["number too short", "+5730"],
    ["country code starting with 0", "+0573001234567"],
    ["number with letters", "+57300abc4567"],
  ])("rejects a %s", async (_case, phone) => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "new@example.com",
        phone,
      }),
    );
  });

  it("rejects a gender outside the list", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "new@example.com",
        gender: "other",
      }),
    );
  });

  it("nobody creates themselves as admin", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "new@example.com",
        role: "admin",
      }),
    );
  });

  it("rejects unknown fields", async () => {
    const db = asNewUser(UID_THIRD_PARTY);
    await assertFails(
      setDoc(doc(db, `users/${UID_THIRD_PARTY}`), {
        ...completeProfileDoc(),
        email: "new@example.com",
        internalBalance: 999_999,
      }),
    );
  });
});

describe("update profile", () => {
  it("the owner fixes name, phone, gender and address", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertSucceeds(
      updateDoc(doc(db, `users/${UID_TENANT}`), {
        fullName: "Ana Uno Gómez",
        phone: "+573109876543",
        phoneCountry: "CO",
        gender: "female",
        address: {
          line: "Carrera 7 #100-30",
          city: "Bogotá",
          department: "Bogotá D.C.",
        },
        updatedAt: new Date(),
      }),
    );
  });

  it("CANNOT escalate their own role", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { role: "landlord" }));
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { role: "admin" }));
  });

  it("CANNOT rewrite their consent record or their creation date", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { termsAcceptedAt: new Date(0) }));
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { createdAt: new Date(0) }));
  });

  it("CANNOT change their email or their birth date", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { email: "other@example.com" }));
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { birthDate: "2010-01-01" }));
  });

  it("accepts switching to a phone from another country", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertSucceeds(
      updateDoc(doc(db, `users/${UID_TENANT}`), {
        phone: "+34612345678",
        phoneCountry: "ES",
        updatedAt: new Date(),
      }),
    );
  });

  it("an update with an invalid phone is rejected", async () => {
    const db = actingAs(env, UID_TENANT, "tenant", "tenant@example.com");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { phone: "123" }));
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { phoneCountry: "colombia" }));
  });

  it("a third party does not touch someone else's profile", async () => {
    const db = actingAs(env, UID_THIRD_PARTY, "tenant", "third@example.com");
    await assertFails(updateDoc(doc(db, `users/${UID_TENANT}`), { fullName: "Hacked Already" }));
  });
});
