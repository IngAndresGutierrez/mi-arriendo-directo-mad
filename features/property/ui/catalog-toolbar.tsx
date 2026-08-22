"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDownIcon, MapPinIcon, SlidersHorizontalIcon } from "lucide-react";

import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

import {
  CATALOG_SORTS,
  CATALOG_SORT_LABELS,
  hasActiveFilters,
  type CatalogFacets,
  type CatalogFilters,
  type CatalogSort,
} from "../domain/catalog";
import { catalogQuery } from "../validations/catalog";
import { CatalogFilters as FilterPanel } from "./catalog-filters";

/** Radix reserves the empty string, so "no city" needs a value of its own. */
const ANY_CITY = "all";

/**
 * The bar above the results: where, in what order, and — on a phone — the filters.
 *
 * City sits here rather than in the facet list because it is the first thing anyone picks and
 * the one filter that belongs in a shared link on its own.
 */
export function CatalogToolbar({
  filters,
  facets,
  total,
}: {
  readonly filters: CatalogFilters;
  readonly facets: CatalogFacets;
  readonly total: number;
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function go(next: Partial<CatalogFilters>) {
    router.push(`${PROPERTIES_ROUTE}${catalogQuery({ ...filters, ...next, page: 1 })}`);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-4">
        {/*
          Its own row on a phone: sharing one with the sort and the filters button squeezed it
          down to "Tod…", which is not a city anyone can choose.
        */}
        <div className="w-full space-y-1.5 sm:min-w-0 sm:flex-1">
          <Label htmlFor="city" className="flex items-center gap-1.5 text-muted-foreground">
            <MapPinIcon className="size-4" aria-hidden="true" />
            Ciudad
          </Label>
          <Select
            value={filters.city ?? ANY_CITY}
            onValueChange={(value) => go({ city: value === ANY_CITY ? null : value })}
          >
            <SelectTrigger id="city" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_CITY}>Todas las ciudades</SelectItem>
              {facets.cities.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 sm:flex-none">
          <Label htmlFor="sort" className="flex items-center gap-1.5 text-muted-foreground">
            <ArrowUpDownIcon className="size-4" aria-hidden="true" />
            Ordenar
          </Label>
          <Select value={filters.sort} onValueChange={(value) => go({ sort: value as CatalogSort })}>
            <SelectTrigger id="sort" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATALOG_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {CATALOG_SORT_LABELS[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* The facets have a column of their own from `lg`; below that they live in here. */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="lg" className="lg:hidden">
              <SlidersHorizontalIcon aria-hidden="true" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" overlayClassName="bg-foreground/50" className="w-80 gap-0 overflow-y-auto p-5">
            <SheetTitle className="mb-5 text-lg">Filtros</SheetTitle>
            <FilterPanel
              filters={filters}
              facets={facets}
              onNavigate={() => setFiltersOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total === 0
            ? "Ningún inmueble coincide"
            : `${total} ${total === 1 ? "inmueble encontrado" : "inmuebles encontrados"}`}
        </p>

        {hasActiveFilters(filters) && (
          <Button asChild variant="ghost" size="sm">
            {/* A plain link, so it also works as "start over" with JavaScript still loading. */}
            <a href={PROPERTIES_ROUTE}>Quitar filtros</a>
          </Button>
        )}
      </div>
    </div>
  );
}
