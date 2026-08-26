import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ArrowRightIcon, CalendarIcon, InfoIcon } from "lucide-react";

import { applicationRoute, applyToPropertyRoute, LOGIN_ROUTE } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";

import { propertyMonthlyCost, type Property } from "../domain/property";
import { currentLocale, dictionary } from "@/shared/i18n/server";
import { LOCALE_HTML_LANG } from "@/shared/i18n";

import { propertyLabels } from "../domain/labels";

/**
 * `2026-12-07` → `7 de diciembre de 2026`, or `December 7, 2026`, in Colombian time.
 *
 * The **locale** decides the wording and the order; the **time zone** stays `America/Bogota` either
 * way, because when a flat becomes available is a fact about Colombia and not about the reader.
 * Noon rather than midnight for the same reason it always was: a bare `YYYY-MM-DD` parses as UTC
 * midnight, which in Bogotá is the previous evening.
 */
function formatDay(day: string, locale: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

/**
 * What the tenant actually pays, and what they commit to.
 *
 * The headline is rent + admin fee together, because that is the number that leaves their
 * account every month; the breakdown right below keeps it honest. There is no deposit row:
 * Ley 820 de 2003 forbids cash deposits on urban housing leases, so the product does not have
 * the field to show.
 *
 * What the application button says depends on where the reader stands: a visitor is sent to
 * sign in and comes back here, the owner is told it is theirs, and someone already in a process
 * is sent to the process instead of being offered a second one.
 */
export async function PropertyPriceCard({
  property,
  applyState,
  applicationId,
}: {
  readonly property: Property;
  /**
   * `anonymous` — no session yet. `own` — the reader published it. `open` — they already have a
   * live application. `rejected` — the landlord already said no. `can_apply` — everyone else,
   * which includes someone who withdrew and changed their mind.
   */
  readonly applyState: "anonymous" | "own" | "open" | "rejected" | "can_apply";
  /** When `applyState` is `open` or `rejected`: the process this reader already has. */
  readonly applicationId?: string;
}) {
  const [locale, copy] = await Promise.all([currentLocale(), dictionary()]);
  const t = copy.property;
  const labels = propertyLabels(locale);
  const monthly = propertyMonthlyCost(property);

  return (
    <aside className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">{t.monthlyRent}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {formatCOP(monthly)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {property.adminFee > 0
          ? t.rentPlusAdminShort(formatCOP(property.rent), formatCOP(property.adminFee))
          : t.noAdminFee}
      </p>

      <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">{t.minimumTermLabel}</dt>
          <dd className="text-right font-medium text-foreground">
            {labels.lease[property.minLeaseMonths]}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="size-4" aria-hidden="true" />
            {t.availableFrom}
          </dt>
          <dd className="text-right font-medium text-foreground">
            {formatDay(property.availableFrom, LOCALE_HTML_LANG[locale])}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-2">
        {applyState === "own" ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t.ownListing}
          </p>
        ) : applyState === "open" && applicationId ? (
          <Button asChild variant="accent" size="xl" className="w-full">
            <Link href={applicationRoute(applicationId)}>
              {t.seeMyProcess}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : applyState === "rejected" ? (
          /*
            No button. The landlord already looked at this person and said no; offering the form
            again offers the same answer with extra steps. The link stays, because what happened
            and why is still theirs to read.
          */
          <>
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t.applicationRejected}
            </p>
            {applicationId ? (
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href={applicationRoute(applicationId)}>
                  {t.seeMyApplication}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button asChild variant="accent" size="xl" className="w-full">
              <Link
                href={
                  applyState === "anonymous"
                    ? `${LOGIN_ROUTE}?next=${encodeURIComponent(applyToPropertyRoute(property.slug))}`
                    : applyToPropertyRoute(property.slug)
                }
              >
                {t.apply}
              </Link>
            </Button>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {applyState === "anonymous"
                ? t.needAccount
                : t.applyingCommitsNothing}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
