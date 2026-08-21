---
name: mad-architecture
description: Estructura de carpetas, fronteras entre módulos y refactors estructurales de miarriendodirecto.com. Úsala antes de crear una carpeta nueva, cuando dudes dónde va un archivo, cuando un import cruce de un dominio a otro, y para cualquier movimiento o renombrado masivo de archivos ("esto no escala", "reorganicemos", "movamos todo a features/").
---

# MAD Architecture — dónde va cada archivo y cómo se mueve sin romper nada

Esta skill tiene **dos modos** y son inseparables a propósito:

- **Modo contrato** (§1–§4): la forma objetivo y las fronteras. Lo consulta `mad-feature` en
  cada feature nueva. Es la única fuente de verdad de "dónde va esto".
- **Modo migración** (§5–§8): cómo llevar el repo desde donde está hasta esa forma, en
  rebanadas verificables. Un refactor estructural sin protocolo produce un commit de 200
  archivos que nadie puede revisar y que nadie se atreve a revertir.

Si haces el refactor y no dejas la frontera **ejecutable** (§3), en tres features la
estructura vuelve a torcerse. Mover carpetas es la parte fácil y la que no dura.

---

## 1. La forma objetivo

El corte es **vertical por dominio**, no horizontal por capa técnica. El síntoma de un corte
horizontal (`lib/domain/`, `lib/validations/`, `lib/data/` en paralelo) es que agregar
`postulacion` obliga a tocar cinco carpetas y borrarlo obliga a recordar cinco sitios.

```
app/                      SOLO routing. page/layout/route delgados: sesión, datos, composición
  (auth)/                 route group — no cambia la URL
  (app)/                  route group del producto autenticado
  api/<x>/route.ts

features/<dominio>/       perfil, inmueble, postulacion, contrato, pago…
  domain/                 tipos y reglas puras (XInput / XDoc / X), sin Firebase, sin React
  validations/            schemas Zod del dominio
  data/                   lecturas de servidor con Admin SDK, serializadas a POJO
  actions/                "use server": mutaciones
  ui/                     componentes del dominio (Server por defecto)
  *.test.ts               unitarios colocados junto a lo que prueban
  index.ts                API PÚBLICA del módulo — lo único importable desde fuera

shared/                   transversal, sin dueño de dominio
  ui/                     primitivas shadcn y composiciones visuales. CERO lógica, CERO datos
  form/                   campos ya cableados (label + error + ARIA): TextField, PhoneField…
  shell/                  chrome de la app: sidebar, auth-shell, botón de salir
  brand/                  logo
  auth/                   sesión, guards, rutas, errores de Firebase Auth, cliente de auth
  firebase/               app, auth, db, storage, admin, analytics
  format/                 dinero, fechas, saludos — puro
  phone/                  catálogo de países y reglas E.164
  lib/                    utils (cn)

tests/rules/              security rules — prueban firestore.rules, no un feature
```

Dos criterios para decidir si algo es `features/` o `shared/`:

- **Lo usan dos dominios → `shared/`.** `SubmitButton` lo usan login y onboarding: es
  compartido. Si lo dejas dentro de `features/auth/ui/`, `features/perfil` tiene que importar
  los internos de `auth` y la frontera se cae el primer día.
- **Nombra el dominio, no la pantalla.** `features/contrato`, no `features/inicio`. Una
  pantalla compone dominios; un dominio no pertenece a una pantalla.

Un módulo de un solo archivo puede vivir suelto en la raíz de `shared/` (`shared/analytics.tsx`);
crear una carpeta para un archivo solo agrega ruido. En `features/` no: ahí las capas son fijas.

`index.ts` no es un barrel de conveniencia: es la lista de lo que el resto del repo puede
usar. Si algo no está ahí, es interno y se puede cambiar sin buscar por todo el repo.

---

## 2. Las fronteras

| Zona | Puede importar | Nunca |
| --- | --- | --- |
| `app/**` | `@/features/<x>` (el index), `@/shared/**` | internos de un feature (`@/features/x/data/…`) |
| `features/<a>/**` | lo propio con rutas **relativas**, `@/shared/**`, y `@/features/<b>` (index) | `@/app/**`, internos de otro feature |
| `features/*/domain` | nada del proyecto salvo `@/shared/format` | Firebase, React, `next/*` |
| `shared/ui/**` | `@/shared/lib`, `@/shared/ui` | `@/features/**`, `@/app/**`, `@/shared/firebase/**`, datos |
| `shared/form/**` | `@/shared/{ui,lib,phone,format}` | `@/features/**`, `@/shared/firebase/**` |
| `shared/**` | `@/shared/**` | `@/features/**`, `@/app/**` |
| `shared/firebase/admin` | — | cualquier archivo que no sea `*/data/*`, `*/actions/*`, `app/api/*` o `shared/auth/*` |

Por qué cada una importa:

- **Un feature no alcanza los internos de otro** porque si no, `index.ts` es decorativo y
  cualquier refactor interno rompe a un vecino. Cuando dos dominios se necesitan de verdad, la
  composición ocurre en `app/`, que es el único sitio que conoce a todos.
