import { FileSignatureIcon, HandshakeIcon, ShieldCheckIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Dictionary } from "@/shared/i18n";

/**
 * What makes this product what it is — Codomo's "Lo que hace que Codomo sea Codomo", answered for
 * a marketplace instead of a housing operator.
 *
 * **Every claim here is something the product actually does**, and that constraint threw out the
 * three most tempting cards. There is no "ahorra hasta un 30%" (this product does not know what an
 * agency would have charged), no "encuentra inmueble en 48 horas" (the process moves when two
 * people move it) and no rating or review count (nothing collects them, and marking up an
 * `aggregateRating` that does not exist is the one structured-data mistake that earns a manual
 * action — the same rule the listing's JSON-LD already follows).
 */
export function WhyDirect({ copy }: { readonly copy: Dictionary["landing"]["why"] }) {
  return (
    <section className="bg-muted/50 py-16 sm:py-20 dark:bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
          {copy.title}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{copy.body}</p>

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          <Card
            icon={HandshakeIcon}
            title={copy.noFeesTitle}
            body={copy.noFeesBody}
          />
          <Card
            icon={ShieldCheckIcon}
            title={copy.verifiedTitle}
            body={copy.verifiedBody}
          />
          <Card
            icon={FileSignatureIcon}
            title={copy.contractTitle}
            body={copy.contractBody}
          />
        </ul>
      </div>
    </section>
  );
}

/**
 * The icon is created here rather than handed down as a prop from somewhere else: a lucide icon is
 * a function, and a function does not cross the RSC boundary. Everything in this file is a Server
 * Component, so passing the component itself is fine — the moment one of these needs to be
 * `"use client"`, this becomes the already-created JSX instead.
 */
function Card({
  icon: Icon,
  title,
  body,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}) {
  return (
    <li className="rounded-2xl border border-border bg-card p-6">
      <span className="flex size-11 items-center justify-center rounded-xl bg-brand-panel text-brand-panel-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-balance text-primary dark:text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
