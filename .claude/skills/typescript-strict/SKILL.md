---
name: typescript-strict
description: Strict TypeScript for the domain models (Property, Application, Contract, Payment) and for the data coming back from Firestore. Use it when defining types or interfaces, when writing Firestore converters, when touching tsconfig.json, and whenever the temptation to use any or a cast shows up.
---

# Strict TypeScript

`tsconfig.json` already has `strict: true`. That is the floor, not the ceiling.

## Prohibitions

| Never | Why / what instead |
| --- | --- |
| `any` (explicit or implicit) | it switches off checking downstream. Use `unknown` + Zod validation |
| `as Property` over external data | an assertion is an unverified promise. Validate with Zod or a converter |
| `as any` to "silence" an error | the error is real: fix the type |
| `@ts-ignore` | if unavoidable, `@ts-expect-error` **with a comment saying why** |
| `!` (non-null) on network or Firestore data | only use it on env vars already validated at boot |
| `object`, `Function`, `{}` | type the real shape |
| `enum` | use a union of literals or `as const` (better tree-shaking, no runtime) |

The single exception for `!`: reading environment variables in a module that already fails fast
when they are missing.

## Domain models: one type per boundary

Distinguish **three shapes** of the same data and never mix them:

1. `XInput` — what the user submits (validated by Zod).
2. `XDoc` — what lives in Firestore (with `Timestamp`, without `id`).
3. `X` — what the UI consumes (with `id`, dates as ISO `string`, serializable for the RSC
   payload).

```ts
// features/property/domain/property.ts
import type { Timestamp } from "firebase-admin/firestore";

export type PropertyStatus = "draft" | "available" | "rented" | "inactive";
export type PropertyType = "apartment" | "house" | "studio" | "retail" | "office";

/** Colombian pesos, integers. Never a float for money. */
export type PesosCOP = number & { readonly __brand: "PesosCOP" };
export const pesos = (n: number): PesosCOP => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Invalid amount: ${n}`);
  return n as PesosCOP;
};

export type Uid = string & { readonly __brand: "Uid" };
export type PropertyId = string & { readonly __brand: "PropertyId" };

/** The shape persisted in Firestore. */
export interface PropertyDoc {
  readonly landlordUid: Uid;
  readonly title: string;
  readonly type: PropertyType;
  readonly status: PropertyStatus;
  readonly rent: PesosCOP;
  readonly adminFee: PesosCOP | null;
  readonly address: { readonly city: string; readonly neighborhood: string; readonly line: string };
  readonly areaM2: number;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly photos: readonly string[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/** The shape that crosses to components: 100% serializable. */
export type Property = Omit<PropertyDoc, "createdAt" | "updatedAt"> & {
  readonly id: PropertyId;
  readonly createdAt: string;   // ISO 8601
  readonly updatedAt: string;
};
```

**Branded types** prevent the classic bug of passing a `landlordUid` where a `tenantUid` was
expected, or a property id where an application id belonged: to the compiler they are both just
`string` unless you mark them.

## Discriminated unions for states that carry different data

Do not model mutually exclusive states with optional fields.

```ts
// ❌ invites reading rejectionReason on an approved application
type Application = { status: string; rejectionReason?: string; contractId?: string };

// ✅ the compiler forces you to cover every case
export type Application =
  | { readonly status: "pending"; readonly id: ApplicationId; readonly submittedAt: string }
  | { readonly status: "approved"; readonly id: ApplicationId; readonly contractId: ContractId }
  | { readonly status: "rejected"; readonly id: ApplicationId; readonly reason: string }
  | { readonly status: "withdrawn"; readonly id: ApplicationId; readonly withdrawnAt: string };

function label(a: Application): string {
  switch (a.status) {
    case "pending":   return "En revisión";
    case "approved":  return `Aprobada · contrato ${a.contractId}`;
    case "rejected":  return `Rechazada: ${a.reason}`;
    case "withdrawn": return "Retirada por el inquilino";
    default: return assertNever(a);       // compile error when you add a new status
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
```

(The labels above are user-facing copy, which stays in es-CO — see the language policy in
`CLAUDE.md`. The keys, the types and everything else are English.)

## Firestore never returns typed data: use converters

`snap.data()` is `DocumentData`. An `as PropertyDoc` is a lie. Encapsulate the conversion in one
place and validate there.

```ts
// features/property/data/converters.ts (client, modular SDK)
import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type WithFieldValue,
} from "firebase/firestore";
import { propertyDocSchema } from "../validations/property";

export const propertyConverter: FirestoreDataConverter<Property, PropertyDoc> = {
  toFirestore(property: WithFieldValue<Property>) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = property as Property;
    return rest;
  },
  fromFirestore(snap: QueryDocumentSnapshot): Property {
    const parsed = propertyDocSchema.safeParse(snap.data());
    if (!parsed.success) {
      // corrupt data in the DB: fail loudly instead of propagating undefined
      throw new Error(`Property ${snap.id} is invalid: ${parsed.error.message}`);
    }
    return {
      ...parsed.data,
      id: snap.id as PropertyId,
      createdAt: parsed.data.createdAt.toDate().toISOString(),
      updatedAt: parsed.data.updatedAt.toDate().toISOString(),
    };
  },
};

// usage: the type flows on its own
const ref = doc(db, "properties", id).withConverter(propertyConverter);
const property = (await getDoc(ref)).data();   // Property | undefined
```

On the server the equivalent is `adminDb.collection("properties").withConverter(...)`.

Derive the domain types **from the Zod schema** wherever you can, so you do not maintain two
definitions that drift apart: `export type PropertyInput = z.infer<typeof propertySchema>` (the
`zod-react-hook-form` skill).

## Useful patterns

```ts
// an explicit result instead of throwing for expected errors
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// external input is always unknown
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);          // ← the single entry point
}

// readonly by default on props and domain data
type Props = { readonly items: readonly Property[] };

// satisfies: validates without widening the type
export const LABELS = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  withdrawn: "Retirada",
} satisfies Record<Application["status"], string>;
```

## Recommended flags

When tightening `tsconfig.json`, add these (and fix what breaks, do not silence it):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[0] is T | undefined — key with snap.docs
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true        // forces an explicit import type
  }
}
```

## Verification

Before calling a type change done:

```bash
pnpm typecheck
pnpm lint
```

A clean `tsc --noEmit` is not optional: `next build` with Turbopack does not always report every
type error in the project.
