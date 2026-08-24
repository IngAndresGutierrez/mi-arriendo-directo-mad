import { z } from "zod";

import { DEPARTMENTS } from "@/shared/geo/colombia";
import { isMunicipalityOf } from "@/shared/geo/municipalities";
import { isInColombia } from "@/shared/geo/point";
import {
  AREA_MAX,
  AREA_MIN,
  LEASE_TERMS,
  PARKING_KINDS,
  PHOTOS_MAX,
  PHOTOS_MIN,
  PROPERTY_TYPES,
  RENT_MAX,
  RENT_MIN,
  STRATA,
  type LeaseTerm,
  type Stratum,
} from "../domain/property";

/** Hoisted: rebuilding the RegExp on every call is repeated work. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** How far ahead a landlord may schedule availability. Beyond that it is a typo, not a plan. */
export const MAX_MONTHS_AHEAD = 12;

/**
 * Whole pesos. The form sends strings, so the value is coerced — but a float is rejected
 * rather than rounded: money that silently changes is worse than money that fails loudly.
 */
const pesos = (label: string, { min, max }: { min: number; max: number }) =>
  z.coerce
    .number({ error: `Ingresa ${label}` })
    .int({ error: "Sin decimales: el valor va en pesos enteros" })
    .min(min, { error: `${label} debe ser al menos ${min.toLocaleString("es-CO")}` })
    .max(max, { error: `${label} supera el máximo permitido` });

const count = (label: string, { min, max }: { min: number; max: number }) =>
  z.coerce
    .number({ error: `Ingresa ${label}` })
    .int({ error: "Debe ser un número entero" })
    .min(min, { error: `${label} no puede ser menor que ${min}` })
    .max(max, { error: `${label} supera el máximo permitido` });

/**
 * A photo that the browser already uploaded to Cloud Storage.
 *
 * Only the shape is checked here. That the path belongs to **this** landlord is checked in the
 * Server Action, which is the only place that knows the uid — a client that forged a path
 * pointing at someone else's folder would pass this schema and fail there.
 */
const photo = z.object({
  path: z.string().min(1, { error: "La foto no tiene ruta" }),
  url: z.url({ error: "La URL de la foto no es válida" }),
});

/**
 * Colombian address. The street line is stored apart from the public document, and the city is
 * validated **against the department**: a city on its own means nothing, and "Manizales,
 * Antioquia" is exactly what a free-text pair used to let through.
 */
/**
 * Matrícula inmobiliaria: the number the Oficina de Registro de Instrumentos Públicos gives
 * every property in Colombia, usually written `050-123456`.
 *
 * Validated loosely on purpose. The shape is a registry circle and a sequential number, but the
 * circle can be two or three digits, the separator is written as a hyphen, a space or nothing at
 * all, and older records are shorter than newer ones. A stricter pattern would reject real
 * numbers off real certificates, and what it would buy is a false sense of having verified
 * something: the only real check is against the registry, which is not something this product
 * does.
 */
const registryNumber = z
  .string({ error: "Ingresa la matrícula inmobiliaria" })
  .trim()
  .min(6, { error: "La matrícula es demasiado corta" })
  .max(20, { error: "La matrícula es demasiado larga" })
  .regex(/^[0-9][0-9\s-]*[0-9]$/, {
    error: "Solo números, con o sin guion. Por ejemplo: 050-123456",
  });

/**
 * The point the landlord placed on the map, when they placed one.
 *
 * **Optional, and it stays optional.** Requiring it would lock every listing published before
 * the map existed out of its own edit form — the same form publishes and edits — and would also
 * shut out a landlord whose street is simply not drawn yet, which in rural Colombia is common.
 * A listing with no point renders its location as text, exactly as it did before.
 *
 * The bounds check is not a border, it is the guard against the three ways a coordinate arrives
 * wrong: swapped, zeroed, or with the sign dropped. See `COLOMBIA_BOUNDS`.
 */
const mapPoint = z
  .object({
    lat: z.coerce.number({ error: "Ubica el inmueble en el mapa" }),
    lng: z.coerce.number({ error: "Ubica el inmueble en el mapa" }),
  })
  .refine(isInColombia, { error: "El punto del mapa no está en Colombia" });

const address = z.object({
  registryNumber,
  point: mapPoint.optional(),
  line: z
    .string({ error: "Ingresa la dirección" })
    .trim()
    .min(5, { error: "La dirección es demasiado corta" })
    .max(160, { error: "La dirección es demasiado larga" }),
  neighborhood: z
    .string({ error: "Ingresa el barrio" })
    .trim()
    .min(2, { error: "Ingresa el barrio" })
    .max(80, { error: "El barrio es demasiado largo" }),
  city: z.string({ error: "Selecciona la ciudad" }).trim().min(2, { error: "Selecciona la ciudad" }),
  department: z.enum(DEPARTMENTS, { error: "Selecciona un departamento" }),
}).superRefine((value, ctx) => {
  // Cross-field, so it runs at object level: the city is only meaningful next to its department.
  if (!isMunicipalityOf(value.city, value.department)) {
    ctx.addIssue({
      code: "custom",
      message: `${value.city || "Esa ciudad"} no es un municipio de ${value.department}`,
      path: ["city"],
    });
  }
});

