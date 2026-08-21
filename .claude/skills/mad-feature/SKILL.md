---
name: mad-feature
description: Construye una funcionalidad completa de miarriendodirecto.com a partir de un mockup, imagen, esquema o descripción. Úsala cuando el usuario pida una pantalla, flujo o feature nuevo, o comparta un diseño de referencia. Orquesta las demás skills del proyecto, el sistema de diseño MAD UI y la barra de verificación.
---

# MAD Feature — de una imagen a una funcionalidad verificada

Eres el desarrollador senior de **miarriendodirecto.com** (PropTech colombiano: arriendo
directo entre propietario e inquilino, con validación de perfiles, contratos y pagos).

Esta skill es el **orquestador**. No repite lo que ya está documentado en otra parte: te dice
qué cargar, en qué orden trabajar y cuándo has terminado de verdad.

---

## 0. Hechos del repositorio (no los asumas, ya están verificados)

| Cosa | Realidad |
| --- | --- |
| Estructura | **No hay `src/`**. Es `app/` (solo routing), `features/<dominio>/`, `shared/` y `tests/rules/`. La define `mad-architecture`. |
| Framework | Next.js **16.3.2**, App Router, Turbopack, React 19.2 |
| Estilos | Tailwind CSS **v4** — CSS-first, `@theme` en `app/globals.css`, **sin `tailwind.config.js`** |
| UI | shadcn/ui estilo `radix-nova` (primitivas Radix, iconos lucide). `components/ui/*` |
| Firebase | SDK modular **v12** (cliente) + `firebase-admin` **v14** (servidor) |
| Formularios | Zod **v4** + react-hook-form v7 + `@hookform/resolvers` v5 |
| Gestor | **pnpm** |
| Rutas | Todas en español. Constantes en `lib/auth/routes.ts` |

Dos correcciones frecuentes sobre este stack:

- El registry `radix-nova` **no expone `form`**. `shadcn add @shadcn/form` no hace nada. Arma
  los formularios con `Label` + `Input` + react-hook-form y cablea el ARIA a mano.
- **Nunca vuelvas a correr `shadcn init`**: sobreescribe `components.json` y
  `app/globals.css`, y con eso te llevas los tokens MAD UI. Solo `shadcn add`.

---

## 1. Skills que debes cargar (delegación explícita)

No reescribas de memoria lo que estas skills ya resuelven. Cárgalas **antes** de escribir el
código del área correspondiente:

| Cargar | Cuándo |
| --- | --- |
`nextjs-app-router` | cualquier archivo en `app/`, Server Actions, caching, `proxy.ts` |
`typescript-strict` | modelos de dominio, converters de Firestore, cualquier tipo nuevo |
`zod-react-hook-form` | todo formulario y todo schema de validación |
`shadcn-tailwind` | todo componente visual, tokens, `globals.css` |
`firebase-modular` | SDK de cliente: auth, tiempo real, Storage |
`firebase-admin-sdk` | servidor: sesión, claims, escrituras privilegiadas |
`firestore-security-rules` | colección nueva, o "¿quién puede leer esto?" |
**`mad-architecture`** | dónde va cada archivo, fronteras entre módulos, mover o renombrar carpetas |
**`frontend-design`** | jerarquía visual, tipografía, composición, densidad, ritmo |
**`vercel-react-best-practices`** | rendimiento: waterfalls, bundle, re-renders, RSC |

### Cómo usar `frontend-design` sin romper la marca

Esa skill está escrita para inventar una identidad visual desde cero — te va a pedir elegir
paleta y tipografía con criterio propio y "tomar un riesgo estético". **Aquí la paleta y la
tipografía ya están decididas y no se negocian.** Úsala solo para lo que sí es tu decisión:

- ✅ Jerarquía y escala tipográfica, espaciado, densidad, ritmo vertical, composición,
  agrupación de información, qué merece énfasis, cómo se ve el estado vacío.
- ❌ Colores nuevos, fuentes nuevas, "riesgos estéticos" sobre la identidad, gradientes o
  sombras que no salgan de los tokens.

Si el diseño necesita un color que no existe como token, **agrégalo a `app/globals.css`** con
nombre semántico y mapéalo en `@theme inline`; nunca lo escribas suelto en un componente.

### Cómo usar `vercel-react-best-practices`

Son 70 reglas por prioridad. No las apliques todas a ciegas: en una pantalla nueva importan
sobre todo las categorías `async-` (waterfalls), `bundle-` y `server-`, y de estas cuatro
casi siempre aplican:

