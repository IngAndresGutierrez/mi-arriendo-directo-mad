/**
 * What each driver covers, as path prefixes.
 *
 * This exists so a change does not run all of them. Adding a skeleton once ran the whole
 * corpus — `interview`, `reminders` and `documents` included, none of which a `loading.tsx`
 * can affect — and every failure after that was the harness, not the product.
 *
 * `pnpm e2e --since` reads `git diff --name-only` and runs only the drivers whose prefixes it
 * touches. A driver with no entry here never runs from a diff, which is a bug in this file,
 * not a feature: `pnpm e2e` with no arguments still runs everything.
 */
export const COVERS = {
  // The frame every product screen renders inside.
  loading: ["app/(app)/", "shared/ui/skeleton", "shared/ui/nav-item", "shared/shell/"],
  nav: ["shared/shell/app-nav", "shared/shell/app-shell", "shared/ui/nav-item", "app/(app)/inicio"],
  "nav-profile": ["shared/shell/app-nav", "shared/ui/nav-item", "features/profile/"],
  drawer: ["shared/shell/app-drawer", "shared/shell/app-nav"],
  "sidebar-collapse": ["shared/shell/app-sidebar", "shared/shell/sidebar-state", "shared/ui/nav-item"],
  header: ["shared/shell/account-menu", "app/(public)/", "shared/shell/"],

  // The public catalog.
  // `features/property/ui/` belongs here as much as it does to `lightbox`: `PropertyCard` *is*
  // the catalogue's unit, so a change to the card that only selected `lightbox` was a real miss.
  catalog: ["app/(public)/inmuebles", "features/property/ui/", "features/property/domain/catalog", "features/property/validations/catalog"],
  facets: ["app/(public)/inmuebles", "features/property/ui/", "features/property/domain/catalog"],
  pagination: ["app/(public)/inmuebles", "features/property/domain/catalog"],
  "listing-scroll": ["app/(public)/inmuebles", "shared/shell/"],
  lightbox: ["app/(public)/inmuebles", "features/property/ui/"],
  /*
   * Lo que el sitio le dice a un buscador. Cubre las dos mitades: el catálogo y el detalle, que sí
   * llevan SEO, y el portal, que no — por eso `app/(app)/layout` está en la lista, porque es el
   * archivo de una línea del que sale el `noindex` de todas esas pantallas.
   */
  /*
   * Las tres páginas legales, el pie que las alcanza y el banner de cookies.
   *
   * `shared/legal/` está aquí porque de ahí sale la identidad del Responsable, que es lo que el
   * driver afirma sobre el texto que recibe un desconocido. `app/public-chrome.tsx` también:
   * el pie vive dentro del `main` que scrollea el catálogo, y ese equilibrio es lo que este
   * driver protege.
   */
  legal: [
    "app/terminos/",
    "app/privacidad/",
    "app/cookies/",
    "app/legal-chrome.tsx",
    "app/public-chrome.tsx",
    "app/(public)/inmuebles",
    "features/legal/",
    "shared/legal/",
    "shared/shell/legal-footer",
  ],
  seo: [
    "app/robots.ts",
    "app/sitemap.ts",
    // El sitemap lista las tres páginas legales, así que moverlas es un cambio de SEO.
    "app/terminos/",
    "app/privacidad/",
    "app/cookies/",
    "app/opengraph-image",
    "app/layout.tsx",
    "app/(app)/layout.tsx",
    "app/(auth)/",
    "app/(public)/inmuebles",
    "features/property/domain/seo",
    "features/property/data/property",
    "shared/seo/",
    "shared/brand/og",
    "shared/lib/site-url",
  ],

  /*
   * La landing pública y la mudanza del login.
   *
   * `app/(auth)/` está en la lista y no es de más: la raíz y el formulario de acceso son ahora dos
   * rutas distintas que solo tienen sentido juntas, y este driver es el único que comprueba que
   * mover una no deja a la otra sin puerta. `features/property/domain/cities` también, porque de
   * ahí salen las ciudades del buscador y las tarjetas.
   */
  landing: [
    "app/(marketing)/",
    "app/(auth)/",
    "app/sitemap.ts",
    "features/property/domain/cities",
    "features/property/ui/property-teaser-card",
  ],

  // Auth and the profile.
  session: ["app/api/session", "shared/auth/", "features/auth/", "app/(auth)/"],
  signout: ["app/api/session", "shared/auth/", "shared/shell/account-menu"],
  onboarding: ["app/(auth)/", "features/profile/", "shared/geo/", "shared/phone/"],
  profile: ["features/profile/", "features/tenant-profile/", "app/(app)/perfil-inquilino"],
  "department-city": ["shared/geo/", "features/profile/", "features/property/validations"],
  prehydration: ["shared/form/", "app/(auth)/"],
  "field-hint": ["shared/form/field-hint", "shared/form/text-field"],

  // The landlord's properties.
  publish: ["features/property/", "app/(app)/inmuebles", "shared/geo/"],
  "manage-properties": ["features/property/", "app/(app)/mis-inmuebles"],
  /*
   * La ubicación en el mapa. `shared/map/` y `shared/geo/point` son suyos y de nadie más, pero
   * `features/property/` también entra: el punto viaja por el esquema, la acción y el detalle, y
   * un cambio en cualquiera de los tres rompe la separación entre la coordenada exacta y la
   * publicada sin que nada más lo note.
   */
  map: [
    "shared/map/",
    "shared/geo/point",
    "features/property/",
    "app/(app)/inmuebles",
    "app/(app)/mis-inmuebles",
    "app/(public)/inmuebles",
  ],
  amount: ["shared/format/money", "features/property/validations"],

  // The rental process.
  apply: ["features/application/", "app/(app)/contratos", "app/(app)/postularme"],
  documents: ["features/tenant-profile/", "features/application/", "app/(app)/contratos"],
  interview: ["features/application/domain/interview", "features/application/validations/interview", "features/application/ui/"],
  guarantee: [
    "features/application/domain/guarantee",
    "features/application/validations/guarantee",
    "features/application/actions/guarantee",
    "features/application/ui/",
    "app/(app)/contratos",
    "features/tenant-profile/domain/tenant-profile",
  ],
  withdraw: ["features/application/"],
  "first-payment": [
    "features/application/domain/payout",
    "features/application/validations/payout",
    "features/application/actions/payout",
    "features/application/ui/first-payment-panel",
    "features/application/ui/stage-actions",
    "features/application/ui/advance-button",
    "app/(app)/contratos",
  ],
  contract: [
    "features/application/domain/contract",
    "features/application/validations/contract",
    "features/application/actions/contract",
    /*
     * La firma misma, que faltaba: el reto, el lienzo y el colocador de recuadros son este driver y
     * ningún otro, así que un cambio solo en el lienzo no seleccionaba nada. Es el fallo que el
     * comentario de abajo describe, en pequeño.
     */
    "features/application/actions/signature",
    "features/application/actions/stamp",
    "features/application/ui/contract-panel",
    "features/application/ui/signature-pad",
    "features/application/ui/signature-placer",
    "features/application/ui/stage-actions",
    "features/application/ui/advance-button",
    "shared/format/bytes",
    "app/(app)/contratos",
  ],
  reminders: ["app/api/cron/", "features/application/domain/interview", "features/notification/"],

  // La tenencia: lo que corre después de la novena etapa.
  rental: [
    "features/lease/",
    "app/(app)/arriendos",
    "features/application/actions/advance",
    "shared/format/date",
  ],
  // Los incidentes de una tenencia: el reporte del inquilino, con fotos y video.
  incidents: [
    "features/lease/domain/incident",
    "features/lease/validations/incident",
    "features/lease/data/incident",
    "features/lease/actions/incident",
    "features/lease/ui/incident-list",
    "app/(app)/arriendos",
    "storage.rules",
  ],
  notifications: ["features/notification/", "shared/lib/site-url"],

  // Layout assertions: alignment, no horizontal scrolling at 390px, the active nav entry.
  "actions-layout": ["features/application/ui/", "app/(app)/contratos"],
  // Its subject is the application summary on the process page, not the profile forms: the
  // entry it used to carry was another driver's, so renaming the section never selected it.
  "application-layout": ["features/application/", "app/(app)/contratos"],
  "birthdate-layout": ["shared/form/", "features/profile/"],
  "rentals-layout": ["app/(app)/contratos", "shared/shell/"],
};