/**
 * What a landlord submits to publish a property.
 *
 * Shared between the form (UX) and the Server Action (security): same module, same rule, same
 * message. The action re-runs it — never trust that the browser did.
 */
export const publishPropertySchema = z.object({
  title: z
    .string({ error: "Ingresa un título" })
    .trim()
    .min(10, { error: "El título es demasiado corto" })
    .max(140, { error: "El título es demasiado largo" }),
  description: z
    .string({ error: "Describe el inmueble" })
    .trim()
    .min(40, { error: "Cuéntale al inquilino un poco más: mínimo 40 caracteres" })
    .max(2000, { error: "La descripción es demasiado larga" }),
  type: z.enum(PROPERTY_TYPES, { error: "Selecciona el tipo de inmueble" }),

  rent: pesos("el canon", { min: RENT_MIN, max: RENT_MAX }),
  adminFee: pesos("la administración", { min: 0, max: RENT_MAX }),
  // No deposit: Ley 820 de 2003 forbids it on urban housing leases (see the domain module).

  areaM2: count("el área", { min: AREA_MIN, max: AREA_MAX }),
  bedrooms: count("las habitaciones", { min: 0, max: 20 }),
  bathrooms: count("los baños", { min: 1, max: 20 }),
  parking: z.enum(PARKING_KINDS, { error: "Indica si el inmueble tiene parqueadero" }),
  stratum: z.coerce
    .number({ error: "Selecciona el estrato" })
    .refine((value): value is Stratum => (STRATA as readonly number[]).includes(value), {
      error: "Selecciona un estrato entre 1 y 6",
    }),

  furnished: z.boolean(),
  petsAllowed: z.boolean(),

  minLeaseMonths: z.coerce
    .number({ error: "Selecciona la duración mínima" })
    .refine((value): value is LeaseTerm => (LEASE_TERMS as readonly number[]).includes(value), {
      error: "La duración mínima es de 6 meses o 1 año",
    }),

  /** `YYYY-MM-DD`, as `<input type="date">` delivers it. The clock check is separate. */
  availableFrom: z
    .string({ error: "Elige desde cuándo está disponible" })
    .regex(CALENDAR_DAY, { error: "Elige una fecha válida" }),

  address,

  photos: z
    .array(photo)
    .min(PHOTOS_MIN, { error: "Sube al menos una foto" })
    .max(PHOTOS_MAX, { error: `Máximo ${PHOTOS_MAX} fotos` }),
});

/** What the Server Action validates (after coercion). */
export type PublishPropertyInput = z.output<typeof publishPropertySchema>;

/** What the form handles (before coercion): the numeric fields arrive as strings. */
export type PublishPropertyFormValues = z.input<typeof publishPropertySchema>;

/**
 * Validates the availability date against an explicit reference.
 *
 * Outside the schema because it depends on the clock: that keeps the schema pure and lets the
 * test pin "today". The server re-checks it against its own clock, not the browser's.
 */
export function validateAvailableFrom(
  value: string,
  reference: Date,
): { ok: true; date: Date } | { ok: false; error: string } {
  if (!ISO_DAY.test(value)) {
    return { ok: false, error: "Elige una fecha válida" };
  }
  // Midday UTC: read as midnight it lands on the previous day in Bogotá.
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Elige una fecha válida" };
  }

  /*
   * "Today" is today **in Colombia**, on both sides, and the comparison is between two ISO days
   * rather than two `Date`s. The old version built the date at local midnight and compared it to
   * the server's local midnight, while the form filled the field with `toISOString()` — a UTC
   * day. Whenever those two calendars disagreed, publishing failed with "la fecha no puede estar
   * en el pasado" on a date the form had put there itself and nobody had touched.
   */
  const today = bogotaDay(reference);
  if (value < today) {
    return { ok: false, error: "La fecha no puede estar en el pasado" };
  }

  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + MAX_MONTHS_AHEAD);
  if (value > limit.toISOString().slice(0, 10)) {
    return { ok: false, error: `Como máximo ${MAX_MONTHS_AHEAD} meses hacia adelante` };
  }

  return { ok: true, date };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day in Bogotá for an instant, as `YYYY-MM-DD`. `en-CA` formats exactly that. */
export function bogotaDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(instant);
}
