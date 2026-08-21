---
name: nextjs-app-router
description: Correct Next.js 16 App Router patterns - Server/Client Components, Server Actions, async params and cookies, proxy.ts, caching (use cache, revalidateTag, updateTag), streaming and route handlers. Use it before creating or modifying any file in app/, next.config.ts or proxy.ts.
---

# Next.js 16 App Router

The installed version is **Next.js 16.3.2** with React 19.2 and **Turbopack by default**. Many
APIs changed from v14/v15: what you "remember" is probably out of date.

**Before writing code**, check the package's versioned docs:
`node_modules/next/dist/docs/01-app/` (for instance `01-getting-started/07-mutating-data.md`,
`03-api-reference/03-file-conventions/`, `02-guides/upgrading/version-16.md`).

## The v16 breaking changes people get wrong most

| Before (v14/v15) | Now (v16) |
| --- | --- |
| synchronous `cookies()`, `headers()`, `draftMode()` | **always `await`** |
| `params` / `searchParams` as objects | **Promises**: `await props.params` |
| `middleware.ts` + `export function middleware` | **`proxy.ts`** + `export function proxy` (nodejs runtime, no edge) |
| `skipMiddlewareUrlNormalize` | `skipProxyUrlNormalize` |
| `revalidateTag('x')` | `revalidateTag('x', 'max')` — the 2nd argument (a `cacheLife` profile) is required |
| `experimental.ppr` / `experimental_ppr` | `cacheComponents: true` in `next.config.ts` |
| `unstable_cacheLife` / `unstable_cacheTag` | `cacheLife` / `cacheTag` (stable, no prefix) |
| `unstable_cache` | `"use cache"` |
| `next lint` | ESLint flat config (`eslint.config.mjs`) + `eslint` directly |
| `images.domains` | `images.remotePatterns` |

```tsx
// ✅ v16
export default async function Page(props: PageProps<'/inmuebles/[id]'>) {
  const { id } = await props.params;
  const { page } = await props.searchParams;
  const jar = await cookies();
  // ...
}
```

`PageProps`, `LayoutProps` and `RouteContext` are **generated global types**: do not import
them, and if they are missing run `pnpm typegen`. This repo's `app/layout.tsx` already uses
`LayoutProps<"/">`.

## Server Components by default

- A component is a Server Component unless the file carries `"use client"`.
- Put `"use client"` **as low as possible** in the tree: on the interactive input, not on the
  page. A `"use client"` in a layout turns the whole subtree into client code.
- Never use `"use client"` to "fix" a hydration or import error: find out which browser API is
  being touched.
- Firestore data: read in Server Components with the **Admin SDK**; `onSnapshot` and interactive
  forms in Client Components with the **modular SDK** (the `firebase-admin-sdk` and
  `firebase-modular` skills).
- Props crossing Server → Client Component must be serializable: never pass a `Timestamp`, a
  `DocumentReference` or a function. Convert to `string`/`number` first. A lucide icon is a
  function too: pass the already-created JSX element instead.

```tsx
// app/(app)/postulaciones/page.tsx  — Server Component
import { Suspense } from "react";
import { requireCompleteProfile } from "@/features/profile";
import { listApplications } from "@/features/application";
import { ApplicationsTable } from "@/features/application"; // "use client" inside

export default async function Page() {
  const user = await requireCompleteProfile();
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content uid={user.uid} />
    </Suspense>
  );
}

async function Content({ uid }: { uid: string }) {
  const applications = await listApplications(uid);   // serialized POJOs
  return <ApplicationsTable items={applications} />;
}
```

## Mutations: Server Actions

```tsx
// features/property/actions/create-property.ts
"use server";

import { revalidateTag, updateTag } from "next/cache";
import { requireUser } from "@/shared/auth/session";

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string[]> };

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();                 // 1. auth ALWAYS inside the action
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  }
  await adminDb.collection("properties").add({ ...parsed.data, landlordUid: user.uid });
  updateTag(`properties-${user.uid}`);              // the owner sees their change immediately
  revalidateTag("property-catalog", "max");         // the public catalog refreshes in the background
  return { ok: true };
}
```

Rules:
- A Server Action is a **public endpoint**. Authenticate, validate with Zod and authorize inside
  the action, always. Never trust an id that arrives in the `FormData`.
- Never return sensitive data or Admin SDK objects; return a flat `ActionState`.
- On the client use them with `useActionState` (React 19) and `useFormStatus` for pending state:

```tsx
"use client";
import { useActionState } from "react";

export function PropertyForm() {
  const [state, action, pending] = useActionState(createProperty, { ok: false });
  return (
    <form action={action}>
      {/* ... */}
      <button disabled={pending}>{pending ? "Guardando…" : "Publicar"}</button>
    </form>
  );
}
```

- `redirect()` inside an action throws a control-flow exception: **call it outside try/catch**
  or the catch swallows it.

## Caching (Cache Components)

To enable `"use cache"` and PPR:

```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { cacheComponents: true };
export default nextConfig;
```

```ts
// features/property/data/catalog.ts
import { cacheLife, cacheTag } from "next/cache";

export async function publicCatalog(city: string) {
  "use cache";                          // the function must be async
  cacheTag("property-catalog");
  cacheLife("hours");
  return await adminDb.collection("properties").where("address.city", "==", city).get();
}
```

- Inside a `"use cache"` scope you **cannot** read `cookies()`, `headers()` or `searchParams`:
  read them outside and pass them as arguments. (If there is no alternative, `"use cache: private"`
  exists, which only caches in the browser.)
- **Never** cache per-user data in a shared `"use cache"`: it would leak data between tenants.
  Personal data → no cache, or a tag per uid.
- `updateTag(tag)` (Server Actions only) = expire and refresh right now → read-your-writes.
  `revalidateTag(tag, 'max')` = stale-while-revalidate for public content.
  `refresh()` = refreshes the client router.

## Route Handlers

```ts
// app/api/webhooks/payments/route.ts
export async function POST(request: Request) {
  const raw = await request.text();                 // verify the signature over the raw body
  // ...
  return Response.json({ ok: true });
}
```

- `export const dynamic`, `revalidate`, etc. still exist as segment config.
- A handler with `params`: `async function GET(req: Request, ctx: RouteContext<'/api/x/[id]'>)`
  and `const { id } = await ctx.params`.
- Do not set `runtime = "edge"`: the default (Node / Fluid Compute) supports streaming, SSE and
  `firebase-admin`. Edge does not.

## proxy.ts (formerly middleware)

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  if (!hasSession && request.nextUrl.pathname.startsWith("/inicio")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/inicio/:path*", "/postular/:path*"] };
```

Only a **presence** check on the cookie (a UX optimization). The cryptographic verification and
the real authorization belong in the page / Server Action. Never make `proxy.ts` your only
security layer.

## Other v16 details

- **Images**: `next/image` with `remotePatterns`; the defaults for `qualities`, `imageSizes` and
  `minimumCacheTTL` changed. `next/legacy/image` is deprecated.
- **Parallel routes**: `default.js` is now **required** in every slot.
- **Errors**: `error.tsx` (a Client Component) per segment, `not-found.tsx`, `loading.tsx` for
  the streaming fallback. `forbidden.tsx` / `unauthorized.tsx` need `authInterrupts`.
- **Metadata**: `export const metadata` or `generateMetadata`; the props of
  `opengraph-image`/`icon` are Promises now.
- This repo's `AGENTS.md` is regenerated by `next dev`: if it shows up in the diff, commit it
  along with your change instead of reverting it.