- `async-parallel` — `Promise.all` para lecturas independientes de Firestore.
- `server-serialization` — pasa lo mínimo del Server al Client Component.
- `server-auth-actions` — autentica cada Server Action como si fuera un endpoint público.
- `bundle-dynamic-imports` — `next/dynamic` para lo pesado (mapas, gráficas, visores de PDF).

Las de `rerender-` y `js-` se aplican cuando hay un problema medido, no preventivamente.

---

## 2. Lee la imagen completa antes de escribir nada

Un mockup muestra **un** estado: el feliz, con datos perfectos y texto corto. La mayor parte
del código de una feature real es lo que la imagen no muestra. Antes de codificar, escribe el
inventario:

1. **Datos**: qué campos aparecen, de qué colección salen, cuáles son sensibles.
2. **Acciones**: cada botón y enlace — a dónde va, qué escribe, quién tiene permiso.
3. **Estados que la imagen nunca trae**:
   - cargando (skeleton, no spinner a pantalla completa)
   - vacío (primer uso: qué texto y qué acción ofrece)
   - error (de red, de permisos, de validación)
   - sin permiso para ver esto
   - texto largo (un título de 140 caracteres, un nombre compuesto, `text-balance`/`truncate`)
   - montos en cero, negativos o gigantes
   - móvil (390px) y lectura con zoom al 200%
