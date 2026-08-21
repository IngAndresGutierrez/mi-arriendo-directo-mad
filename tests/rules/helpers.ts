/**
 * Utilidades para probar firestore.rules contra el emulador.
 *
 * `withSecurityRulesDisabled` siembra datos saltándose las reglas (equivalente al
 * Admin SDK); todo lo demás corre con las reglas activas.
 */
import { readFileSync } from "node:fs";

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";

export const PROJECT_ID = "demo-mad-rules";

export const UID_INQUILINO = "uid-inquilino";
export const UID_PROPIETARIO = "uid-propietario";
export const UID_TERCERO = "uid-tercero";
export const UID_ADMIN = "uid-admin";

export const INMUEBLE_ID = "inmueble-1";
export const POSTULACION_ID = "postulacion-1";
export const CONTRATO_ID = "contrato-1";

export async function createTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
}

/**
 * Cliente autenticado con el rol en custom claims, tal como lo pondría el Admin SDK.
 *
 * Los términos del dominio (`inquilino`, `propietario`, `inmueble`, `postulacion`) se
 * mantienen en español: son los nombres reales de las colecciones y de los claims en
 * Firestore, y cambiarlos aquí desalinearía el test de las rules desplegadas.
 */
export function actingAs(
  env: RulesTestEnvironment,
  uid: string,
  rol?: "inquilino" | "propietario" | "admin",
  email?: string,
): Firestore {
  return env
    .authenticatedContext(uid, { ...(rol ? { rol } : {}), ...(email ? { email } : {}) })
    .firestore() as unknown as Firestore;
}

export function anonymous(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Datos base: un inmueble publicado y una postulación pendiente sobre él. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.doc(`usuarios/${UID_INQUILINO}`).set({
      nombre: "Inquilino Uno",
      email: "inquilino@example.com",
      telefono: "3001234567",
      rol: "inquilino",
      createdAt: new Date(),
    });

    await db.doc(`usuarios/${UID_INQUILINO}/documentos/cedula`).set({
      tipo: "cedula_frente",
      storagePath: `postulantes/${UID_INQUILINO}/cedula-frente.jpg`,
      subidoEn: new Date(),
    });

    await db.doc(`inmuebles/${INMUEBLE_ID}`).set({
      propietarioUid: UID_PROPIETARIO,
      titulo: "Apartamento en Chapinero",
      tipo: "apartamento",
      estado: "disponible",
      canon: 1_800_000,
      direccion: { ciudad: "Bogotá", barrio: "Chapinero", linea: "Calle 60 #10-20" },
      areaM2: 65,
      habitaciones: 2,
      banos: 2,
      createdAt: new Date(),
    });

    await db.doc(`inmuebles/inmueble-borrador`).set({
      propietarioUid: UID_PROPIETARIO,
      titulo: "Casa sin publicar",
      tipo: "casa",
      estado: "borrador",
      canon: 3_000_000,
      direccion: { ciudad: "Medellín", barrio: "Laureles", linea: "Cra 70 #1-2" },
      areaM2: 120,
      habitaciones: 3,
      banos: 2,
      createdAt: new Date(),
    });

    await db.doc(`postulaciones/${POSTULACION_ID}`).set({
      inmuebleId: INMUEBLE_ID,
      inquilinoUid: UID_INQUILINO,
      propietarioUid: UID_PROPIETARIO,
      estado: "pendiente",
      createdAt: new Date(),
    });

    await db.doc(`contratos/${CONTRATO_ID}`).set({
      inmuebleId: INMUEBLE_ID,
      inquilinoUid: UID_INQUILINO,
      propietarioUid: UID_PROPIETARIO,
      canon: 1_800_000,
      estado: "vigente",
    });

    await db.doc(`contratos/${CONTRATO_ID}/pagos/pago-1`).set({
      monto: 1_800_000,
      estado: "al_dia",
      periodo: "2026-08",
    });
  });
}
