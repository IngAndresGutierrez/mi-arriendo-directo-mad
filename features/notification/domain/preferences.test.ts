import { describe, expect, it } from "vitest";

import { NOTIFICATION_TYPES } from "./notification";
import {
  CATEGORY_CHANNELS,
  CATEGORY_COPY,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  allowsChannel,
  categoryOf,
  channelApplies,
  normalizePreferences,
  typesIn,
} from "./preferences";

describe("categoryOf", () => {
  it("gives every notification type a category", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_CATEGORIES).toContain(categoryOf(type));
    }
  });

  it("keeps the two interview reminders out of the process category", () => {
    // Son la razón de que `reminders` exista: quien apaga los correos de su proceso porque ya está
    // encima de él sigue queriendo el aviso de que la llamada empieza en diez minutos.
    expect(categoryOf("interview_reminder_day")).toBe("reminders");
    expect(categoryOf("interview_reminder_soon")).toBe("reminders");
    expect(categoryOf("interview_confirmed")).toBe("process");
  });

  it("puts the tenancy on its own, apart from the process that produced it", () => {
    expect(categoryOf("canon_paid")).toBe("lease");
    expect(categoryOf("incident_reported")).toBe("lease");
    // El primer canon todavía es la última etapa del proceso, no un mes del arriendo.
    expect(categoryOf("receipt_uploaded")).toBe("process");
  });

  it("leaves no category empty", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(typesIn(category).length).toBeGreaterThan(0);
    }
  });
});

describe("channelApplies", () => {
  it("offers WhatsApp only where notify() actually sends it", () => {
    // Pasarle un teléfono a `notify()` es lo que dice "esta también sale por WhatsApp", y hoy el
    // único que lo pasa es el barrido de recordatorios.
    expect(channelApplies("reminders", "whatsapp")).toBe(true);
    expect(channelApplies("process", "whatsapp")).toBe(false);
    expect(channelApplies("lease", "whatsapp")).toBe(false);
    expect(channelApplies("errands", "whatsapp")).toBe(false);
  });

  it("offers email everywhere", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(channelApplies(category, "email")).toBe(true);
    }
  });

  it("declares every channel it lists", () => {
    for (const channels of Object.values(CATEGORY_CHANNELS)) {
      for (const channel of channels) expect(NOTIFICATION_CHANNELS).toContain(channel);
    }
  });
});

describe("normalizePreferences", () => {
  it("answers yes to everything for an account that never opened the screen", () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizePreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizePreferences({})).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("completes a half-written document instead of trusting its shape", () => {
    const preferences = normalizePreferences({ process: { email: false } });

    expect(preferences.process.email).toBe(false);
    // Un campo que no está no es alguien que apagó algo.
    expect(preferences.process.whatsapp).toBe(true);
    expect(preferences.lease.email).toBe(true);
  });

  it("ignores a value that is not a boolean rather than coercing it", () => {
    // `"false"` es una cadena, y una cadena no es una respuesta: solo `false` apaga.
    const preferences = normalizePreferences({ lease: { email: "false", whatsapp: 0 } });

    expect(preferences.lease.email).toBe(true);
    expect(preferences.lease.whatsapp).toBe(true);
  });

  it("survives a category that is not an object", () => {
    expect(normalizePreferences({ errands: "todo" }).errands.email).toBe(true);
  });
});

describe("allowsChannel", () => {
  const off = normalizePreferences({
    process: { email: false },
    reminders: { email: false, whatsapp: false },
  });

  it("respects a channel that was switched off", () => {
    expect(allowsChannel(off, "document_rejected", "email")).toBe(false);
    expect(allowsChannel(off, "interview_reminder_soon", "whatsapp")).toBe(false);
  });

  it("leaves the other categories alone", () => {
    expect(allowsChannel(off, "canon_paid", "email")).toBe(true);
    expect(allowsChannel(off, "errand_declined", "email")).toBe(true);
  });

  it("fails towards delivering when the preferences could not be read", () => {
    /*
     * `null` es "no pudimos leer", y la respuesta tiene que ser que sí: dejar a alguien sin el
     * correo que dice que le rechazaron un documento porque Firestore tuvo un mal segundo es peor
     * que mandarle uno que había apagado.
     */
    expect(allowsChannel(null, "document_rejected", "email")).toBe(true);
    expect(allowsChannel(null, "interview_reminder_soon", "whatsapp")).toBe(true);
  });

  it("still refuses a channel the category never uses, preferences or not", () => {
    // Ni siquiera con todo encendido: `notify()` no manda WhatsApp de un proceso, así que decir
    // que sí sería describir un envío que no existe.
    expect(allowsChannel(null, "document_rejected", "whatsapp")).toBe(false);
    expect(allowsChannel(DEFAULT_NOTIFICATION_PREFERENCES, "canon_paid", "whatsapp")).toBe(false);
  });
});

describe("CATEGORY_COPY", () => {
  it("names every category", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_COPY[category].label.length).toBeGreaterThan(0);
      expect(CATEGORY_COPY[category].covers.length).toBeGreaterThan(0);
    }
  });
});