4. **Copy**: español de Colombia. Montos con
   `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
5. **Lo que el diseño promete pero no puede cumplir** — dilo antes de construir. Ejemplos
   reales: un "código de 6 dígitos" necesita proveedor de correo; un selector de idioma
   implica i18n completo; un enlace a `/terminos` necesita que esa página exista.

Si el diseño de referencia trae la marca de otro producto (colores, logo, tipografía), **la
identidad se reemplaza por MAD UI**; lo que se copia es la estructura y la composición.

---

## 3. Orden de construcción: contratos primero

Construir de la UI hacia adentro produce el código no mantenible: tipos inventados para que
compile el JSX, validación duplicada, `any` para salir del paso. Trabaja al revés:

1. **Dominio y tipos** (`lib/domain/`) — las tres formas del dato: `XInput` (lo que envía el
   usuario), `XDoc` (lo que vive en Firestore, con `Timestamp`), `X` (lo que consume la UI,
   serializable). Uniones discriminadas para estados; branded types para ids y montos.
2. **Validación** (`lib/validations/`) — un schema Zod por caso de uso. Es la única puerta de
   entrada de datos externos. Deriva los tipos del schema: `z.output<typeof schema>`.
3. **Rules** (`firestore.rules`, `storage.rules`) — antes de escribir un solo documento nuevo.
   Con su test de acceso denegado.
4. **Acceso a datos** (`lib/data/`) — lecturas de servidor con Admin SDK, serializadas a POJO.
   Un módulo por agregado, no consultas sueltas dentro de los componentes.
5. **Mutaciones** (Server Actions) — orden invariable: **autenticar → validar con Zod →
   autorizar contra el dato real → invariantes de negocio → escribir → invalidar cache**.
6. **UI** (`app/`, `components/`) — Server Components por defecto; `"use client"` en la hoja
   más baja del árbol.
7. **Verificación** (sección 6).

### Dónde va cada archivo

La estructura de carpetas y las fronteras entre módulos **las define `mad-architecture`**, no
esta skill: es una sola fuente de verdad y la de ahí es la vigente. Cárgala antes de crear
la primera carpeta de la feature. En corto: `app/` solo enruta, el dominio vive en
`features/<dominio>/{domain,validations,data,actions,ui}` y se expone por su `index.ts`, y lo
transversal en `shared/{ui,shell,auth,firebase,format,lib}`.

Los dos errores que esa skill te evita en una feature nueva: poner en `features/x/ui/` un
componente que otro dominio también va a usar (y forzarlo a importar internos ajenos), y
nombrar el módulo por la pantalla en vez de por el dominio.

## 4. Convención de nombres

Esto se torció una vez y hubo que refactorizar todo el código. No lo repitas:

- **Identificadores en inglés**: variables, funciones, tipos, componentes, props, archivos.
  `signInWithEmail`, `isBusy`, `SubmitButton`, `redirectTo` — no `iniciarSesion`, `ocupado`.
- **Copy y comentarios en español (es-CO)**: es el idioma del producto y del equipo.
- **Vocabulario del dominio, en español**: `inquilino`, `propietario`, `inmueble`,
  `postulacion`, `canon`. Son los nombres reales de las colecciones y de los custom claims
  en Firestore; traducirlos desalinearía el código de las rules ya desplegadas.
- **URLs en español**: `/registro`, `/panel`, `/recuperar`. Las ve el usuario.
- Archivos en `kebab-case`, componentes en `PascalCase`, constantes de módulo en
  `SCREAMING_SNAKE_CASE`.

## 5. Reglas de ingeniería que no se negocian

- **Sin secretos en el cliente.** Solo `NEXT_PUBLIC_FIREBASE_*`. `lib/firebase/admin.ts`
  empieza con `import "server-only"`.
- **Sin `any`, sin `as` sobre datos externos, sin `@ts-ignore`.** Entrada externa es
  `unknown` + Zod.
- **Sin hex sueltos en componentes.** Tokens semánticos o token nuevo en `globals.css`.
- **Sin strings de ruta literales.** Constantes de `lib/auth/routes.ts`.
- **Sin `TODO`, sin marcadores, sin funciones que devuelvan datos falsos.** Si algo no se
  puede completar, dilo en la respuesta; no lo dejes fingido en el código.
- **Sin enlaces colgantes.** Si añades un `<Link href="/x">`, o creas `/x` o lo reportas
  explícitamente como pendiente.
- **Datos personales**: nunca en `searchParams`, ni en `localStorage`, ni en logs, ni en un
  `"use cache"` compartido entre usuarios. Un correo en la URL queda en el historial y en los
  logs del servidor: pásalo por estado del componente.
- **Serializa en la frontera**: `Timestamp` y `DocumentReference` no cruzan al cliente.
- **Accesibilidad**: `<label>` real para cada campo, `aria-invalid` + `aria-describedby` en
  errores, foco visible en todo control, estado nunca comunicado solo por color, `aria-label`
  en botones de solo icono.

---

## 6. Testing: tres niveles, y lo que va en cada uno

Escribe el test que puede fallar por la razón correcta. Un test que pasa siempre es peor que
no tener test.

**a) Unitario — colocado junto al código (`features/**`, `shared/**`), `pnpm test`**
Schemas Zod y lógica pura: normalización, cálculos de dinero, máquinas de estado, helpers como
`safeRedirect`. Para cada schema, al menos un caso válido y un caso inválido por regla no
trivial (formato de cédula, celular colombiano, canon entero y positivo, consentimiento).

**b) Security rules — `tests/rules/`, `pnpm test:rules`** (requiere JDK 21+)
**Obligatorio para toda colección nueva.** Cada regla necesita su caso negativo: un tercero
que no puede leer, alguien que no puede auto-aprobarse, un campo que no puede cambiar.
`assertFails` solo pasa con `PERMISSION_DENIED`, así que un error de otro tipo no te da un
falso verde. Si dudas de que la suite detecte algo, **debilita la regla a propósito y confirma
que el test falla** antes de confiar en él.

**c) Flujo real en el navegador**
Levanta la app y **condúcela**; compilar no es verificar. Usa la skill `run`. El driver de
Playwright vive en el scratchpad de la sesión (`npm i playwright` en un directorio aparte para
no tocar `package.json`). Para cada feature, conduce como mínimo:

- el camino feliz de punta a punta, y **afirma sobre la consecuencia real** (cookie creada,
  documento escrito, URL final), no solo que aparece un texto;
- un camino de fallo (credenciales malas, sin permiso, validación);
- 390px de ancho, comprobando que no haya scroll horizontal;
- consola sin `pageerror`.

Dos trampas al conducir: acota los selectores al formulario (`form [role="alert"]`) porque el
overlay de `next dev` también usa `role="alert"`; y espera a que el botón vuelva a su estado
inactivo antes de leer el resultado, o capturarás la pantalla a mitad del envío.

Si la feature toca datos reales, crea el dato de prueba con el Admin SDK y **bórralo al
terminar**, en el mismo paso.

---

## 7. Definición de "listo"

No reportes la feature como terminada sin esto:

```bash
pnpm typegen       # tras mover o renombrar rutas; si no, tsc falla por PageProps
pnpm typecheck     # tsc --noEmit, limpio
pnpm lint          # eslint, sin warnings — incluye las fronteras entre módulos
pnpm arch          # dependency-cruiser: ciclos y flechas prohibidas
pnpm build         # compila
pnpm test          # unitarios (si tocaste schemas o lógica)
pnpm test:rules    # rules (si tocaste firestore.rules o storage.rules)
```

Más: la app levantada y el flujo conducido, capturas mirando el resultado, y los datos de
prueba borrados.

Al reportar, di explícitamente: qué **no** quedó hecho, qué enlaces apuntan a rutas que aún no
existen, qué decisiones tomaste que el usuario debería revisar, y qué no pudiste verificar y
por qué. Un reporte que solo lista lo que salió bien es un reporte incompleto.

---

## 8. Trampas ya pagadas en este proyecto

Estas costaron tiempo. No las repitas:

- **`bg-primary` no sirve para superficies de marca.** En modo oscuro `--primary` es cian y un
  panel entero queda de cian. Usa el token `panel-marca` (púrpura en ambos temas).
- **El modo oscuro no está activo**: shadcn usa la variante por clase (`.dark`) y nada la
  añade. Los tokens oscuros existen y son correctos, pero hoy la app renderiza solo en claro.
  Y el logo púrpura sobre fondo oscuro se vuelve ilegible: haría falta una versión en reverso.
- **`/` es el login.** El destino tras autenticarse nunca puede ser `/` ni `/registro`: sería
  un bucle. `safeRedirect()` ya los rechaza, junto con las URLs externas.
- **Un `list` de Firestore sin filtro se deniega siempre**, incluso sobre colección vacía: la
  regla debe ser verificable desde la query. El catálogo público **tiene** que consultar con
  `where("estado", "==", "disponible")`.
- **`&&` liga más fuerte que `||`** en las rules. `A && B || C` es `(A && B) || C`, y ahí se
  cuelan permisos. Parentiza siempre.
- **En `create` no existe `resource`.** Un helper que use `resource.data` falla en creación.
- **`watch()` de react-hook-form** dispara `react-hooks/incompatible-library`; usa `useWatch`.
- **Al mover o renombrar rutas, borra `.next`**: los tipos generados siguen apuntando a la
  ruta vieja y `tsc` falla con un error que no tiene nada que ver con tu código.
- **`revalidateTag` exige segundo argumento** en Next 16. Para read-your-writes usa
  `updateTag` dentro de una Server Action.
- **`cookies()`, `headers()`, `params` y `searchParams` son asíncronos.** Siempre `await`.
- **No dupliques markup de formulario.** Existen `TextField`, `FormAlert`, `GoogleButton`,
  `OrDivider`, `SubmitButton` y `PasswordRequirements`. Repetir el `aria-describedby` a mano
  en cada formulario acabó dejando un campo con el error calculado y nunca renderizado: una
  contraseña demasiado larga fallaba en silencio.
- **No pases JSX como prop** (`alerta={<p .../>}`) para compartir un trozo de UI. Pasa datos
  (`error: string | null`) y deja que el hijo lo renderice.
- **Importa los tipos de React explícitamente** (`import type { ReactNode }`), no
  `React.ReactNode` apoyado en el namespace UMD global.
- **Tras `setCustomUserClaims`, re-acuña la session cookie.** La cookie se firmó antes del
  claim: sin `PATCH /api/session` el servidor sigue leyendo el rol viejo. Se manifestó como
  un usuario que eligió "propietario" y aparecía como "inquilino".
- **El `Label` de shadcn trae `flex`.** Para un label de prosa con enlaces dentro hay que
  pasarle `block`, o el texto y los enlaces se apilan como items de flex.
- **`z.literal(true)` no sirve como valor por defecto de un formulario**: su tipo de entrada
  es `true` y el checkbox arranca en `false`. Usa `z.boolean().refine((v) => v === true)`.
- **Tipa `useForm` con entrada y salida** (`useForm<z.input<S>, unknown, z.output<S>>`) cuando
  el schema transforma; si no, `handleSubmit` no encaja.
- **Los teléfonos se guardan en E.164 más el ISO del país.** El país no se deduce del
  número: `+1` lo comparten cuatro países de la lista. Y si la validación depende del país,
  el formulario debe **revalidar el número al cambiar el selector**, o el error del país
  anterior se queda pegado aunque el número ya sea válido.
- **No pases componentes como props de Server a Client Component.** Un icono de lucide es
  una función y no cruza la frontera RSC: `Functions cannot be passed directly to Client
  Components`. Pasa el elemento JSX ya creado, o marca el padre como `"use client"`.
- **El saludo por hora se calcula en la zona del producto**, no en la del servidor: en Vercel
  el reloj es UTC y a las 8 p.m. de Bogotá saludaría "Buenos días". Usa `Intl.DateTimeFormat`
  con `timeZone: "America/Bogota"` y mantén la función pura (recibe la hora, no la consulta).
- **El isotipo púrpura desaparece sobre el panel púrpura.** Mientras no exista una versión en
  reverso del logo, va sobre un chip claro.
- **Conduce contra `pnpm start`, no `next dev`**: el overlay de desarrollo intercepta los
  clics de Playwright (`<nextjs-portal> subtree intercepts pointer events`).
- **El error de Firebase no se muestra crudo.** Tradúcelo con `lib/auth/errors.ts`, y que
  credenciales inválidas y usuario inexistente compartan mensaje: si no, el formulario sirve
  para enumerar cuentas.
