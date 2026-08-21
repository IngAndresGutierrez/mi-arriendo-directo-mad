---
name: typescript-strict
description: Tipado estricto en TypeScript para los modelos de dominio (Inmueble, Postulacion, Contrato, Pago) y para los datos que vuelven de Firestore. Úsala al definir tipos o interfaces, al escribir converters de Firestore, al tocar tsconfig.json, y siempre que aparezca la tentación de usar any o un cast.
---

# TypeScript estricto

`tsconfig.json` ya tiene `strict: true`. Eso es el piso, no el techo.

## Prohibiciones

| Nunca | Por qué / en su lugar |
| --- | --- |
| `any` (explícito o implícito) | apaga el chequeo en cascada. Usa `unknown` + validación con Zod |
| `as Inmueble` sobre datos externos | una aserción es una promesa sin verificar. Valida con Zod o un converter |
| `as any` para "callar" un error | el error es real: arregla el tipo |
| `@ts-ignore` | si es inevitable, `@ts-expect-error` **con comentario del por qué** |
| `!` (non-null) en datos de red o Firestore | úsalo solo en env vars ya validadas al arranque |
| `object`, `Function`, `{}` | tipa la forma real |
| `enum` | usa union de literales o `as const` (mejor tree-shaking, sin runtime) |

Excepción única al `!`: acceso a variables de entorno en un módulo que ya falla rápido si
faltan.

## Modelos de dominio: un tipo por frontera

Distingue **tres formas** del mismo dato y no las mezcles:

1. `XInput` — lo que envía el usuario (validado por Zod).
2. `XDoc` — lo que vive en Firestore (con `Timestamp`, sin `id`).
3. `X` — lo que consume la UI (con `id`, fechas como `string` ISO, serializable para el
   RSC payload).

```ts
// lib/domain/inmueble.ts
import type { Timestamp } from "firebase-admin/firestore";

export type EstadoInmueble = "borrador" | "disponible" | "arrendado" | "inactivo";
export type TipoInmueble = "apartamento" | "casa" | "apartaestudio" | "local" | "oficina";

/** Pesos colombianos, enteros. Nunca float para dinero. */
export type PesosCOP = number & { readonly __brand: "PesosCOP" };
export const pesos = (n: number): PesosCOP => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Monto inválido: ${n}`);
  return n as PesosCOP;
};

export type Uid = string & { readonly __brand: "Uid" };
export type InmuebleId = string & { readonly __brand: "InmuebleId" };

/** Forma persistida en Firestore. */
export interface InmuebleDoc {
  readonly propietarioUid: Uid;
  readonly titulo: string;
  readonly tipo: TipoInmueble;
  readonly estado: EstadoInmueble;
  readonly canon: PesosCOP;
  readonly administracion: PesosCOP | null;
  readonly direccion: { readonly ciudad: string; readonly barrio: string; readonly linea: string };
  readonly areaM2: number;
  readonly habitaciones: number;
  readonly banos: number;
  readonly fotos: readonly string[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/** Forma que cruza a los componentes: 100% serializable. */
export type Inmueble = Omit<InmuebleDoc, "createdAt" | "updatedAt"> & {
  readonly id: InmuebleId;
  readonly createdAt: string;   // ISO 8601
  readonly updatedAt: string;
};
```

Los **branded types** evitan el bug clásico de pasar un `propietarioUid` donde iba un
`inquilinoUid`, o un id de inmueble donde iba uno de postulación: ambos son `string` para el
compilador si no los marcas.

## Uniones discriminadas para estados con datos distintos

No modeles con campos opcionales lo que en realidad son estados mutuamente excluyentes.

```ts
// ❌ invita a leer motivoRechazo cuando fue aprobada
type Postulacion = { estado: string; motivoRechazo?: string; contratoId?: string };

// ✅ el compilador te obliga a cubrir cada caso
export type Postulacion =
  | { readonly estado: "pendiente"; readonly id: PostulacionId; readonly enviadaEn: string }
  | { readonly estado: "aprobada"; readonly id: PostulacionId; readonly contratoId: ContratoId }
  | { readonly estado: "rechazada"; readonly id: PostulacionId; readonly motivo: string }
  | { readonly estado: "retirada"; readonly id: PostulacionId; readonly retiradaEn: string };

function etiqueta(p: Postulacion): string {
  switch (p.estado) {
    case "pendiente": return "En revisión";
    case "aprobada":  return `Aprobada · contrato ${p.contratoId}`;
    case "rechazada": return `Rechazada: ${p.motivo}`;
    case "retirada":  return "Retirada por el inquilino";
    default: return assertNever(p);       // error de compilación si agregas un estado nuevo
  }
}

export function assertNever(x: never): never {
  throw new Error(`Caso no manejado: ${JSON.stringify(x)}`);
}
```

## Firestore nunca devuelve datos tipados: usa converters

`snap.data()` es `DocumentData`. Un `as InmuebleDoc` es mentira. Encapsula la conversión en un
solo lugar y valida ahí.

```ts
// lib/firebase/converters.ts (cliente, SDK modular)
import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type WithFieldValue,
} from "firebase/firestore";
import { inmuebleDocSchema } from "@/lib/schemas/inmueble";

export const inmuebleConverter: FirestoreDataConverter<Inmueble, InmuebleDoc> = {
  toFirestore(inmueble: WithFieldValue<Inmueble>) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...resto } = inmueble as Inmueble;
    return resto;
  },
  fromFirestore(snap: QueryDocumentSnapshot): Inmueble {
    const parsed = inmuebleDocSchema.safeParse(snap.data());
    if (!parsed.success) {
      // dato corrupto en la BD: falla ruidosamente en lugar de propagar undefined
      throw new Error(`Inmueble ${snap.id} inválido: ${parsed.error.message}`);
    }
    return {
      ...parsed.data,
      id: snap.id as InmuebleId,
      createdAt: parsed.data.createdAt.toDate().toISOString(),
      updatedAt: parsed.data.updatedAt.toDate().toISOString(),
    };
  },
};

// uso: el tipo fluye solo
const ref = doc(db, "inmuebles", id).withConverter(inmuebleConverter);
const inmueble = (await getDoc(ref)).data();   // Inmueble | undefined
```

En el servidor, el equivalente es `adminDb.collection("inmuebles").withConverter(...)`.

Deriva los tipos de dominio **desde el schema de Zod** donde puedas, para no mantener dos
definiciones desincronizadas: `export type InmuebleInput = z.infer<typeof inmuebleSchema>`
(skill `zod-react-hook-form`).

## Patrones útiles

```ts
// resultado explícito en vez de throw para errores esperables
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// entrada externa siempre unknown
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);          // ← única puerta de entrada
}

// readonly por defecto en props y datos de dominio
type Props = { readonly items: readonly Inmueble[] };

// satisfies: valida sin ensanchar el tipo
export const LABELS = {
  pendiente: "En revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  retirada: "Retirada",
} satisfies Record<Postulacion["estado"], string>;
```

## Flags recomendados

Al endurecer `tsconfig.json`, añade (y arregla lo que rompa, no lo silencies):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[0] es T | undefined — clave con snap.docs
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true        // fuerza import type explícito
  }
}
```

## Verificación

Antes de dar por terminado un cambio de tipos:

```bash
pnpm exec tsc --noEmit
pnpm lint
```

`tsc --noEmit` limpio no es opcional: `next build` con Turbopack no siempre reporta todos los
errores de tipo del proyecto.
