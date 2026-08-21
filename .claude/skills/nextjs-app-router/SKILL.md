---
name: nextjs-app-router
description: Patrones correctos de Next.js 16 App Router - Server/Client Components, Server Actions, params y cookies asíncronos, proxy.ts, caching (use cache, revalidateTag, updateTag), streaming y route handlers. Úsala antes de crear o modificar cualquier archivo en app/, next.config.ts o proxy.ts.
---

# Next.js 16 App Router

La versión instalada es **Next.js 16.3.2** con React 19.2 y **Turbopack por defecto**. Muchas
APIs cambiaron respecto a v14/v15: lo que "recuerdas" probablemente está desactualizado.

**Antes de escribir código**, consulta la doc versionada del paquete:
`node_modules/next/dist/docs/01-app/` (por ejemplo `01-getting-started/07-mutating-data.md`,
`03-api-reference/03-file-conventions/`, `02-guides/upgrading/version-16.md`).

## Breaking changes de v16 que más se equivocan

| Antes (v14/v15) | Ahora (v16) |
| --- | --- |
| `cookies()`, `headers()`, `draftMode()` sincrónicos | **siempre `await`** |
| `params` / `searchParams` como objeto | **Promesas**: `await props.params` |
| `middleware.ts` + `export function middleware` | **`proxy.ts`** + `export function proxy` (runtime nodejs, sin edge) |
| `skipMiddlewareUrlNormalize` | `skipProxyUrlNormalize` |
| `revalidateTag('x')` | `revalidateTag('x', 'max')` — el 2º argumento (perfil de `cacheLife`) es obligatorio |
| `experimental.ppr` / `experimental_ppr` | `cacheComponents: true` en `next.config.ts` |
| `unstable_cacheLife` / `unstable_cacheTag` | `cacheLife` / `cacheTag` (estables, sin prefijo) |
| `unstable_cache` | `"use cache"` |
| `next lint` | ESLint flat config (`eslint.config.mjs`) + `eslint` directo |
| `images.domains` | `images.remotePatterns` |

```tsx
// ✅ v16
export default async function Page(props: PageProps<'/inmuebles/[id]'>) {
  const { id } = await props.params;
  const { pagina } = await props.searchParams;
  const jar = await cookies();
  // ...
}
```

`PageProps`, `LayoutProps` y `RouteContext` son **tipos globales generados**: no los importes,
y si faltan corre `pnpm exec next typegen`. `app/layout.tsx` de este repo ya usa
`LayoutProps<"/">`.

## Server Components por defecto

- Un componente es Server Component salvo que el archivo tenga `"use client"`.
- Pon `"use client"` **lo más abajo posible** del árbol: en el input interactivo, no en la
  página. Un `"use client"` en un layout convierte todo el subárbol en cliente.
- Nunca uses `"use client"` para "arreglar" un error de hidratación o de import: revisa qué
  API del navegador se está tocando.
- Datos de Firestore: leer en Server Components con **Admin SDK**; `onSnapshot` y formularios
  interactivos en Client Components con el **SDK modular** (skills `firebase-admin-sdk` y
  `firebase-modular`).
- Props de Server → Client Component deben ser serializables: no pases `Timestamp`,
  `DocumentReference` ni funciones. Convierte a `string`/`number` antes.

```tsx
// app/(dashboard)/postulaciones/page.tsx  — Server Component
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { listarPostulaciones } from "@/lib/data/postulaciones";
import { TablaPostulaciones } from "./tabla-postulaciones";   // "use client" adentro

export default async function Page() {
  const user = await requireUser();
  return (
    <Suspense fallback={<TablaSkeleton />}>
      <Contenido uid={user.uid} />
    </Suspense>
  );
}

async function Contenido({ uid }: { uid: string }) {
  const postulaciones = await listarPostulaciones(uid);   // POJOs serializados
  return <TablaPostulaciones items={postulaciones} />;
}
```

## Mutaciones: Server Actions

