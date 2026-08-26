"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { BedDoubleIcon, BuildingIcon, CalendarRangeIcon, SparklesIcon } from "lucide-react";

import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import {
  type BedroomBucket,
  type CatalogFacets,
  type CatalogFeature,
  type CatalogFilters,
} from "../domain/catalog";
import type { LeaseTerm, PropertyType } from "../domain/property";
import type { PropertyLabels } from "../domain/labels";
import { catalogQuery } from "../validations/catalog";

/**
 * The facets, with how many listings each option would give you.
 *
 * Every change rewrites the URL instead of holding state here: the filtered view is the thing
 * people send each other, so it has to be an address. Choosing a filter also resets the page —
 * staying on page 3 of a result set that just shrank to one page is how a filter appears to
 * return nothing.
 */
export function CatalogFilters({
  filters,
  facets,
  labels,
  onNavigate,
}: {
  readonly filters: CatalogFilters;
  readonly facets: CatalogFacets;
  /**
   * The label records, resolved on the server.
   *
   * **Props and not a dictionary import, because this is a Client Component.** Importing
   * `shared/i18n/dictionary` here would pull *both* languages into the browser bundle of the
   * catalogue — the most-fetched page on the site — for the sake of a dozen words. `PropertyLabels`
   * is deliberately all plain records: a function cannot cross the RSC boundary, which is the
   * mistake that once 500'd every page in this product.
   */
  readonly labels: PropertyLabels;
  /** Closes the sheet on a phone, where the filters live behind a button. */
  readonly onNavigate?: () => void;
}) {
  const router = useRouter();
  /*
   * The panel is rendered twice — the column from `lg`, the sheet below it — and the hidden one
   * is still in the DOM. Fixed ids would collide, and `label for=` resolves to the *first*
   * match: every label in the sheet pointed at the invisible checkbox behind it, so tapping a
   * filter on a phone did nothing.
   */
  const uid = useId();

  function go(next: Partial<CatalogFilters>) {
    router.push(`${PROPERTIES_ROUTE}${catalogQuery({ ...filters, ...next, page: 1 })}`);
    onNavigate?.();
  }

  /** Adds or removes one value of a multi-select facet. */
  function toggle<T>(current: readonly T[], value: T): readonly T[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  return (
    <div className="space-y-6">
      <Group icon={<BuildingIcon className="size-4" aria-hidden="true" />} title={labels.ui.filterType}>
        {facets.types.map((option) => (
          <Option
            key={option.value}
            id={`${uid}-type-${option.value}`}
            label={labels.types[option.value]}
            count={option.count}
            checked={filters.types.includes(option.value)}
            onChange={() => go({ types: toggle<PropertyType>(filters.types, option.value) })}
          />
        ))}
      </Group>

      <Group icon={<BedDoubleIcon className="size-4" aria-hidden="true" />} title={labels.ui.filterBedrooms}>
        {facets.bedrooms.map((option) => (
          <Option
            key={option.value}
            id={`${uid}-bedrooms-${option.value}`}
            label={labels.bedrooms[option.value]}
            count={option.count}
            checked={filters.bedrooms.includes(option.value)}
            onChange={() => go({ bedrooms: toggle<BedroomBucket>(filters.bedrooms, option.value) })}
          />
        ))}
      </Group>

      <Group
        icon={<CalendarRangeIcon className="size-4" aria-hidden="true" />}
        title={labels.ui.filterTerm}
      >
        {facets.lease.map((option) => (
          <Option
            key={option.value}
            id={`${uid}-lease-${option.value}`}
            label={labels.lease[option.value]}
            count={option.count}
            checked={filters.lease.includes(option.value)}
            onChange={() => go({ lease: toggle<LeaseTerm>(filters.lease, option.value) })}
          />
        ))}
      </Group>

      {facets.features.length > 0 && (
        <Group icon={<SparklesIcon className="size-4" aria-hidden="true" />} title={labels.ui.filterFeatures}>
          {facets.features.map((option) => (
            <Option
              key={option.value}
              id={`${uid}-features-${option.value}`}
              label={labels.features[option.value]}
              count={option.count}
              checked={filters.features.includes(option.value)}
              onChange={() => go({ features: toggle<CatalogFeature>(filters.features, option.value) })}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  children,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-border pb-6 last:border-0 last:pb-0">
      <h2 className="flex items-center gap-2 font-semibold text-primary dark:text-foreground">
        {icon}
        {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Option({
  id,
  label,
  count,
  checked,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly checked: boolean;
  readonly onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="flex-1 cursor-pointer font-normal text-foreground">
        {label}
      </Label>
      {/*
        The count is `aria-hidden` and spelled out for a screen reader: "17" read after a label
        is a riddle, "17 inmuebles" is not.
      */}
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        {count}
      </span>
      <span className="sr-only">{count === 1 ? "1 inmueble" : `${count} inmuebles`}</span>
    </div>
  );
}
