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
  nav: ["shared/shell/app-nav", "shared/shell/app-shell", "shared/ui/nav-item"],
  "nav-profile": ["shared/shell/app-nav", "shared/ui/nav-item", "features/profile/"],
  drawer: ["shared/shell/app-drawer", "shared/shell/app-nav"],
  "sidebar-collapse": ["shared/shell/app-sidebar", "shared/shell/sidebar-state", "shared/ui/nav-item"],
  header: ["shared/shell/account-menu", "app/(public)/", "shared/shell/"],

  // The public catalog.
  catalog: ["app/(public)/inmuebles", "features/property/domain/catalog", "features/property/validations/catalog"],
  facets: ["app/(public)/inmuebles", "features/property/domain/catalog"],
  pagination: ["app/(public)/inmuebles", "features/property/domain/catalog"],
  "listing-scroll": ["app/(public)/inmuebles", "shared/shell/"],
  lightbox: ["app/(public)/inmuebles", "features/property/ui/"],

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
  amount: ["shared/format/money", "features/property/validations"],

  // The rental process.
  apply: ["features/application/", "app/(app)/arriendos", "app/(app)/postularme"],
  documents: ["features/tenant-profile/", "features/application/", "app/(app)/arriendos"],
  interview: ["features/application/domain/interview", "features/application/validations/interview", "features/application/ui/"],
  guarantee: ["features/application/domain/guarantee", "features/application/validations/guarantee", "features/application/ui/"],
  withdraw: ["features/application/"],
  reminders: ["app/api/cron/", "features/application/domain/interview", "features/notification/"],
  notifications: ["features/notification/", "shared/lib/site-url"],

  // Layout assertions: alignment, no horizontal scrolling at 390px, the active nav entry.
  "actions-layout": ["features/application/ui/", "app/(app)/arriendos"],
  "application-layout": ["features/profile/", "app/(auth)/", "shared/form/"],
  "birthdate-layout": ["shared/form/", "features/profile/"],
  "rentals-layout": ["app/(app)/arriendos", "shared/shell/"],
};

/** Drivers that need a landlord, a tenant and a property, so they are the slow ones. */
export const SLOW = ["documents", "apply", "interview", "guarantee", "notifications", "reminders", "withdraw"];

export function driversFor(changedPaths) {
  const hit = new Set();
  for (const [driver, prefixes] of Object.entries(COVERS)) {
    if (changedPaths.some((path) => prefixes.some((prefix) => path.startsWith(prefix)))) {
      hit.add(driver);
    }
  }
  return [...hit].sort();
}
