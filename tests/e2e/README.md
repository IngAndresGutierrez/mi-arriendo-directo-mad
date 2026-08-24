# Browser drivers

Each `*.mjs` here drives a real browser against a real dev server and asserts on the
consequence a user actually receives. They are not unit tests — `pnpm test` covers pure logic
and schemas; this level exists for what compiles and still does not work.

```bash
pnpm emulators                 # terminal 1: auth, firestore and storage, on demo-mad-e2e
pnpm dev:e2e                   # terminal 2: the app pointed at them, on :3100
pnpm e2e:env --since           # terminal 3: only what the working tree touches — start here

pnpm e2e:env loading catalog   # by name
pnpm e2e --list                # what would run, without running it (writes nothing)
pnpm e2e:env                   # all of them
```

Nothing above needs a secret or any setup on a fresh clone: `.env.e2e` is committed, and it
points at the emulators.

## They run against the emulators, and the runner refuses otherwise

The drivers **write for real**: they publish listings, create accounts and upload files. Pointed
at the deployed project they do all of that *in production*, and that is not hypothetical — it
put **306 fake listings in the public catalogue**, 329 applications and 644 auth accounts, and
took a morning to undo.

So `run.mjs` refuses to start unless `FIREBASE_PROJECT_ID` names a `demo-` project. That prefix is
not a convention: the Firebase SDKs **refuse to contact any real backend** for such a project, so
a run cannot reach production even if every other variable is wrong. `--against-real` is the
escape hatch, spelled out loud enough that nobody types it by accident.

Two details that follow from it:

- **The e2e server is on :3100, not :3000.** Next 16 allows only one dev server per directory, so
  it replaces an ordinary `pnpm dev` rather than sitting beside it — but the different port means
  that if you forget and start the ordinary one, the drivers fail to connect instead of quietly
  writing to the real project. Every driver goes through `BASE`; four used to hardcode
  `localhost:3000` and the port change is what found them.
- **The emulator loads `firestore.rules` from the working tree.** Until now the drivers ran against
  whatever was *deployed*, so a rules change was unverified at this level until after a deploy.

### The emulator starts empty, and that is the point

Several drivers used to lean on listings other drivers had left in the shared database — a
driver that passes because of somebody else's leftovers is a driver that passes for the wrong
reason. On a fresh emulator each one has to seed what it needs. `header` is the first that showed
this, waiting for a catalogue link that nothing had published.

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

## Los drivers se corren con el servidor SIN clave de correo

**Siempre, no solo para `contract`.** Cada movimiento de etapa manda un correo de verdad — hay 15
llamadas a `notify()` — y un proceso recorre nueve etapas. Doce drivers, unas cuantas veces al día,
son cientos de correos contra el tope de **100 al día** del plan gratuito de Resend. Ya agotó la
cuota una vez, y el síntoma no es obvio: Resend responde **429 `daily_quota_exceeded`** y
`requestSignatureCode` reporta un fallo de envío real, que es lo correcto pero se lee como un bug.

**`.env.e2e` ya lo trae vacío**, así que `pnpm dev:e2e` no puede gastar cuota ni por olvido — que
es la única forma en que se agotó. Si necesitas el log del servidor (`contract` lo lee para sacar
el código):

```bash
pnpm dev:e2e > /tmp/dev.log 2>&1 &
E2E_DEV_LOG=/tmp/dev.log pnpm e2e:env
```

Sin clave, `sendEmail` escribe el asunto en el log y sigue — el contrato que Resend y WhatsApp
tienen en todo el producto. No se pierde cobertura: lo que el driver verifica es que la
notificación **se produjo**, no que Resend la aceptó.

## `contract` además lo necesita para leer el código

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

## Sin cuenta de servicio no hay URL firmada, y eso cambia lo que se puede asertar

La suite emulada no puede firmar URLs de Storage: firmar necesita una cuenta de servicio y un
proyecto `demo-` no tiene ninguna, así que `getSignedUrl` responde `Cannot sign data without
client_email`. **Un driver no puede colgar nada de un enlace firmado**, y `contract` lo hacía: moría
en la séptima aserción, con toda la etapa de la firma sin verificar en un navegador.

Ahora asserta por los dos caminos y dice cuál corrió: si hay enlace, que sea de Storage, firmado y
con caducidad; y en los dos entornos, la propiedad que ese enlace defiende — que el contrato **no se
lee sin ser parte del proceso** — contra `/api/arriendos/<id>/contrato`, que es del propio origen y
sí funciona aquí. Para los bytes de un archivo hay `adminStorage()` en `lib.mjs`, que los lee del
bucket emulado: es más fuerte que descargar un enlace, porque mira el objeto y no la dirección.

El producto tuvo que arreglarse para eso, y era un fallo de verdad: el panel de la firma colgaba el
registro entero del enlace, así que un fallo al firmarlo dejaba la pantalla diciendo "sube el
contrato" con el contrato subido. `features/lease` ya había pagado esa lección. `documents` y
`first-payment` siguen rojos por lo mismo, en sus propios paneles.

## Tres drivers todavía se inicializan con el service account real

`guarantee`, `interview` y `rentals-layout` no migraron a `adminDb()` de `lib.mjs`: leen
`.env.local` con `readFileSync` y una ruta absoluta, y llaman `initializeApp({ credential: cert(...) })`
con las credenciales del proyecto **real**. Con los hosts del emulador puestos escriben en el
namespace del proyecto equivocado — fallan con `5 NOT_FOUND: no entity to update: app:
"dev~mi-arriendo-directo-mad"` — y **sin ellos escribirían en producción**, que es justo lo que la
suite emulada existe para hacer imposible. El arreglo es una línea por driver: `adminDb()` y
`adminFieldValue()` de `lib.mjs`, que ya hacen la comprobación `demo-`.

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
