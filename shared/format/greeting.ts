/**
 * Greeting based on the time of day.
 *
 * A pure function: it receives the hour already resolved, it never reads the clock. That
 * way the test can pin it and the greeting does not depend on where the server runs.
 */
/**
 * **Which greeting, not the greeting itself.**
 *
 * It used to return the Spanish sentence. What this function decides is the *time of day* — a fact
 * about the clock, identical in every language — so it returns the key and `/inicio` looks the
 * words up. That keeps the function pure and its test about the boundaries (05:00, 12:00, 19:00)
 * rather than about wording.
 */
export type Greeting = "greetingMorning" | "greetingAfternoon" | "greetingEvening";

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 19) return "greetingAfternoon";
  return "greetingEvening";
}

/** The product's time zone. The greeting is computed in Colombian time, not the server's. */
export const PRODUCT_TIME_ZONE = "America/Bogota";

/** Hour (0–23) in the product's time zone for a given instant. */
export function hourInProductTimeZone(instant: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: PRODUCT_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  }).format(instant);

  return Number.parseInt(formatted, 10) % 24;
}

/** First name, to greet without reciting the full name. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
