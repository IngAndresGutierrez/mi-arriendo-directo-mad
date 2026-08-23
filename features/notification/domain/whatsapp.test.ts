import { describe, expect, it } from "vitest";

import { interviewReminderMessage } from "./whatsapp";

describe("interviewReminderMessage", () => {
  const base = {
    to: "+573001234567",
    propertyTitle: "Apartaestudio en los Alcazares",
    when: "jueves 10 de septiembre, 3:00 p. m.",
    template: "interview_reminder",
    locale: "es_CO",
  };

  it("passes what the call is about and when, in that order", () => {
    expect(interviewReminderMessage(base).parameters).toEqual([
      "Apartaestudio en los Alcazares",
      "jueves 10 de septiembre, 3:00 p. m.",
    ]);
  });

  it("collapses whitespace: WhatsApp rejects a parameter with a newline", () => {
    const message = interviewReminderMessage({
      ...base,
      propertyTitle: "Apartaestudio\n  en los  Alcazares ",
    });
    expect(message.parameters[0]).toBe("Apartaestudio en los Alcazares");
  });

  it("keeps the destination and the template it was told to use", () => {
    const message = interviewReminderMessage(base);
    expect(message.to).toBe("+573001234567");
    expect(message.template).toBe("interview_reminder");
    expect(message.locale).toBe("es_CO");
  });
});
