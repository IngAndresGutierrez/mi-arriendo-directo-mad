/**
 * Comportamiento del catálogo público: qué consultas anónimas se permiten.
 * `list` se evalúa por documento candidato, así que la query debe estar acotada.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { anonimo, crearEntorno, sembrar } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await crearEntorno();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await sembrar(env);
});

describe("catálogo público (anónimo)", () => {
  it("list SIN filtro: el borrador contamina el resultado -> denegado", async () => {
    await assertFails(getDocs(collection(anonimo(env), "inmuebles")));
  });

  it("list filtrando por estado == 'disponible' -> permitido", async () => {
    await assertSucceeds(
      getDocs(
        query(collection(anonimo(env), "inmuebles"), where("estado", "==", "disponible"), limit(20)),
      ),
    );
  });

  it("list filtrado por ciudad + estado (la query real del catálogo) -> permitido", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(anonimo(env), "inmuebles"),
          where("ciudad", "==", "Bogotá"),
          where("estado", "==", "disponible"),
          limit(20),
        ),
      ),
    );
  });

  it("list filtrando por estado == 'borrador' -> denegado", async () => {
    await assertFails(
      getDocs(query(collection(anonimo(env), "inmuebles"), where("estado", "==", "borrador"))),
    );
  });

  // Comportamiento real de Firestore (verificado en el emulador): un `list` sin filtro
  // se deniega incluso si la colección está VACÍA. La regla debe ser verificable a
  // partir de la query, no del resultado. Consecuencia práctica: el catálogo público
  // SIEMPRE debe consultar con where("estado", "==", "disponible").
  it("colección vacía sin filtro -> igualmente denegado", async () => {
    await env.clearFirestore();
    await assertFails(getDocs(collection(anonimo(env), "inmuebles")));
  });
});