```tsx
// app/(dashboard)/inmuebles/actions.ts
"use server";

import { revalidateTag, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth/session";

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string[]> };

export async function crearInmueble(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();                 // 1. auth SIEMPRE dentro de la action
  const parsed = inmuebleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  }
  await adminDb.collection("inmuebles").add({ ...parsed.data, propietarioUid: user.uid });
  updateTag(`inmuebles-${user.uid}`);               // el dueño ve su cambio de inmediato
  revalidateTag("catalogo-inmuebles", "max");       // el catálogo público se refresca en background
  return { ok: true };
}
```

Reglas:
- Una Server Action es un **endpoint público**. Autentica, valida con Zod y autoriza dentro de
  la action, siempre. No confíes en ningún id que venga del `FormData`.
- Nunca retornes datos sensibles ni objetos del Admin SDK; retorna un `ActionState` plano.
- En el cliente úsalas con `useActionState` (React 19) y `useFormStatus` para el pending:

```tsx
"use client";
import { useActionState } from "react";

export function FormularioInmueble() {
  const [state, action, pending] = useActionState(crearInmueble, { ok: false });
  return (
    <form action={action}>
      {/* ... */}
      <button disabled={pending}>{pending ? "Guardando…" : "Publicar"}</button>
    </form>
  );
}
```

- `redirect()` dentro de una action lanza una excepción de control: **llámalo fuera de
  try/catch** o el catch se la come.

## Caching (Cache Components)

Para habilitar `"use cache"` y PPR:

```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { cacheComponents: true };
export default nextConfig;
```

```ts
// lib/data/inmuebles.ts
import { cacheLife, cacheTag } from "next/cache";

export async function catalogoPublico(ciudad: string) {
  "use cache";                          // la función debe ser async
  cacheTag("catalogo-inmuebles");
  cacheLife("hours");
  return await adminDb.collection("inmuebles").where("ciudad", "==", ciudad).get();
}
```

- Dentro de un scope `"use cache"` **no puedes** leer `cookies()`, `headers()` ni
  `searchParams`: léelos afuera y pásalos como argumentos. (Si no hay alternativa existe
  `"use cache: private"`, que solo cachea en el navegador.)
- **Nunca** caches datos por usuario en un `"use cache"` compartido: filtraría datos entre
  inquilinos. Datos personales → sin cache o con tag por uid.
- `updateTag(tag)` (solo en Server Actions) = expira y refresca ya mismo → read-your-writes.
  `revalidateTag(tag, 'max')` = stale-while-revalidate para contenido público.
  `refresh()` = refresca el router del cliente.

## Route Handlers

```ts
// app/api/webhooks/pagos/route.ts
export async function POST(request: Request) {
  const raw = await request.text();                 // verifica firma sobre el cuerpo crudo
  // ...
  return Response.json({ ok: true });
}
```

- `export const dynamic`, `revalidate`, etc. siguen existiendo como segment config.
- Handler con `params`: `async function GET(req: Request, ctx: RouteContext<'/api/x/[id]'>)`
  y `const { id } = await ctx.params`.
- No pongas `runtime = "edge"`: el default (Node/Fluid Compute) soporta streaming, SSE y
  `firebase-admin`. Edge no.

## proxy.ts (antes middleware)

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const tieneSesion = request.cookies.has("session");
  if (!tieneSesion && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/postular/:path*"] };
```

Solo chequeo de **presencia** de cookie (optimización de UX). La verificación criptográfica y
la autorización real van en la página/Server Action. Nunca hagas de proxy.ts tu única capa de
seguridad.

## Otros detalles de v16

- **Imágenes**: `next/image` con `remotePatterns`; los defaults de `qualities`,
  `imageSizes` y `minimumCacheTTL` cambiaron. `next/legacy/image` está deprecado.
- **Parallel routes**: `default.js` ahora es **obligatorio** en cada slot.
- **Errores**: `error.tsx` (Client Component) por segmento, `not-found.tsx`, `loading.tsx`
  para el fallback de streaming. `forbidden.tsx` / `unauthorized.tsx` requieren
  `authInterrupts`.
- **Metadata**: `export const metadata` o `generateMetadata`; los props de
  `opengraph-image`/`icon` ahora son Promesas.
- `AGENTS.md` de este repo es regenerado por `next dev`: si aparece en el diff, commítealo
  junto al cambio en vez de revertirlo.
