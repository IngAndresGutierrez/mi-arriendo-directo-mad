import type { Metadata } from "next";
import { HeadsetIcon, MailIcon } from "lucide-react";

import { getProfile, requireCompleteProfile } from "@/features/profile";
import { firstName } from "@/shared/format/greeting";
import {
  SUPPORT_EMAIL,
  supportWhatsAppDisplay,
} from "@/shared/lib/support-contact";
import { EmailSupportButton, WhatsAppSupportButton } from "@/shared/shell/support-actions";
import { WhatsAppIcon } from "@/shared/ui/whatsapp-icon";

export const metadata: Metadata = {
  title: "Soporte",
  description: "Escríbenos por WhatsApp o por correo si tienes dudas sobre tu arriendo.",
};

export default async function SupportPage() {
  const user = await requireCompleteProfile();
  // Free: the guard has already read it and `getProfile` is cached for the request.
  const profile = await getProfile(user.uid);
  const name = profile ? firstName(profile.fullName) : "";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Soporte
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hola{name ? ` ${name}` : ""}, escríbenos por donde te quede mejor. No hay formularios
        ni números de ticket: al otro lado hay una persona.
      </p>

      {/*
        Two channels, two cards of the same weight. Which one is "the" way to write depends on
        what you are about to say — a question you want answered now, or something you need
        written down with a document attached — and that is the person's call, not ours.
      */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <WhatsAppIcon className="size-5" />
          </span>
          <h2 className="mt-3 font-semibold text-foreground">WhatsApp</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Para una duda que quieres resolver ya: cómo va tu postulación, qué documento falta,
            qué significa una etapa.
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">{supportWhatsAppDisplay()}</p>
          {/* `mt-auto`: the two cards' buttons line up even when one paragraph runs longer. */}
          <div className="mt-auto pt-4">
            <WhatsAppSupportButton />
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <MailIcon className="size-5" />
          </span>
          <h2 className="mt-3 font-semibold text-foreground">Correo</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Para lo que necesita quedar por escrito o llevar un archivo adjunto: un reclamo, un
            comprobante, algo que quieras poder releer después.
          </p>
          <p className="mt-3 text-sm font-medium break-all text-foreground">{SUPPORT_EMAIL}</p>
          <div className="mt-auto pt-4">
            <EmailSupportButton />
          </div>
        </section>
      </div>

      {/*
        Not a promise about how fast we answer — we would be inventing one. It is the thing
        that actually makes an answer arrive sooner: the context we would otherwise have to
        ask for in a second message.
      */}
      <section className="mt-4 flex gap-3 rounded-2xl border border-dashed border-border p-5">
        <HeadsetIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-foreground">Qué contarnos</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Cuéntanos qué esperabas y qué pasó en su lugar. Si es sobre un inmueble o sobre un
            proceso concreto, pega el enlace de la página donde estás: con eso lo encontramos
            sin pedirte nada más.
          </p>
        </div>
      </section>
    </div>
  );
}
