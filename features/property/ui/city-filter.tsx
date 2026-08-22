"use client";

import { useRouter } from "next/navigation";

import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";

/** The value that means "no filter". Not the empty string: Radix reserves that. */
const ALL = "all";

/**
 * Filters the catalog by city.
 *
 * It changes the URL rather than holding the choice in state, because the URL is the point: a
 * tenant looking in Manizales sends `/inmuebles?city=Manizales` to whoever is looking with
 * them, and the page they open is the page they were shown.
 *
 * The options are the cities that have something published — offering the whole country would
 * be a list of dead ends.
 */
export function CityFilter({
  cities,
  selected,
}: {
  readonly cities: readonly string[];
  readonly selected: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="city" className="shrink-0 text-sm text-muted-foreground">
        Ciudad
      </Label>
      <Select
        value={selected ?? ALL}
        onValueChange={(value) => {
          router.push(
            value === ALL
              ? PROPERTIES_ROUTE
              : `${PROPERTIES_ROUTE}?city=${encodeURIComponent(value)}`,
          );
        }}
      >
        <SelectTrigger id="city" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las ciudades</SelectItem>
          {cities.map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
