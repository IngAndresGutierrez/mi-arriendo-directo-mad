/**
 * Saludo según la hora del día.
 *
 * Función pura: recibe la hora ya resuelta, no consulta el reloj. Así el test puede fijarla
 * y el saludo no depende de dónde corra el servidor.
 */
export type Greeting = "Buenos días" | "Buenas tardes" | "Buenas noches";

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Zona horaria del producto. El saludo se calcula en hora de Colombia, no del servidor. */
export const PRODUCT_TIME_ZONE = "America/Bogota";

/** Hora (0–23) en la zona del producto para un instante dado. */
export function hourInProductTimeZone(instant: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: PRODUCT_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  }).format(instant);

  return Number.parseInt(formatted, 10) % 24;
}

/** Primer nombre, para saludar sin recitar el nombre completo. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
