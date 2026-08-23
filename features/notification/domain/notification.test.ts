import { describe, expect, it } from "vitest";

import { renderNotificationEmail } from "./email";
import {
  notificationCopy,
  notificationPath,
  relativeTime,
  stageAnchor,
  NOTIFICATION_TYPES,
} from "./notification";

const base = {
  type: "application_received" as const,
  stage: "submitted" as const,
  propertyTitle: "Apartamento en Palermo",
  actorName: "Ana Pérez",
  applicationId: "app-1",
};

describe("guarantee copy", () => {
  const base = { stage: "guarantee" as const, propertyTitle: "Apartaestudio en los Alcazares", actorName: "Ana" };

  it("tells the tenant the policy is being studied, and that they may be written to", () => {
    const copy = notificationCopy({
      ...base,
      type: "guarantee_requested",
      detail: "Es con Sura, sin codeudor. Puede que te escriban para completar el estudio.",
    });
    expect(copy.body).toContain("Sura");
    expect(copy.body).toContain("sin codeudor");
  });

  it("says what comes next once it is active", () => {
    const copy = notificationCopy({ ...base, type: "guarantee_active", detail: "Póliza AR-99123 de Sura." });
    expect(copy.title).toContain("activa");
    expect(copy.body).toContain("AR-99123");
    expect(copy.body).toContain("firma del contrato");
    expect(copy.body).not.toContain("..");
  });
});

describe("interview copy", () => {
  const base = { stage: "interview" as const, propertyTitle: "Apartaestudio en los Alcazares", actorName: "Ana" };

  it("names the time it is about, and says what to do with it", () => {
    const copy = notificationCopy({
      ...base,
      type: "interview_proposed",
      detail: "el jueves 10 de septiembre a las 3:00 p. m.",
    });
    expect(copy.title).toContain("entrevista");
    expect(copy.body).toContain("jueves 10 de septiembre");
    expect(copy.body).toContain("Confírmala");
  });

  it("still says something useful with no detail stored", () => {
    const copy = notificationCopy({ ...base, type: "interview_confirmed" });
    expect(copy.body).toContain("Apartaestudio en los Alcazares");
  });

  it("reminds the day before and minutes before, and they read differently", () => {
    const cuando = "jueves 10 de septiembre, 3:00 p. m.";
    const mañana = notificationCopy({ ...base, type: "interview_reminder_day", detail: cuando });
    const yaCasi = notificationCopy({ ...base, type: "interview_reminder_soon", detail: cuando });
    expect(mañana.title).toContain("Mañana");
    expect(yaCasi.title).toContain("10 minutos");
    expect(yaCasi.body).toContain("el enlace a mano");
    expect(mañana.body).toContain(cuando);
    // "3:00 p. m." ya trae su punto: el cuerpo no le pone otro.
    expect(mañana.body).not.toContain("m..");
    expect(yaCasi.body).not.toContain("m..");
  });

  it("asks the landlord for another time when the tenant cannot", () => {
    expect(notificationCopy({ ...base, type: "interview_declined" }).body).toContain("Propón otra");
  });
});

