import { HeadsetIcon, MessageCircleIcon } from "lucide-react";

import { ComingSoonCard } from "@/shared/ui/coming-soon-card";

/**
 * Support card, mocked up.
 *
 * Deliberately **without a photo of a person**: presenting a stock image as "our team"
 * would invent someone who does not exist. A neutral avatar says the same thing without
 * claiming something false. Once there is a real support channel, this becomes interactive.
 */
export function SupportCard({ firstName }: { firstName: string }) {
  return (
    <ComingSoonCard label="El chat de soporte llegará pronto">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <HeadsetIcon className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Equipo de soporte</p>
          <p className="text-sm text-muted-foreground">miarriendoDIRECTO</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Hola{firstName ? ` ${firstName}` : ""}, aquí vas a poder escribirnos si tienes dudas
        sobre tu arriendo, tu contrato o tus pagos.
      </p>

      <span className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground">
        <MessageCircleIcon className="size-4" />
        Obtener soporte
      </span>
    </ComingSoonCard>
  );
}
