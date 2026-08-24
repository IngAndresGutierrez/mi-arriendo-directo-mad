import type { ReactNode } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type CityCount } from "@/features/property";
import { Button } from "@/shared/ui/button";

/**
 * The first screen: what this is, and the one thing most people came to do.
 *
 * Codomo leads with a photograph and a booking widget. The photograph is the half that does not
 * transfer — this product owns no housing and no photography, and a stock apartment presented as
 * ours would be claiming something false, the same call already made about the support card and
 * its absent "our team" photo. What does transfer is the shape: a plain statement of the model,
 * and a search that starts the journey right there instead of one page later.
 *
 * The panel is `brand-panel` and never `bg-primary`: in dark mode `--primary` *is* the cyan, and
 * this is a full-bleed surface.
 */
export function Hero({ searchCard }: { readonly searchCard: ReactNode }) {
  return (
    <section className="bg-brand-panel text-brand-panel-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Arriendo directo en Colombia
        </p>

        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Arrienda directo. <span className="text-accent">Sin intermediarios.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-brand-panel-muted">
          Habla directamente con el propietario, sin comisión de inmobiliaria y sin fiador. Perfiles
          verificados, contrato firmado en línea y cada pago con su soporte, todo en un mismo lugar.
        </p>

        {/*
          Handed in as already-created JSX rather than awaited here, so the headline above never
          waits on Firestore. It is the largest text on the site's most-fetched page — its paint is
          the LCP — and the city list is a nicety on a form that works without it. The page wraps
          the filled-in card in a `<Suspense>` whose fallback is *this same form with no cities*,
          so what streams in is extra options, never the control itself: no layout shift, and a
          search submitted in that window is a search of every city, which is a real answer.
        */}
        {searchCard}

        {/*
          The landlord's way in sits under the search rather than beside it. Two buttons of equal
          weight would ask a visitor to declare which side of the market they are on before the page
          has told them what the market is, and most people arriving here are looking for a home.
        */}
        <p className="mt-6 text-sm text-brand-panel-muted">
          ¿Tienes un inmueble para arrendar?{" "}
          <Link
            href={PUBLISH_PROPERTY_ROUTE}
            className="font-medium text-brand-panel-foreground underline underline-offset-4 hover:text-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Publícalo gratis
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/**
 * Ciudad, tipo y buscar — and it is a plain `GET` form, which is the whole design.
 *
 * **`method="get"` here is not a violation of the product's "every form carries `method="post"`"
 * rule, it is the other half of it.** That rule exists because a form with no method is submitted
 * as a `GET` before hydration, and a login form doing that puts the password in the URL, the
 * browser history and the server logs. Nothing on this form is personal data: it is a search, and
 * the catalogue's entire state already lives in the URL by design — `parseCatalogFilters` and
 * `catalogQuery` are inverses of each other precisely so a search can be linked and shared.
 *
 * So a native `GET` to `/inmuebles` produces exactly the URL the catalogue expects, with **no
 * JavaScript at all**: this is the first interactive thing on the site's most-visited page, and it
 * works in the window before hydration rather than looking ready and swallowing the first click.
 * That is also why these are native `<select>`s and not the Radix `SelectField` used in the
 * product's forms — a Radix select is a button that submits nothing, so it would have forced a
 * Client Component and a JavaScript-only search onto the one page that must not need it.
 *
 * **Only cities with listings are offered**, the same rule the sitemap follows: "Arriendos en
 * Pereira" with nothing in Pereira is a promise of an empty page.
 */
export function SearchCard({ cities }: { readonly cities: readonly CityCount[] }) {
  return (
    <form
      method="get"
      action={PROPERTIES_ROUTE}
      className="mt-10 grid gap-3 rounded-2xl border border-white/10 bg-card p-4 shadow-lg sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-4 sm:p-5"
    >
      <Field label="Ciudad" htmlFor="landing-city">
        <select id="landing-city" name="city" className={FIELD_CLASS} defaultValue="">
          <option value="">Todas las ciudades</option>
          {cities.map((entry) => (
            <option key={entry.city} value={entry.city}>
              {entry.city}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tipo de inmueble" htmlFor="landing-type">
        <select id="landing-type" name="type" className={FIELD_CLASS} defaultValue="">
          <option value="">Cualquier tipo</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROPERTY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      {/* The one `accent` on the page. It is repeated at the foot, which is the same action within
          reach twice — the rule the process page's two advance buttons already established. */}
      <Button type="submit" variant="accent" size="xl" className="w-full sm:w-auto">
        <SearchIcon className="size-4" aria-hidden="true" />
        Buscar
      </Button>
    </form>
  );
}

/** `h-11` matches the `xl` button beside it, which is what keeps the row from stepping. */
const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground " +
  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** A real `<label for>`, because a `<select>` with only a placeholder option is an unnamed control. */
function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
