import { describe, expect, it } from "vitest";

import { renderNotificationEmail } from "./email";
import {
  isLeaseNotification,
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
    }, "es");
    expect(copy.body).toContain("Sura");
    expect(copy.body).toContain("sin codeudor");
  });

  it("says what comes next once it is active", () => {
    const copy = notificationCopy({ ...base, type: "guarantee_active", detail: "Póliza AR-99123 de Sura." }, "es");
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
    }, "es");
    expect(copy.title).toContain("entrevista");
    expect(copy.body).toContain("jueves 10 de septiembre");
    expect(copy.body).toContain("Confírmala");
  });

  it("still says something useful with no detail stored", () => {
    const copy = notificationCopy({ ...base, type: "interview_confirmed" }, "es");
    expect(copy.body).toContain("Apartaestudio en los Alcazares");
  });

  it("reminds the day before and minutes before, and they read differently", () => {
    const cuando = "jueves 10 de septiembre, 3:00 p. m.";
    const mañana = notificationCopy({ ...base, type: "interview_reminder_day", detail: cuando }, "es");
    const yaCasi = notificationCopy({ ...base, type: "interview_reminder_soon", detail: cuando }, "es");
    expect(mañana.title).toContain("Mañana");
    expect(yaCasi.title).toContain("10 minutos");
    expect(yaCasi.body).toContain("el enlace a mano");
    expect(mañana.body).toContain(cuando);
    // "3:00 p. m." ya trae su punto: el cuerpo no le pone otro.
    expect(mañana.body).not.toContain("m..");
    expect(yaCasi.body).not.toContain("m..");
  });

  it("asks the landlord for another time when the tenant cannot", () => {
    expect(notificationCopy({ ...base, type: "interview_declined" }, "es").body).toContain("Propón otra");
  });
});

describe("la visita al inmueble", () => {
  /*
   * El punto de encuentro es el único campo del proceso que entrega la dirección, y nunca sale en
   * un aviso: un correo se reenvía, se cita y se queda abierto en un portátil. Lo que viaja es
   * cuándo; dónde se lee en la página, detrás de la sesión. La acción es la que decide qué manda
   * como `detail`, y esto comprueba la otra mitad: que el texto mande a la página a buscarlo.
   */
  it("dice cuándo es la visita y manda a la página a ver dónde", () => {
    const copy = notificationCopy({
      ...base,
      type: "visit_proposed",
      detail: "jueves 10 de septiembre, 3:00 p. m.",
    }, "es");
    expect(copy.body).toContain("jueves 10 de septiembre");
    expect(copy.body).toMatch(/punto de encuentro está en la etapa/i);
  });

  /*
   * Dos tipos y no uno con el resultado dentro: "le interesó" es una tarea —el proceso ya puede
   * seguir— y "no le interesó" es el final. Un aviso que no distingue las dos se ignora.
   */
  it("distingue las dos conclusiones, porque piden cosas distintas", () => {
    const sí = notificationCopy({ ...base, type: "visit_interested" }, "es");
    const no = notificationCopy({ ...base, type: "visit_not_interested" }, "es");

    expect(sí.title).not.toBe(no.title);
    expect(sí.body).toMatch(/continuar/i);
    expect(no.body).toMatch(/no sigue/i);
    expect(no.body).toMatch(/rechazar|proponer otra/i);
  });
});

describe("notificationCopy", () => {
  it("writes a title and a body for every type", () => {
    for (const type of NOTIFICATION_TYPES) {
      const copy = notificationCopy({ ...base, type }, "es");
      expect(copy.title).toBeTruthy();
      expect(copy.body).toBeTruthy();
    }
  });

  it("names who did it and what it was about", () => {
    const copy = notificationCopy(base, "es");
    expect(copy.body).toContain("Ana Pérez");
    expect(copy.body).toContain("Apartamento en Palermo");
  });

  // Someone with no name on their profile should still get a sentence, not "undefined se postuló".
  it("falls back when the actor has no name", () => {
    expect(notificationCopy({ ...base, actorName: "" }, "es").body).toMatch(/^Alguien se postuló/);
  });

  /*
   * "Avanzaste a Datos y documentos" is a status line; "te piden tus documentos" is a task.
   * They are separate types precisely so the reader can tell which one they got.
   */
  it("asks for documents instead of announcing a stage", () => {
    const copy = notificationCopy({ ...base, type: "documents_requested", stage: "tenant_data" }, "es");
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
    }, "es");

    expect(copy.title).toMatch(/corregir un documento/i);
    expect(copy.body).toContain("Cédula por el frente");
    expect(copy.body).toContain("la foto está borrosa");
  });

  it("still says something useful when the landlord left no reason", () => {
    const copy = notificationCopy({ ...base, type: "document_rejected", stage: "tenant_data" }, "es");
    expect(copy.body).toMatch(/Súbelo otra vez/);
  });

  it("says at which stage a closed process stopped", () => {
    expect(notificationCopy({ ...base, type: "application_rejected", stage: "interview" }, "es").body).toContain(
      "Entrevista con el propietario",
    );
    expect(notificationCopy({ ...base, type: "application_withdrawn", stage: "guarantee" }, "es").body).toContain(
      "Póliza de arrendamiento",
    );
  });
});

