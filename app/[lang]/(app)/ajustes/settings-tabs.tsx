"use client";

import { useState, type ReactNode } from "react";
import { BellIcon, ShieldIcon, UserIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

type TabValue = "perfil" | "avisos" | "seguridad";

/**
 * Los tres asuntos de una pantalla de ajustes: quién eres, de qué te avisamos y cómo entras.
 *
 * **Abre en Perfil** porque es lo que alguien viene a corregir con más frecuencia —un teléfono
 * nuevo, una tilde en el apellido— y porque es lo que la otra parte del proceso ve de ti. Las otras
 * dos se visitan cuando algo molesta: demasiados correos, o la sospecha de que alguien entró.
 *
 * El valor de la pestaña **no se escribe en la URL**, igual que en el arriendo: la única razón por
 * la que aquello es un Client Component es que había enlaces de correo apuntando a un ancla dentro
 * de un panel desmontado, y aquí no hay ninguno. Un `?tab=` que cada clic reescribiera sería una
 * segunda fuente de verdad puesta por si acaso.
 *
 * Los paneles llegan como JSX ya creado y no como componentes: un elemento cruza la frontera RSC y
 * una función no.
 */
export function SettingsTabs({
  profile,
  notifications,
  security,
}: {
  readonly profile: ReactNode;
  readonly notifications: ReactNode;
  readonly security: ReactNode;
}) {
  const [value, setValue] = useState<TabValue>("perfil");

  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as TabValue)}>
      <TabsList aria-label="Secciones de ajustes">
        <TabsTrigger value="perfil">
          <UserIcon className="size-4" aria-hidden="true" />
          Perfil
        </TabsTrigger>
        <TabsTrigger value="avisos">
          <BellIcon className="size-4" aria-hidden="true" />
          Notificaciones
        </TabsTrigger>
        <TabsTrigger value="seguridad">
          <ShieldIcon className="size-4" aria-hidden="true" />
          Seguridad
        </TabsTrigger>
      </TabsList>

      <TabsContent value="perfil">{profile}</TabsContent>
      <TabsContent value="avisos">{notifications}</TabsContent>
      <TabsContent value="seguridad">{security}</TabsContent>
    </Tabs>
  );
}
