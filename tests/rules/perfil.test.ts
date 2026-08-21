/**
 * Reglas de `usuarios/{uid}` tras `/registro/completar-perfil`.
 *
 * El perfil lo escribe el backend con el Admin SDK, pero estas reglas son la defensa si el
 * cliente escribe directo: validan la misma forma y bloquean la escalada de rol.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  actingAs,
  createTestEnvironment,
  perfilCompleto,
  seed,
  UID_INQUILINO,
  UID_TERCERO,
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

/** Cliente con el correo en el token, que las rules comparan contra `incoming().email`. */
function comoNuevo(uid: string) {
  return actingAs(env, uid, "inquilino", "nuevo@example.com");
}

describe("crear perfil", () => {
  it("el dueño crea su perfil con todos los campos", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertSucceeds(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "nuevo@example.com",
      }),
    );
  });

  it("no se puede crear el perfil de otra persona", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, "usuarios/uid-ajeno"), { ...perfilCompleto(), email: "nuevo@example.com" }),
    );
  });

  it("el email debe coincidir con el del token", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "otro@example.com",
      }),
    );
  });

  it.each([
    ["genero", "genero"],
    ["telefonoPais", "telefonoPais"],
    ["direccion", "direccion"],
    ["fechaNacimiento", "fechaNacimiento"],
    ["telefono", "telefono"],
    ["aceptoTerminosEn", "aceptoTerminosEn"],
  ])("rechaza el perfil sin %s", async (_caso, campo) => {
    const db = comoNuevo(UID_TERCERO);
    const perfil: Record<string, unknown> = { ...perfilCompleto(), email: "nuevo@example.com" };
    delete perfil[campo];
    await assertFails(setDoc(doc(db, `usuarios/${UID_TERCERO}`), perfil));
  });

  it.each([
    ["número nacional sin indicativo", "3001234567"],
    ["número con espacios", "+57 300 123 4567"],
    ["número demasiado corto", "+5730"],
    ["indicativo que empieza por 0", "+0573001234567"],
    ["número con letras", "+57300abc4567"],
  ])("rechaza un teléfono %s", async (_caso, telefono) => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "nuevo@example.com",
        telefono,
      }),
    );
  });

  it("rechaza un género fuera de la lista", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "nuevo@example.com",
        genero: "otro",
      }),
    );
  });

  it("nadie se crea como admin", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "nuevo@example.com",
        rol: "admin",
      }),
    );
  });

  it("rechaza campos desconocidos", async () => {
    const db = comoNuevo(UID_TERCERO);
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_TERCERO}`), {
        ...perfilCompleto(),
        email: "nuevo@example.com",
        saldoInterno: 999_999,
      }),
    );
  });
});

describe("actualizar perfil", () => {
  it("el dueño corrige nombre, celular, género y dirección", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertSucceeds(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), {
        nombre: "Inquilino Uno Gómez",
        telefono: "+573109876543",
        telefonoPais: "CO",
        genero: "femenino",
        direccion: {
          linea: "Carrera 7 #100-30",
          ciudad: "Bogotá",
          departamento: "Bogotá D.C.",
        },
        updatedAt: new Date(),
      }),
    );
  });

  it("NO puede escalar su rol", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { rol: "propietario" }));
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { rol: "admin" }));
  });

  it("NO puede reescribir el registro de su consentimiento ni la fecha de creación", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertFails(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { aceptoTerminosEn: new Date(0) }),
    );
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { createdAt: new Date(0) }));
  });

  it("NO puede cambiar su correo ni su fecha de nacimiento", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertFails(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { email: "otro@example.com" }),
    );
    await assertFails(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { fechaNacimiento: "2010-01-01" }),
    );
  });

  it("acepta cambiar a un teléfono de otro país", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertSucceeds(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), {
        telefono: "+34612345678",
        telefonoPais: "ES",
        updatedAt: new Date(),
      }),
    );
  });

  it("una actualización con teléfono inválido se rechaza", async () => {
    const db = actingAs(env, UID_INQUILINO, "inquilino", "inquilino@example.com");
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { telefono: "123" }));
    await assertFails(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { telefonoPais: "colombia" }),
    );
  });

  it("un tercero no toca el perfil ajeno", async () => {
    const db = actingAs(env, UID_TERCERO, "inquilino", "tercero@example.com");
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { nombre: "Hackeado Ya" }));
  });
});