describe("notificationPath", () => {
  // The point of the anchor: land on the step, not on a page with nine of them.
  it("points at the stage inside the process", () => {
    expect(
      notificationPath({ applicationId: "abc", stage: "contract_signature", type: "contract_ready" }),
    ).toBe("/contratos/abc#etapa-contract-signature");
  });

  it("builds an anchor a URL can carry for every stage", () => {
    expect(stageAnchor("tenant_data")).toBe("etapa-tenant-data");
    expect(stageAnchor("first_payment")).toBe("etapa-first-payment");
    expect(stageAnchor("first_payment")).not.toContain("_");
  });

  /*
   * Las dos mitades de la misma historia bajo la misma llave: el id de un arriendo *es* el de su
   * postulación, así que lo único que cambia es qué página lo muestra.
   */
  it("points at the tenancy, at the month, when that is what it is about", () => {
    expect(
      notificationPath({
        applicationId: "abc",
        stage: "first_payment",
        type: "canon_receipt_uploaded",
        period: "2026-09",
      }),
    ).toBe("/arriendos/abc#mes-2026-09");
  });

  it("points at the tenancy with no anchor when no month is named", () => {
    expect(notificationPath({ applicationId: "abc", stage: "first_payment", type: "lease_started" })).toBe(
      "/arriendos/abc",
    );
  });

  it("knows which types belong to the tenancy and which to the process", () => {
    expect(isLeaseNotification("canon_paid")).toBe(true);
    expect(isLeaseNotification("lease_started")).toBe(true);
    expect(isLeaseNotification("incident_reported")).toBe(true);
    expect(isLeaseNotification("canon_confirmed")).toBe(false);
    expect(isLeaseNotification("stage_advanced")).toBe(false);
  });

  /** Un reporte de una gotera aterriza en la gotera, no arriba de una página con doce meses. */
  it("points at the incident inside the tenancy", () => {
    expect(
      notificationPath({
        applicationId: "abc",
        stage: "first_payment",
        type: "incident_reported",
        incident: "inc-7",
      }),
    ).toBe("/arriendos/abc#incidente-inc-7");
  });
});

describe("the incident notification", () => {
  const base = {
    stage: "first_payment" as const,
    propertyTitle: "Apartamento en Chapinero",
    actorName: "Carlos Ramírez",
    applicationId: "abc",
  };

  it("names what happened and sends the landlord to the tenancy to read it", () => {
    const copy = notificationCopy({
      ...base,
      type: "incident_reported",
      detail: "Se rompió el sifón del lavaplatos",
    }, "es");

    expect(copy.title).toMatch(/incidente/i);
    expect(copy.body).toContain("Carlos Ramírez");
    expect(copy.body).toContain("Se rompió el sifón del lavaplatos");
    expect(copy.body).toMatch(/arriendo/i);
  });

  it("still says something when the title is missing", () => {
    const copy = notificationCopy({ ...base, type: "incident_reported" }, "es");

    expect(copy.body).toContain("Apartamento en Chapinero");
  });

  /*
   * Lo que **no** sale en el correo: la descripción y los adjuntos. Es lo que el inquilino escribió
   * sobre su casa con algo roto dentro, y un correo se reenvía y se queda abierto en un portátil. El
   * título dice qué pasó y el enlace dice dónde leer el resto, detrás de la sesión.
   */
  it("carries the title and the link, and never the description", () => {
    const email = renderNotificationEmail(
      {
        ...base,
        type: "incident_reported",
        detail: "Se rompió el sifón del lavaplatos",
        incident: "inc-7",
      },
      "dueno@example.com",
      "https://miarriendodirecto.com",
      "es",
    );

    expect(email.text).toContain("https://miarriendodirecto.com/arriendos/abc#incidente-inc-7");
    expect(email.text).toContain("Se rompió el sifón del lavaplatos");
    expect(email.text).toMatch(/Ver el arriendo/);
    // La descripción nunca se le pasa a `notify`, así que no hay forma de que aparezca aquí.
    expect(email.text).not.toMatch(/goteando|debajo del mueble/i);
  });

  /*
   * El armazón del correo —el botón, el enlace de respaldo, el pie y el `lang` del documento— sigue
   * el idioma de **quien lo recibe**, que `notify()` lee de `users/{uid}.locale`. No lo decide la
   * petición: quien mueve el proceso es la otra parte, así que un propietario aprobando un documento
   * en español mandaría el correo del inquilino en español sin esto.
   *
   * Las cuarenta y seis frases por tipo siguen en español y están fuera de este cambio: van en
   * `notificationCopy`, no aquí. Lo que esta prueba fija es que el armazón sí cambia, y que el
   * `<html lang>` deja de mentir sobre el idioma del documento.
   */
  it("dresses the email in the recipient's language", () => {
    const notification = { ...base, type: "incident_reported" as const };
    const es = renderNotificationEmail(notification, "a@b.com", "https://example.test", "es");
    const en = renderNotificationEmail(notification, "a@b.com", "https://example.test", "en");

    expect(es.html).toContain('lang="es-CO"');
    expect(es.text).toContain("Ver el arriendo");

    expect(en.html).toContain('lang="en"');
    expect(en.text).toContain("View the tenancy");
    expect(en.html).toContain("If the button does not work");
    expect(en.text).not.toContain("Ver el arriendo");
  });
});