describe("notificationCopy", () => {
  it("writes a title and a body for every type", () => {
    for (const type of NOTIFICATION_TYPES) {
      const copy = notificationCopy({ ...base, type });
      expect(copy.title).toBeTruthy();
      expect(copy.body).toBeTruthy();
    }
  });

  it("names who did it and what it was about", () => {
    const copy = notificationCopy(base);
    expect(copy.body).toContain("Ana Pérez");
    expect(copy.body).toContain("Apartamento en Palermo");
  });

  // Someone with no name on their profile should still get a sentence, not "undefined se postuló".
  it("falls back when the actor has no name", () => {
    expect(notificationCopy({ ...base, actorName: "" }).body).toMatch(/^Alguien se postuló/);
  });

  /*
   * "Avanzaste a Datos y documentos" is a status line; "te piden tus documentos" is a task.
   * They are separate types precisely so the reader can tell which one they got.
   */
  it("asks for documents instead of announcing a stage", () => {
    const copy = notificationCopy({ ...base, type: "documents_requested", stage: "tenant_data" });
    expect(copy.title).toMatch(/documentos/i);
    expect(copy.body).toMatch(/subir/i);
  });

  /*
   * The reason is the whole message. "Rechazado" on its own sends the tenant back to the
   * checklist to guess which file and what was wrong with it.
   */
  it("names the document and the reason when one is rejected", () => {
    const copy = notificationCopy({
      ...base,
      type: "document_rejected",
      stage: "tenant_data",
      detail: "Cédula por el frente: la foto está borrosa",
    });

    expect(copy.title).toMatch(/corregir un documento/i);
    expect(copy.body).toContain("Cédula por el frente");
    expect(copy.body).toContain("la foto está borrosa");
  });

  it("still says something useful when the landlord left no reason", () => {
    const copy = notificationCopy({ ...base, type: "document_rejected", stage: "tenant_data" });
    expect(copy.body).toMatch(/Súbelo otra vez/);
  });

  it("says at which stage a closed process stopped", () => {
    expect(notificationCopy({ ...base, type: "application_rejected", stage: "interview" }).body).toContain(
      "Entrevista con el propietario",
    );
    expect(notificationCopy({ ...base, type: "application_withdrawn", stage: "guarantee" }).body).toContain(
      "Póliza de arrendamiento",
    );
  });
});

describe("notificationPath", () => {
  // The point of the anchor: land on the step, not on a page with nine of them.
  it("points at the stage inside the process", () => {
    expect(notificationPath({ applicationId: "abc", stage: "contract_signature" })).toBe(
      "/arriendos/abc#etapa-contract-signature",
    );
  });

  it("builds an anchor a URL can carry for every stage", () => {
    expect(stageAnchor("tenant_data")).toBe("etapa-tenant-data");
    expect(stageAnchor("active")).toBe("etapa-active");
    expect(stageAnchor("first_payment")).not.toContain("_");
  });
});

describe("renderNotificationEmail", () => {
  const email = renderNotificationEmail(base, "duena@example.com", "https://www.miarriendodirecto.com");

  it("carries an absolute link straight to the stage", () => {
    const link = "https://www.miarriendodirecto.com/arriendos/app-1#etapa-submitted";
    expect(email.html).toContain(link);
    expect(email.text).toContain(link);
  });

  // A client that shows only the text part is not an edge case.
  it("always has both a text and an HTML body", () => {
    expect(email.text.length).toBeGreaterThan(40);
    expect(email.html).toContain("<!doctype html>");
    expect(email.subject).toBe(notificationCopy(base).title);
  });

  it("does not double the slash when the base URL has one", () => {
    const withSlash = renderNotificationEmail(base, "a@b.com", "https://www.miarriendodirecto.com/");
    expect(withSlash.html).not.toContain(".com//contrato");
  });

  // The property title is written by a landlord: it reaches the inbox as text, never as markup.
  it("escapes what a user wrote", () => {
    const nasty = renderNotificationEmail(
      { ...base, propertyTitle: '<script>alert("x")</script>' },
      "a@b.com",
      "https://example.test",
    );
    expect(nasty.html).not.toContain("<script>");
    expect(nasty.html).toContain("&lt;script&gt;");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-22T15:00:00Z");

  it("counts in the units a person would use", () => {
    expect(relativeTime("2026-08-22T14:59:40Z", now)).toBe("hace un momento");
    expect(relativeTime("2026-08-22T14:55:00Z", now)).toBe("hace 5 minutos");
    expect(relativeTime("2026-08-22T14:00:00Z", now)).toBe("hace 1 hora");
    expect(relativeTime("2026-08-20T15:00:00Z", now)).toBe("hace 2 días");
  });

  it("gives a date once counting days stops being useful", () => {
    expect(relativeTime("2026-06-01T15:00:00Z", now)).toMatch(/1 de junio/);
  });
});
