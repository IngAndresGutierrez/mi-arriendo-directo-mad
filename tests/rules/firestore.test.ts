/**
 * Tests de firestore.rules. Cada bloque prueba el caso permitido Y el denegado:
 * una regla sin caso negativo no demuestra nada.
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
  anonimo,
  como,
  crearEntorno,
  CONTRATO_ID,
  INMUEBLE_ID,
  POSTULACION_ID,
  sembrar,
  UID_ADMIN,
  UID_INQUILINO,
  UID_PROPIETARIO,
  UID_TERCERO,
} from "./helpers";

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

describe("usuarios", () => {
  it("el dueño lee su perfil", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertSucceeds(getDoc(doc(db, `usuarios/${UID_INQUILINO}`)));
  });

  it("un tercero NO lee el perfil de otro", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    await assertFails(getDoc(doc(db, `usuarios/${UID_INQUILINO}`)));
  });

  it("nadie enumera usuarios (solo admin)", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(getDocs(collection(db, "usuarios")));
    await assertSucceeds(getDocs(collection(como(env, UID_ADMIN, "admin"), "usuarios")));
  });

  it("el usuario NO puede escalar su propio rol", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { rol: "admin" }));
    await assertSucceeds(
      updateDoc(doc(db, `usuarios/${UID_INQUILINO}`), { telefono: "3009999999" }),
    );
  });

  it("los documentos de identidad son privados del dueño", async () => {
    await assertSucceeds(
      getDoc(doc(como(env, UID_INQUILINO, "inquilino"), `usuarios/${UID_INQUILINO}/documentos/cedula`)),
    );
    // ni un tercero ni el propietario del inmueble ven la cédula
    await assertFails(
      getDoc(doc(como(env, UID_TERCERO, "inquilino"), `usuarios/${UID_INQUILINO}/documentos/cedula`)),
    );
    await assertFails(
      getDoc(doc(como(env, UID_PROPIETARIO, "propietario"), `usuarios/${UID_INQUILINO}/documentos/cedula`)),
    );
  });

  it("un documento de identidad NO puede apuntar al storage de otro usuario", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(
      setDoc(doc(db, `usuarios/${UID_INQUILINO}/documentos/falso`), {
        tipo: "cedula_frente",
        storagePath: `postulantes/${UID_TERCERO}/cedula-frente.jpg`,
        subidoEn: new Date(),
      }),
    );
  });

  it("los documentos de identidad son append-only para el dueño", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(deleteDoc(doc(db, `usuarios/${UID_INQUILINO}/documentos/cedula`)));
  });
});

describe("inmuebles", () => {
  it("el catálogo publicado es visible sin autenticar", async () => {
    await assertSucceeds(getDoc(doc(anonimo(env), `inmuebles/${INMUEBLE_ID}`)));
  });

  it("un borrador NO es visible para terceros, sí para su dueño", async () => {
    await assertFails(getDoc(doc(anonimo(env), "inmuebles/inmueble-borrador")));
    await assertFails(
      getDoc(doc(como(env, UID_TERCERO, "inquilino"), "inmuebles/inmueble-borrador")),
    );
    await assertSucceeds(
      getDoc(doc(como(env, UID_PROPIETARIO, "propietario"), "inmuebles/inmueble-borrador")),
    );
  });

  it("un inquilino NO puede crear inmuebles", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(
      addDoc(collection(db, "inmuebles"), {
        propietarioUid: UID_INQUILINO,
        titulo: "Intento de publicación",
        tipo: "apartamento",
        estado: "disponible",
        canon: 1_000_000,
        direccion: { ciudad: "Cali", barrio: "Granada", linea: "Cra 1" },
        areaM2: 50,
        habitaciones: 1,
        banos: 1,
      }),
    );
  });

  it("un propietario NO puede publicar a nombre de otro", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertFails(
      addDoc(collection(db, "inmuebles"), {
        propietarioUid: UID_TERCERO, // suplantación
        titulo: "Inmueble ajeno",
        tipo: "casa",
        estado: "disponible",
        canon: 1_000_000,
        direccion: { ciudad: "Cali", barrio: "Granada", linea: "Cra 1" },
        areaM2: 50,
        habitaciones: 1,
        banos: 1,
      }),
    );
  });

  it("rechaza un canon inválido (negativo o float)", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertFails(updateDoc(doc(db, `inmuebles/${INMUEBLE_ID}`), { canon: -1 }));
    await assertFails(updateDoc(doc(db, `inmuebles/${INMUEBLE_ID}`), { canon: 1800000.5 }));
    await assertSucceeds(updateDoc(doc(db, `inmuebles/${INMUEBLE_ID}`), { canon: 1_900_000 }));
  });

  it("el propietario NO puede transferir el inmueble cambiando propietarioUid", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertFails(
      updateDoc(doc(db, `inmuebles/${INMUEBLE_ID}`), { propietarioUid: UID_TERCERO }),
    );
  });
});

describe("postulaciones", () => {
  it("el inquilino y el propietario la leen; un tercero NO", async () => {
    await assertSucceeds(
      getDoc(doc(como(env, UID_INQUILINO, "inquilino"), `postulaciones/${POSTULACION_ID}`)),
    );
    await assertSucceeds(
      getDoc(doc(como(env, UID_PROPIETARIO, "propietario"), `postulaciones/${POSTULACION_ID}`)),
    );
    await assertFails(
      getDoc(doc(como(env, UID_TERCERO, "inquilino"), `postulaciones/${POSTULACION_ID}`)),
    );
    await assertFails(getDoc(doc(anonimo(env), `postulaciones/${POSTULACION_ID}`)));
  });

  it("nadie puede barrer la colección completa", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    await assertFails(getDocs(collection(db, "postulaciones")));
    await assertFails(getDocs(query(collection(db, "postulaciones"), limit(1000))));
  });

  it("el inquilino lista solo las propias", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "postulaciones"),
          where("inquilinoUid", "==", UID_INQUILINO),
          limit(20),
        ),
      ),
    );
    // ...y no las de otro inquilino
    await assertFails(
      getDocs(
        query(collection(db, "postulaciones"), where("inquilinoUid", "==", UID_TERCERO), limit(20)),
      ),
    );
  });

  it("una postulación nace 'pendiente': nadie se auto-aprueba al crear", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    const base = {
      inmuebleId: INMUEBLE_ID,
      inquilinoUid: UID_TERCERO,
      propietarioUid: UID_PROPIETARIO,
      createdAt: new Date(),
    };
    await assertFails(addDoc(collection(db, "postulaciones"), { ...base, estado: "aprobada" }));
    await assertSucceeds(addDoc(collection(db, "postulaciones"), { ...base, estado: "pendiente" }));
  });

  it("no se puede postular en nombre de otro", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    await assertFails(
      addDoc(collection(db, "postulaciones"), {
        inmuebleId: INMUEBLE_ID,
        inquilinoUid: UID_INQUILINO, // suplantación
        propietarioUid: UID_PROPIETARIO,
        estado: "pendiente",
        createdAt: new Date(),
      }),
    );
  });

  it("no se puede postular a un inmueble inexistente", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    await assertFails(
      addDoc(collection(db, "postulaciones"), {
        inmuebleId: "no-existe",
        inquilinoUid: UID_TERCERO,
        propietarioUid: UID_PROPIETARIO,
        estado: "pendiente",
        createdAt: new Date(),
      }),
    );
  });

  it("el propietarioUid desnormalizado no se puede falsificar", async () => {
    const db = como(env, UID_TERCERO, "inquilino");
    await assertFails(
      addDoc(collection(db, "postulaciones"), {
        inmuebleId: INMUEBLE_ID,
        inquilinoUid: UID_TERCERO,
        propietarioUid: UID_TERCERO, // se pone como dueño del inmueble ajeno
        estado: "pendiente",
        createdAt: new Date(),
      }),
    );
  });

  it("el inquilino solo puede retirar, NO aprobar", async () => {
    const db = como(env, UID_INQUILINO, "inquilino");
    await assertFails(
      updateDoc(doc(db, `postulaciones/${POSTULACION_ID}`), { estado: "aprobada" }),
    );
    await assertSucceeds(
      updateDoc(doc(db, `postulaciones/${POSTULACION_ID}`), { estado: "retirada" }),
    );
  });

  it("el propietario aprueba o rechaza; un tercero no", async () => {
    await assertSucceeds(
      updateDoc(doc(como(env, UID_PROPIETARIO, "propietario"), `postulaciones/${POSTULACION_ID}`), {
        estado: "aprobada",
      }),
    );
    await assertFails(
      updateDoc(doc(como(env, UID_TERCERO, "inquilino"), `postulaciones/${POSTULACION_ID}`), {
        estado: "aprobada",
      }),
    );
  });

  it("una postulación ya resuelta no se puede reabrir", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertSucceeds(
      updateDoc(doc(db, `postulaciones/${POSTULACION_ID}`), { estado: "rechazada" }),
    );
    await assertFails(
      updateDoc(doc(db, `postulaciones/${POSTULACION_ID}`), { estado: "aprobada" }),
    );
  });

  it("el propietario NO puede tocar campos fuera de estado/notas", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertFails(
      updateDoc(doc(db, `postulaciones/${POSTULACION_ID}`), { inquilinoUid: UID_TERCERO }),
    );
  });

  it("nadie borra postulaciones salvo admin", async () => {
    await assertFails(
      deleteDoc(doc(como(env, UID_INQUILINO, "inquilino"), `postulaciones/${POSTULACION_ID}`)),
    );
    await assertSucceeds(
      deleteDoc(doc(como(env, UID_ADMIN, "admin"), `postulaciones/${POSTULACION_ID}`)),
    );
  });
});

describe("contratos y pagos", () => {
  it("solo las partes leen el contrato", async () => {
    await assertSucceeds(
      getDoc(doc(como(env, UID_INQUILINO, "inquilino"), `contratos/${CONTRATO_ID}`)),
    );
    await assertSucceeds(
      getDoc(doc(como(env, UID_PROPIETARIO, "propietario"), `contratos/${CONTRATO_ID}`)),
    );
    await assertFails(
      getDoc(doc(como(env, UID_TERCERO, "inquilino"), `contratos/${CONTRATO_ID}`)),
    );
  });

  it("los contratos NO se listan desde el cliente", async () => {
    await assertFails(getDocs(collection(como(env, UID_INQUILINO, "inquilino"), "contratos")));
  });

  it("el cliente NO escribe contratos ni pagos (solo el backend)", async () => {
    const db = como(env, UID_PROPIETARIO, "propietario");
    await assertFails(updateDoc(doc(db, `contratos/${CONTRATO_ID}`), { canon: 1 }));
    await assertFails(
      setDoc(doc(db, `contratos/${CONTRATO_ID}/pagos/inventado`), { monto: 0, estado: "al_dia" }),
    );
  });

  it("las partes leen los pagos; un tercero NO", async () => {
    await assertSucceeds(
      getDoc(doc(como(env, UID_INQUILINO, "inquilino"), `contratos/${CONTRATO_ID}/pagos/pago-1`)),
    );
    await assertFails(
      getDoc(doc(como(env, UID_TERCERO, "inquilino"), `contratos/${CONTRATO_ID}/pagos/pago-1`)),
    );
  });
});

describe("cierre por defecto", () => {
  it("una colección no declarada está denegada", async () => {
    const db = como(env, UID_ADMIN, "admin");
    await assertFails(getDoc(doc(db, "coleccion_inventada/x")));
    await assertFails(setDoc(doc(db, "coleccion_inventada/x"), { a: 1 }));
  });
});