describe("the tenancy's notifications", () => {
  const base = {
    stage: "first_payment",
    propertyTitle: "Apartamento en Chapinero",
    actorName: "Ana Uno Pérez",
  } as const;

  it("names the month it is about", () => {
    expect(
      notificationCopy({ ...base, type: "canon_receipt_uploaded", period: "2026-09" }, "es").body,
    ).toContain("septiembre de 2026");
    expect(notificationCopy({ ...base, type: "canon_paid", period: "2026-10" }, "es").body).toContain(
      "octubre de 2026",
    );
  });

  it("still reads as a sentence with no month", () => {
    const body = notificationCopy({ ...base, type: "canon_receipt_uploaded" }, "es").body;
    expect(body).toContain("Apartamento en Chapinero");
    expect(body).not.toContain("undefined");
  });

  /*
   * Los datos de la cuenta no salen en la notificación, por lo mismo que en el primer canon: un
   * correo con el número de cuenta de alguien es la forma de toda estafa de pagos que existe.
   */
  it("says the payout changed without carrying the payout", () => {
    const body = notificationCopy({ ...base, type: "canon_payout_changed" }, "es").body;
    expect(body).toContain("cambió por dónde recibe");
    expect(body).toMatch(/en el arriendo/);
  });

  it("carries the reason on a rejection: it is the only thing that says what to fix", () => {
    const body = notificationCopy({
      ...base,
      type: "canon_receipt_rejected",
      period: "2026-09",
      detail: "Llegaron $200.000 de menos.",
    }, "es").body;
    expect(body).toContain("Llegaron $200.000 de menos.");
    expect(body).not.toContain("..");
  });
});

describe("renderNotificationEmail", () => {
  const email = renderNotificationEmail(base, "duena@example.com", "https://www.miarriendodirecto.com", "es");

  it("carries an absolute link straight to the stage", () => {
    const link = "https://www.miarriendodirecto.com/contratos/app-1#etapa-submitted";
    expect(email.html).toContain(link);
    expect(email.text).toContain(link);
  });

  // A client that shows only the text part is not an edge case.
  it("always has both a text and an HTML body", () => {
    expect(email.text.length).toBeGreaterThan(40);
    expect(email.html).toContain("<!doctype html>");
    expect(email.subject).toBe(notificationCopy(base, "es").title);
  });

  it("does not double the slash when the base URL has one", () => {
    const withSlash = renderNotificationEmail(base, "a@b.com", "https://www.miarriendodirecto.com/", "es");
    expect(withSlash.html).not.toContain(".com//contrato");
  });

  // The property title is written by a landlord: it reaches the inbox as text, never as markup.
  it("escapes what a user wrote", () => {
    const nasty = renderNotificationEmail(
      { ...base, propertyTitle: '<script>alert("x")</script>' },
      "a@b.com",
      "https://example.test",
      "es",
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

describe("the waived guarantee", () => {
  const base = {
    stage: "guarantee" as const,
    propertyTitle: "Apartaestudio en los Alcazares",
    actorName: "Ana Pérez",
    applicationId: "abc",
  };

  /*
   * Para el inquilino esto es una cosa menos que hacer, y es justo lo contrario de lo que la otra
   * notificación de esta etapa le había dicho que esperara ("puede que Sura te escriba").
   */
  it("tells the tenant there is nothing for them to do", () => {
    const copy = notificationCopy({ ...base, type: "guarantee_waived" }, "es");

    expect(copy.title).toMatch(/sin p[óo]liza/i);
    expect(copy.body).toContain("Ana Pérez");
    expect(copy.body).toContain("Apartaestudio en los Alcazares");
    expect(copy.body).toMatch(/no tienes que hacer nada/i);
  });

  /** Es del proceso, no de la tenencia: lleva a la etapa de la garantía. */
  it("points at the guarantee stage of the process", () => {
    expect(isLeaseNotification("guarantee_waived")).toBe(false);
    expect(notificationPath({ ...base, type: "guarantee_waived" })).toBe(
      "/contratos/abc#etapa-guarantee",
    );
  });
});
