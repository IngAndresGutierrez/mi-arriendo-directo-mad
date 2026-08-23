# Browser drivers

Each `*.mjs` here drives a real browser against a real dev server and asserts on the
consequence a user actually receives. They are not unit tests — `pnpm test` covers pure logic
and schemas; this level exists for what compiles and still does not work.

```bash
pnpm dev                       # in another terminal; these need a server on :3000
export $(grep NEXT_PUBLIC_FIREBASE_API_KEY .env.local | xargs)

pnpm e2e --since               # only what the working tree touches — start here
pnpm e2e loading catalog       # by name
pnpm e2e --list                # what would run, without running it
pnpm e2e                       # all of them
```

## Why they are in git

They were not, until they cost a day. 57 of them lived in a session scratchpad under `/tmp`
with no shared helper: `settled()` was copy-pasted into every one, and four separate copies of
`openSession()` had drifted apart — two of which had silently stopped watching the browser
console, so those two could never report a console error. The day
`app/(app)/loading.tsx` landed, every driver started asserting against the skeleton instead of
the page, and fixing that took three sweeping rewrites of all 57 files. None of it was
reviewable, because none of it was in a diff.

So: one `lib.mjs`, and a change in how the app answers a navigation is one edit.

## The rules

- **`settled(page)` after every navigation.** A `loading.tsx` answers before the content does,
  so asserting the instant a URL resolves asserts the skeleton. It checks twice on purpose —
  right after a click the skeleton has not mounted yet.
- **Assert the consequence, not the text.** The cookie, the document, the final URL, the status
  code. `loading.mjs` asserts a missing property answers a true `404` and not a `200` with the
  not-found page streamed inside; that is the regression this whole level earns its keep for.
- **No `throw`, not a test.** Throwaway probes — bisecting a layout, printing an LCP, taking one
  screenshot — belong in the session scratchpad and stay there.
- **A new driver needs an entry in `manifest.mjs`**, or `--since` will never select it.
- **Un primitivo compartido se mapea a todo, no a una lista.** `SELECTS_EVERY_DRIVER` cubre
  `shared/ui/`, `shared/form/`, `app/globals.css` y `app/layout.tsx`: cambiar un botón que sale en
  cada pantalla tiene que seleccionar el corpus entero, y una lista escrita a mano queda mal el día
  que alguien usa el componente en un sitio nuevo.
- **Never weaken an assertion to make it pass.** If the harness could not reproduce the
  condition, the fix is a better wait, not a smaller claim.
- **Self-sufficient.** A driver creates what it needs and is handed nothing: config comes from
  `config()`, uploads from `fixtures()` (generated, not committed). `lightbox.mjs` used to be
  passed a property URL and so could not run outside the session that computed it.

## Cleaning up

Drivers create real accounts on `@miarriendodirecto.test`. They are not deleted per-run; the
cleanup script recognises that domain and `@resend.dev`. Keep it out of the repo root — see
`.gitignore`.

## `session` y la hidratación: un falso positivo que costó caro

`session.mjs` reproduce la trampa de las dos sesiones — borra a propósito la sesión del SDK web
en IndexedDB, conserva la cookie del servidor y comprueba que subir una foto siga funcionando a
través de `ensureClientSession()`.

Estuvo rojo, y **parecía un defecto de producto**: la cadena de recuperación se completaba
entera (`/api/session/token` 200, `signInWithCustomToken` 200, `accounts:lookup` 200, el chunk de
`firebase/storage` cargado) y después no salía ni una petición a Cloud Storage, ni la foto, ni
ningún mensaje de error. No lo era.

**Le faltaba esperar la hidratación tras el `reload()`.** `setInputFiles` deja el archivo en el
input y dispara `change`, pero si React todavía no ha enganchado su `onChange`, no lo atiende
nadie: no hay subida, no hay error, y la espera se agota. Instrumentando el uploader con logs se
vio la traza completa hasta `uploadBytes` resuelto — el producto hace su trabajo. El driver ahora
llama `settled()` y `hydrated()` después de recargar.

La lección, que vale para cualquier driver: **después de un `reload()` o un `goto()`, `settled()`
no basta si lo siguiente es interactuar.** `settled()` dice que el esqueleto se fue; `hydrated()`
dice que hay alguien escuchando. Rellenar un campo antes de eso escribe en un input muerto, y el
síntoma no se parece en nada a la causa.

## `contract` necesita el servidor sin clave de correo

El driver de la firma tiene que leer el código de un solo uso, y el código va al correo. Sin
`RESEND_API_KEY`, este proyecto **registra el asunto en el log** en vez de enviarlo — y el asunto
lleva el código. Así que ese driver se corre así:

```bash
RESEND_API_KEY= pnpm dev > /tmp/dev.log 2>&1 &
E2E_DEV_LOG=/tmp/dev.log pnpm e2e contract
```

Con la clave puesta el código sí sale por correo y el log solo trae el resultado del envío, así que
el driver no lo encuentra y falla diciéndolo. No es un fallo del producto: es que en ese modo la
verificación tendría que leer la bandeja de pruebas del proveedor.

Y ojo con la cuota: Resend responde **429 `daily_quota_exceeded`** cuando se agota la del día, y
entonces `requestSignatureCode` reporta un fallo de envío real — que es lo correcto, porque esa
persona no va a recibir nada.

## Límite de Identity Toolkit

Cada driver crea sus cuentas contra `accounts:signUp`. Encadenar muchas corridas seguidas —o
muchas sondas— acaba en `TOO_MANY_ATTEMPTS_TRY_LATER`, y entonces **todos** los drivers fallan en
el login por una razón que no tiene nada que ver con el código. Si de golpe todo se pone rojo en
el primer `waitForURL`, comprueba la cuota antes de buscar la causa en otro sitio:

```bash
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$KEY" \
  -d '{"email":"prueba@miarriendodirecto.test","password":"ClaveDePrueba1"}' | grep -o TOO_MANY_ATTEMPTS
```

Para depurar un driver conviene reutilizar una cuenta fija en una sonda del scratchpad en vez de
crear una nueva en cada intento.