/** Drivers that need a landlord, a tenant and a property, so they are the slow ones. */
export const SLOW = ["documents", "apply", "interview", "guarantee", "notifications", "reminders", "withdraw", "rental", "incidents", "map"];

/**
 * Rutas tan transversales que cualquier cambio en ellas selecciona **todos** los drivers.
 *
 * `shared/ui/` es la razón por la que esto existe: pasar los 27 botones de los paneles de `lg` a
 * `xl` y añadir una variante toca un fichero que está en todas las pantallas del producto, y
 * `--since` seleccionaba doce drivers porque el manifiesto solo mapeaba los dos componentes de
 * `shared/ui/` que alguien se había acordado de listar. Un primitivo compartido no se puede mapear
 * a una lista: se mapea a todo.
 *
 * Sí, correr los 32 cuesta unos diez minutos. Perderse una regresión en un botón que sale en cada
 * pantalla cuesta más.
 */
export const SELECTS_EVERY_DRIVER = [
  "shared/ui/",
  "shared/form/",
  /*
   * `shared/format/` por la misma razón, y la lección se pagó dos veces.
   *
   * El dinero y las fechas salen en todas las pantallas del producto, y aquí estaban mapeados a mano
   * a un driver cada uno: `shared/format/money` a `amount`, `shared/format/date` a `contract`.
   * Normalizar el espacio fino que `Intl` mete antes de "p. m." — un fallo de hidratación real —
   * seleccionaba dieciséis drivers y dejaba fuera `contract`, `interview`, `guarantee` y
   * `first-payment`, que son justo los cuatro paneles que muestran una hora.
   *
   * Un primitivo compartido no se mapea a una lista: la lista está mal el día que alguien usa el
   * módulo en un sitio nuevo, y ese día nadie se acuerda de venir a esta línea.
   */
  "shared/format/",
  "app/globals.css",
  "app/layout.tsx",
  /*
   * `shared/auth/routes` es un primitivo compartido y estaba sin mapear, que es la otra mitad del
   * mismo fallo: de ahí salen **todas** las URLs del producto, así que cambiar el valor de una
   * constante no rompe el archivo que la define, rompe cada pantalla que la usa.
   *
   * Se pagó al mover el login fuera de `/`: veintiséis drivers entraban por la raíz a rellenar el
   * formulario, y ninguna lista escrita a mano los habría nombrado a todos.
   */
  "shared/auth/routes",
  /*
   * `app/public-header.tsx` es el header de **todas** las páginas públicas — la landing, el
   * catálogo, el detalle de un inmueble, las tres legales y `/soporte`— y nació justamente de que
   * había dos copias que se habían separado sin que nada lo notara. Mapearlo a mano sería repetir
   * el fallo un nivel más arriba.
   */
  "app/public-header.tsx",
  /*
   * `shared/legal/` es un primitivo compartido, y mapearlo a mano sería el error que este bloque
   * documenta dos veces: de ahí salen la identidad del Responsable (el pie, en todas las páginas
   * públicas), el aviso de privacidad (cuatro formularios de tres módulos distintos) y las
   * versiones que el onboarding envía. Una lista escrita a mano está mal el día que alguien lo use
   * en un sitio nuevo.
   */
  "shared/legal/",
];

export function driversFor(changedPaths) {
  if (changedPaths.some((path) => SELECTS_EVERY_DRIVER.some((prefix) => path.startsWith(prefix)))) {
    return Object.keys(COVERS).sort();
  }

  const hit = new Set();
  for (const [driver, prefixes] of Object.entries(COVERS)) {
    if (changedPaths.some((path) => prefixes.some((prefix) => path.startsWith(prefix)))) {
      hit.add(driver);
    }
  }
  return [...hit].sort();
}
