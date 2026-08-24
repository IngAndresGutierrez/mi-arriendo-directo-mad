import type { ReactNode } from "react";

import { controllerIdentityLines } from "@/shared/legal/controller";
import { formatEffectiveDate } from "@/shared/legal/documents";

/**
 * The frame the three legal documents render inside.
 *
 * There is no typography plugin in this project, so prose has to be styled deliberately rather
 * than inherited — which is the reason this exists as a component instead of each page bringing
 * its own headings. Three pages of hand-styled `<h2>`s is three chances for one of them to drift,
 * and a legal document that looks different from the other two reads as the one that was
 * copy-pasted from somewhere else.
 *
 * It also carries the two things every one of them must state and none of them should have to
 * remember: **who the Responsable is** (Ley 1581 art. 13 and 15; Ley 1480 art. 50 for the
 * e-commerce half) and **which version this is**, with its date. A policy with no version is a
 * policy nobody can prove somebody agreed to.
 *
 * `max-w-3xl` rather than the full width: these are pages somebody reads top to bottom, and a
 * 1200px measure is a measure nobody finishes.
 */
export function LegalDocument({
  title,
  intro,
  version,
  effectiveDate,
  children,
}: {
  readonly title: string;
  /** One sentence saying what this document is, before the clauses start. */
  readonly intro: string;
  readonly version: number;
  /** `YYYY-MM-DD`. */
  readonly effectiveDate: string;
  readonly children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Versión {version} · Vigente desde el {formatEffectiveDate(effectiveDate)}
        </p>
      </header>

      {/*
        The identity, before the clauses. It is the first thing somebody checking whether a policy
        is real looks for, and `controllerIdentityLines()` is what keeps the absent NIT from
        rendering as a dangling label.
      */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Responsable</h2>
        <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          {controllerIdentityLines().map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-8">{children}</div>
    </article>
  );
}

/**
 * One numbered clause, with an id.
 *
 * The id is not decoration: `/privacidad#derechos` is linked from the aviso de privacidad and from
 * `PRIVACY_RIGHTS_ANCHOR`, and `scroll-mt` is what stops the heading landing under the header of
 * whichever chrome the page is wearing.
 */
export function LegalSection({
  id,
  heading,
  children,
}: {
  readonly id: string;
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * A list inside a clause.
 *
 * `role="list"` is stated explicitly because `list-none` removes the list semantics in Safari with
 * VoiceOver — a documented WebKit behaviour, and these are the lists that carry somebody's rights.
 */
export function LegalList({ children }: { readonly children: ReactNode }) {
  return (
    <ul role="list" className="ml-4 list-disc space-y-1.5">
      {children}
    </ul>
  );
}
