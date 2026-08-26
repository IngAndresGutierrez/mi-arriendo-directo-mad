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

import { type Property } from "../domain/property";
import { currentLocale, dictionary } from "@/shared/i18n/server";

import { propertyLabels, type PropertyLabels } from "../domain/labels";
import type { Dictionary } from "@/shared/i18n";

type Fact = { readonly icon: LucideIcon; readonly label: string };

/**
 * The facts a tenant scans before reading a single line of the description: size, rooms and
 * the two rules that disqualify a listing outright — furnished or not, pets or not.
 *
 * Nothing is hidden when the answer is "no": "Sin mascotas" and "No tiene parqueadero" are
 * information. A missing row reads as an oversight and sends the tenant to ask.
 */
function factsOf(
  property: Property,
  t: Dictionary["property"],
  labels: PropertyLabels,
): readonly Fact[] {
  return [
    /* `m²` is a symbol and reads the same in both languages. */
    { icon: RulerIcon, label: `${property.areaM2} m²` },
    { icon: BedDoubleIcon, label: t.bedroomsFact(property.bedrooms) },
    { icon: BathIcon, label: t.bathroomsFact(property.bathrooms) },
    { icon: CarIcon, label: labels.parking[property.parking] },
    { icon: LayersIcon, label: t.stratum(property.stratum) },
    { icon: SofaIcon, label: property.furnished ? t.furnished : t.notFurnished },
    { icon: PawPrintIcon, label: property.petsAllowed ? t.petsAllowed : t.noPets },
  ];
}

export async function PropertyFacts({ property }: { readonly property: Property }) {
  const [locale, copy] = await Promise.all([currentLocale(), dictionary()]);
  const t = copy.property;
  const labels = propertyLabels(locale);

  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <li className="col-span-2 font-medium text-foreground sm:col-span-3">
        {labels.types[property.type]}
      </li>
      {factsOf(property, t, labels).map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4 shrink-0 text-primary dark:text-accent" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