- **`shared/` no importa `features/`** porque esa flecha es un ciclo, y un ciclo convierte
  "borro este feature" en "el build no compila".
- **`domain/` no importa Firebase** porque es lo único que se puede probar en milisegundos sin
  emulador. Es donde vive el cálculo del canon, no el `getDoc`.
- **`admin` acotado** porque `import "server-only"` te avisa cuando ya escribiste el import en
  un componente cliente; la regla de lint te avisa antes.

---

## 3. Fronteras ejecutables (esta es la parte que dura)

### `tsconfig.json` — mata el comodín

```jsonc
"paths": {
  "@/app/*": ["./app/*"],
  "@/features/*": ["./features/*"],
  "@/shared/*": ["./shared/*"]
}
```

Con `"@/*": ["./*"]` cualquier archivo alcanza cualquier archivo y ninguna de las reglas de
abajo se puede expresar. En un refactor va en dos pasos: **añade** los tres alias en la
primera rebanada (conviven con el comodín) y **borra el comodín en la última**, cuando
`grep -rn '@/lib/\|@/components/' app features shared tests` no devuelva nada. Borrarlo antes
rompe todos los imports que aún no has movido.

### `eslint.config.mjs` — la regla que más veces salva

Dentro de un feature se importa con **rutas relativas**; `@/features/…` queda reservado para
cruzar de módulo, y así "import profundo" es sinónimo de "violación de frontera":

```js
const CROSS_FEATURE = {
  group: ["@/features/*/*", "@/features/*/**"],
  message: "Importa la API pública del módulo (@/features/<dominio>), no sus internos.",
};
const NO_ADMIN = {
  group: ["@/shared/firebase/admin"],
  message: "El Admin SDK solo se usa en data/, actions/, app/api/ y shared/auth/.",
};
const NO_UPWARD = {
  group: ["@/features/**", "@/app/**"],
  message: "shared/ es transversal: no puede depender de un feature ni de una ruta.",
};

// …después de nextVitals y nextTs, y en este orden (el último que hace match gana):
{ rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE, NO_ADMIN] }] } },
{ files: ["shared/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE, NO_ADMIN, NO_UPWARD] }] } },
{ files: ["**/data/**", "**/actions/**", "app/api/**", "shared/auth/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE] }] } },
```

`no-restricted-imports` es **una sola regla**: en flat config el último objeto que hace match
la reemplaza entera, no la suma. Por eso cada override repite la lista completa que sí aplica.

### `pnpm arch` — lo que lint no alcanza

`no-restricted-imports` no ve ciclos ni "quién importa a quién" en general. Añade
`dependency-cruiser` como devDependency, con reglas para: ciclos, `shared → features`,
`domain → firebase`, y huérfanos. Entra a la barra de verificación al lado de `typecheck`.

### `components.json` — o `shadcn add` recrea `components/`

Los alias de shadcn deben apuntar a la forma nueva, o el próximo `shadcn add` escribe en
`components/ui/` y aparece una segunda copia de las primitivas:

```jsonc
"aliases": { "components": "@/shared", "ui": "@/shared/ui", "lib": "@/shared/lib", "utils": "@/shared/lib/utils", "hooks": "@/shared/hooks" }
```

### `vitest.config.ts` — los tests colocados hay que incluirlos

`include` hoy es `["tests/**/*.test.ts"]`: un test dentro de `features/` **no corre y nadie se
entera**. Amplíalo a `["features/**/*.test.ts", "shared/**/*.test.ts", "tests/**/*.test.ts"]`,
deja `pnpm test` corriendo solo los colocados (`vitest run features shared`) y `pnpm test:rules`
como está. Verifica que el conteo de tests después del refactor sea **igual o mayor** al de
antes; si bajó, un archivo quedó fuera del `include`.

---

## 4. Modo contrato: dónde va un archivo nuevo

En orden; el primer sí manda:

1. ¿Es una ruta, un layout o un route handler? → `app/`. Y nada más: la lógica baja a un feature.
2. ¿Es una primitiva visual sin dominio (`Button`, `TextField`)? → `shared/ui/`.
3. ¿Lo van a usar dos dominios? → `shared/<área>/`.
4. ¿Nombra un dominio del negocio? → `features/<dominio>/<capa>/`.
5. Si no puedes nombrar el dominio, todavía no sabes qué estás construyendo. Vuelve a §2 de
   `mad-feature` (el inventario) antes de crear el archivo.

Un archivo nuevo dentro de un feature **no se exporta en `index.ts` por defecto**. Solo se
agrega cuando alguien de fuera lo necesita de verdad.

---

## 5. Modo migración: el protocolo

Esto no es opcional. Un refactor estructural que se sale del protocolo se convierte en una
tarde de `tsc` gritando por rutas generadas que ya no existen.

1. **Deja el árbol limpio antes de empezar.** `git status` sin nada pendiente. Un cambio de
   comportamiento a medias, mezclado con una mudanza de 50 archivos, produce un diff que nadie
   puede revisar y una revertida imposible.
