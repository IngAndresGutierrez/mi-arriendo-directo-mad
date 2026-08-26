import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ArrowRightIcon } from "lucide-react";

import { PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE, SUPPORT_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";
import type { Dictionary } from "@/shared/i18n";

/**
 * The way out of the page, for whoever got this far.
 *
 * By this point the visitor has read what the product is, so this is the one place where asking
 * them to declare a side is fair — the hero deliberately did not. The search stays the `accent`
 * action, which is the same call to action as the hero's button rather than a second one competing
 * with it: the process page's two advance buttons established that a repeated identical action is
 * not two CTAs.
 *
 * "Habla con una persona" is here because the alternative to a landing that answers everything is a
 * landing that admits it does not. `/soporte` is reachable without a session on purpose.
 */
export function ClosingCta({ copy }: { readonly copy: Dictionary["landing"]["closing"] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20">
      <div className="rounded-3xl bg-brand-panel px-6 py-12 text-brand-panel-foreground sm:px-12 sm:py-16">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {copy.title}
        </h2>
        <p className="mt-4 max-w-2xl text-brand-panel-muted">
          {copy.body}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild variant="accent" size="xl" className="w-full sm:w-auto">
            <Link href={PROPERTIES_ROUTE}>
              {copy.search}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          {/*
            `outline` and not `brand` on this panel: `brand` paints a purple border and a purple
            label, which on the purple panel itself is a button you can barely see — the same trap
            the collapsed sidebar's logo hit at contrast 1.05.

            **And `text-foreground` is not optional here.** `outline` sets a background
            (`bg-background`, the light sand) but no colour, so the label inherits from whatever it
            sits in — which on this panel is `text-brand-panel-foreground`, a near-white. That is
            white-on-white: the button rendered as an empty pill, reported from the screen rather
            than caught by the compiler, because a colour inherited from an ancestor is exactly the
            thing no type checker and no lint rule can see. Any `outline` button placed on a brand
            surface needs this.
          */}
          <Button
            asChild
            variant="outline"
            size="xl"
            className="w-full text-foreground sm:w-auto"
          >
            <Link href={PUBLISH_PROPERTY_ROUTE}>{copy.publish}</Link>
          </Button>

          <Link
            href={SUPPORT_ROUTE}
            className="mt-1 text-sm font-medium text-brand-panel-muted underline underline-offset-4 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:mt-0 sm:ml-3"
          >
            {copy.talkToSomeone}
          </Link>
        </div>
      </div>
    </section>
  );
}
