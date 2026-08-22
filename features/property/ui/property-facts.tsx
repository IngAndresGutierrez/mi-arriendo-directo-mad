import {
  BathIcon,
  BedDoubleIcon,
  CarIcon,
  LayersIcon,
  PawPrintIcon,
  RulerIcon,
  SofaIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PROPERTY_TYPE_LABELS, type Property } from "../domain/property";

type Fact = { readonly icon: LucideIcon; readonly label: string };

/**
 * The facts a tenant scans before reading a single line of the description: size, rooms and
 * the two rules that disqualify a listing outright — furnished or not, pets or not.
 *
 * Zero values are not hidden. "0 parqueaderos" is information; a missing row reads as an
 * oversight and sends the tenant to the chat to ask.
 */
function factsOf(property: Property): readonly Fact[] {
  return [
    { icon: RulerIcon, label: `${property.areaM2} m²` },
    {
      icon: BedDoubleIcon,
      label: property.bedrooms === 1 ? "1 habitación" : `${property.bedrooms} habitaciones`,
    },
    { icon: BathIcon, label: property.bathrooms === 1 ? "1 baño" : `${property.bathrooms} baños` },
    {
      icon: CarIcon,
      label:
        property.parkingSpots === 1 ? "1 parqueadero" : `${property.parkingSpots} parqueaderos`,
    },
    { icon: LayersIcon, label: `Estrato ${property.stratum}` },
    { icon: SofaIcon, label: property.furnished ? "Amoblado" : "Sin amoblar" },
    { icon: PawPrintIcon, label: property.petsAllowed ? "Acepta mascotas" : "Sin mascotas" },
  ];
}

export function PropertyFacts({ property }: { readonly property: Property }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <li className="col-span-2 font-medium text-foreground sm:col-span-3">
        {PROPERTY_TYPE_LABELS[property.type]}
      </li>
      {factsOf(property).map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4 shrink-0 text-primary dark:text-accent" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