2. **Escribe el mapa de movimientos primero**, en un archivo, antes de tocar nada: origen →
   destino de cada archivo, más el grafo de imports (`grep -rn 'from "@/' app components lib tests`).
   El mapa es lo que se revisa; los `git mv` son mecánicos.
3. **Andamiaje antes de mover** (§3): paths, zonas de lint, `components.json`, `vitest`. Así
   la primera rebanada ya se valida contra la frontera nueva.
4. **Una rebanada vertical por commit.** Un dominio, o una capa de `shared/`, completa. Nunca
   big bang. Nunca dos dominios en el mismo commit.
5. **`git mv`, no copiar y borrar**: preserva el historial y el `git log --follow` del archivo.
6. **Reescribe los imports desde el mapa, no a mano.** Un `sed` por regla de movimiento sobre
   los archivos que hacen match. A mano se olvida siempre el mismo: el import de un test.
7. **Cero cambios de comportamiento en un commit de movimiento.** Si de paso ves un bug o un
   componente que hay que partir, anótalo y hazlo en un commit aparte, después. Un refactor
   estructural en el que además "aprovechaste para arreglar algo" pierde su única propiedad
   valiosa: que si algo se rompe, sabes que fue la mudanza.
8. **Actualiza la documentación en el mismo PR**: la tabla de rutas y de componentes de
   `CLAUDE.md`, y `mad-feature`. Documentación que apunta a `components/auth/…` cuando el
   archivo ya vive en `features/auth/ui/…` es peor que no tener documentación: el siguiente
   agente crea el archivo otra vez en el sitio viejo.

---

## 6. Invariantes que un refactor de carpetas NO puede tocar

Un movimiento de archivos debe ser **cero riesgo** para lo que ya está en producción. Si el
diff toca cualquiera de estas cosas, dejó de ser un refactor:

- **Nombres de colecciones de Firestore** (`usuarios`, `contratos`) y **custom claims**
  (`rol`). Están en las rules desplegadas y en los documentos existentes.
- **`firestore.rules`, `storage.rules`, `firestore.indexes.json`.** No se mueven ni se editan.
- **Las URLs.** Un route group (`app/(auth)/`) no cambia la URL; renombrar la carpeta de
  segmento, sí. Las constantes de `routes.ts` cambian de import, nunca de valor.
- **Los nombres del vocabulario de dominio en español** (§Convención de nombres de `CLAUDE.md`).
- **La superficie pública de cada módulo**: si `index.ts` reexporta con el mismo nombre, el
  resto del repo no nota el movimiento. Renombrar y mover a la vez duplica el riesgo.

---

## 7. Verificación, por rebanada (no al final)

Después de **cada** commit del refactor, no una sola vez al terminar:

```bash
rm -rf .next          # los tipos de ruta generados apuntan a la estructura vieja
pnpm typegen          # next typegen — los regenera en segundos, sin build completo
pnpm typecheck
pnpm lint             # aquí aparecen las violaciones de frontera
pnpm arch             # ciclos y flechas prohibidas
pnpm test             # y compara el CONTEO con el de antes del refactor
pnpm build
```

Y al terminar la última rebanada, conduce la app (skill `run`): login, registro, onboarding y
`/inicio`. Un refactor puede dejar `tsc` verde y romper la app en runtime de tres maneras que
el compilador no ve: un `"use client"` que se quedó en el archivo equivocado al partir un
componente, un `import "server-only"` que ahora llega a un árbol cliente, y una ruta que
cambió de URL sin que nadie lo notara.

---

## 8. Trampas de este refactor en concreto

- **`rm -rf .next` tras mover o renombrar rutas.** Ya está en §8 de `mad-feature` y es la
  primera que muerde: `tsc` falla con un error que no tiene nada que ver con tu cambio. Y
  borrarlo **sin regenerar** falla igual: `PageProps` y `LayoutProps` son tipos generados, así
  que el orden es `rm -rf .next` → `pnpm typegen` → `pnpm typecheck`.
- **`shadcn add` recrea `components/ui/`** si no actualizaste `components.json` (§3). El
  síntoma es dos `Button` distintos y un `cn` importado de dos sitios.
- **El `include` de vitest** deja de cubrir los tests colocados y la suite pasa a verde con la
  mitad de los tests. Compara conteos.
- **`tests/rules/` no se mueve a un feature.** Prueba las rules, que son un archivo global.
- **El alias de vitest** (`resolve.alias`) tiene su propia copia de los paths: si cambias
  `tsconfig.json` y no `vitest.config.ts`, `pnpm typecheck` pasa y `pnpm test` no resuelve.
- **Los route groups no cambian la URL**, pero `app/(auth)/page.tsx` y `app/(app)/page.tsx`
  sí colisionan: dos grupos no pueden resolver la misma ruta.
- **Un formulario cliente que importa de `data/`** arrastra `firebase-admin` al bundle. Si
  `pnpm build` engorda de golpe después de una rebanada, es esto.
- **No muevas `app/globals.css`.** `components.json` lo referencia y el import de `layout.tsx`
  es relativo.
