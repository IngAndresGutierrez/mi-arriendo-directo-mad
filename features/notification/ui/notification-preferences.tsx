"use client";

import { useState, useTransition } from "react";
import {
  BanknoteIcon,
  BellRingIcon,
  CheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  type LucideIcon,
} from "lucide-react";

import { FormAlert } from "@/shared/form/form-alert";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";

import { saveNotificationPreferences } from "../actions/save-preferences";
import {
  CATEGORY_COPY,
  CHANNEL_LABELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  channelApplies,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
} from "../domain/preferences";

const CATEGORY_ICONS: Readonly<Record<NotificationCategory, LucideIcon>> = {
  process: FileTextIcon,
  lease: BanknoteIcon,
  reminders: BellRingIcon,
  errands: ClipboardListIcon,
};

/** Todo encendido o todo apagado, respetando los canales que cada categoría sí usa. */
function everything(on: boolean): NotificationPreferences {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      Object.fromEntries(NOTIFICATION_CHANNELS.map((channel) => [channel, on])),
    ]),
  ) as NotificationPreferences;
}

function withChannel(
  preferences: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
  value: boolean,
): NotificationPreferences {
  return {
    ...preferences,
    [category]: { ...preferences[category], [channel]: value },
  };
}

/**
 * Qué avisos quiere recibir alguien, y por dónde.
 *
 * **La campana no está en la tabla, y eso es lo primero que dice la pantalla.** Lo que este producto
 * escribe en `notifications/{id}` es el registro dentro de la app: es lo que lee la pantalla del
 * proceso y lo que despierta la vista de la otra parte. Un interruptor que pudiera apagarla no
 * silenciaría un aviso, borraría un hecho — así que lo que se decide aquí son los canales que
 * *salen*: el correo y el WhatsApp. Decirlo arriba, en una frase, es lo que evita que alguien busque
 * ese interruptor durante un minuto antes de concluir que la pantalla está incompleta.
 *
 * **Guarda solo, sin botón.** Un interruptor con un "Guardar" al lado es un interruptor que la mitad
 * de la gente deja sin guardar: ya se movió, ya se ve movido, y nada en la pantalla sugiere que
 * falte un paso. Es la misma decisión que la nota de la póliza. Lo que sí hace falta cuando no hay
 * botón es **decir que se guardó**, y de ahí el `role="status"` de la cabecera.
 *
 * Se manda la tabla entera en cada cambio, no el interruptor que se movió: ver el esquema. Dos
 * cambios seguidos leen el estado local, que ya incluye el primero, así que la última escritura es
 * un estado completo y coherente en vez de la suma de parches en un orden que nadie eligió.
 */
export function NotificationPreferencesCard({
  preferences: initial,
}: {
  readonly preferences: NotificationPreferences;
}) {
  const [preferences, setPreferences] = useState(initial);
  /** Lo último que el servidor confirmó, para poder volver si una escritura falla. */
  const [confirmed, setConfirmed] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSaving] = useTransition();

  function apply(next: NotificationPreferences) {
    // Optimista: el interruptor se mueve al instante y se corrige si el servidor dice que no.
    setPreferences(next);
    setError(null);
    setSaved(false);

    startSaving(async () => {
      const result = await saveNotificationPreferences(next);

      if (!result.ok) {
        setPreferences(confirmed);
        setError(result.message);
        return;
      }

      setConfirmed(next);
      setSaved(true);
    });
  }

  return (
    <section
      aria-labelledby="preferencias-avisos"
      data-slot="notification-preferences"
      className="rounded-xl border border-border bg-card"
    >
      <header className="space-y-4 border-b border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="preferencias-avisos"
              className="text-lg font-semibold tracking-tight text-primary dark:text-foreground"
            >
              Preferencias de avisos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige por dónde quieres enterarte de cada cosa.
            </p>
          </div>

          {/*
            Sin botón de guardar, esto es lo único que confirma que el cambio quedó. `status` y no
            `alert`: es una noticia, no una interrupción.
          */}
          <p role="status" className="text-sm text-muted-foreground">
            {isSaving ? (
              "Guardando…"
            ) : saved ? (
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-4 text-brand-panel" aria-hidden="true" />
                Guardado
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => apply(everything(true))}>
            Activar todo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => apply(everything(false))}>
            Desactivar todo
          </Button>
        </div>

        {/*
          La regla que la tabla no puede expresar, dicha antes de la tabla. En morado de marca y no
          en rojo: no es un error, es cómo funciona el producto.
        */}
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          <strong className="font-medium">La campana del portal no se apaga.</strong> Es el registro
          de tu proceso dentro de la app — lo que ves al entrar y lo que lee la otra parte —, así que
          aquí decides los correos y los WhatsApp, no lo que queda escrito.
        </p>

        {error ? <FormAlert>{error}</FormAlert> : null}
      </header>

      {/* Cabecera de columnas: solo desde `sm`, donde hay sitio para una rejilla. */}
      <div className="hidden items-center gap-4 border-b border-border px-6 py-2 sm:grid sm:grid-cols-[1fr_5rem_5rem]">
        <span className="sr-only">Tipo de aviso</span>
        {NOTIFICATION_CHANNELS.map((channel) => (
          <span
            key={channel}
            aria-hidden="true"
            className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {CHANNEL_LABELS[channel]}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-border">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];

          return (
            <li
              key={category}
              data-slot="preference-row"
              data-category={category}
              className="gap-4 p-6 sm:grid sm:grid-cols-[1fr_5rem_5rem] sm:items-center"
            >
              <div className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-brand-panel"
                >
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <p className="font-medium text-foreground">{CATEGORY_COPY[category].label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {CATEGORY_COPY[category].covers}
                  </p>
                </div>
              </div>

              {NOTIFICATION_CHANNELS.map((channel) => {
                const applies = channelApplies(category, channel);

                return (
                  <div
                    key={channel}
                    className={cn(
                      "mt-4 flex items-center justify-between gap-3 sm:mt-0 sm:justify-center",
                      !applies && "sm:justify-center",
                    )}
                  >
                    {/* El nombre del canal solo bajo `sm`: arriba lo dice la cabecera. */}
                    <span aria-hidden="true" className="text-sm text-muted-foreground sm:hidden">
                      {CHANNEL_LABELS[channel]}
                    </span>

                    {applies ? (
                      <Switch
                        checked={preferences[category][channel]}
                        onCheckedChange={(value) =>
                          apply(withChannel(preferences, category, channel, value))
                        }
                        data-channel={channel}
                        /*
                         * Un `Switch` de Radix es un `<button role="switch">`, así que un
                         * `<label for>` no lo nombra. El nombre se compone de **las mismas dos
                         * constantes** que se ven en pantalla, que es lo que lo distingue de un
                         * `aria-label` escrito a mano: no puede separarse de las palabras visibles
                         * porque son literalmente las mismas.
                         */
                        aria-label={`${CHANNEL_LABELS[channel]}: ${CATEGORY_COPY[category].label}`}
                      />
                    ) : (
                      /*
                       * No un interruptor apagado: este canal no manda esta categoría, y un control
                       * que no hace nada es peor que uno ausente. La misma regla por la que el
                       * WhatsApp de la firma no aparece hasta que hay plantilla aprobada.
                       */
                      <span className="text-sm text-muted-foreground">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">
                          {CATEGORY_COPY[category].label}: estos avisos no salen por{" "}
                          {CHANNEL_LABELS[channel]}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
