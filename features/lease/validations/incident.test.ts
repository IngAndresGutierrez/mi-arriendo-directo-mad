import { describe, expect, it } from "vitest";

import { INCIDENT_VIDEO_MAX_BYTES, MAX_INCIDENT_ATTACHMENTS } from "../domain/incident";
import {
  incidentAttachmentSchema,
  incidentReportSchema,
  incidentUpdateSchema,
} from "./incident";

const file = (over: Record<string, unknown> = {}) => ({
  path: "incidents/uid-tenant/abc-foto.jpg",
  fileName: "foto.jpg",
  contentType: "image/jpeg",
  bytes: 200_000,
  ...over,
});

describe("incidentReportSchema", () => {
  it("accepts a real report with no attachments", () => {
    const parsed = incidentReportSchema.safeParse({
      title: "Se rompió el sifón del lavaplatos",
      description: "Está goteando debajo del mueble de la cocina desde anoche.",
    });

    expect(parsed.success).toBe(true);
    // Optional on purpose: a tenant with no signal should be able to report now and show later.
    expect(parsed.success && parsed.data.attachments).toEqual([]);
  });

  it("trims, and a title of only spaces is not a title", () => {
    const parsed = incidentReportSchema.safeParse({
      title: "  Gotera en el techo  ",
      description: "  Cada vez que llueve entra agua por la esquina del cuarto.  ",
    });

    expect(parsed.success && parsed.data.title).toBe("Gotera en el techo");
    expect(incidentReportSchema.safeParse({ title: "      ", description: "x".repeat(20) }).success).toBe(
      false,
    );
  });

  it("refuses a title or a description that says nothing", () => {
    expect(incidentReportSchema.safeParse({ title: "ok", description: "x".repeat(20) }).success).toBe(
      false,
    );
    expect(
      incidentReportSchema.safeParse({ title: "Gotera en el techo", description: "se dañó" }).success,
    ).toBe(false);
  });

  it("refuses a description longer than the field", () => {
    expect(
      incidentReportSchema.safeParse({
        title: "Gotera en el techo",
        description: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it(`accepts up to ${MAX_INCIDENT_ATTACHMENTS} files and refuses one more`, () => {
    const report = (count: number) => ({
      title: "Gotera en el techo",
      description: "Cada vez que llueve entra agua por la esquina del cuarto.",
      attachments: Array.from({ length: count }, (_, index) =>
        file({ fileName: `foto-${index}.jpg` }),
      ),
    });

    expect(incidentReportSchema.safeParse(report(MAX_INCIDENT_ATTACHMENTS)).success).toBe(true);
    expect(incidentReportSchema.safeParse(report(MAX_INCIDENT_ATTACHMENTS + 1)).success).toBe(false);
  });
});

describe("incidentAttachmentSchema", () => {
  it("accepts a photo and a video", () => {
    expect(incidentAttachmentSchema.safeParse(file()).success).toBe(true);
    expect(
      incidentAttachmentSchema.safeParse(
        file({ contentType: "video/quicktime", fileName: "IMG_0042.mov", bytes: 30 * 1024 * 1024 }),
      ).success,
    ).toBe(true);
  });

  it("refuses a type that is not a photo or a video", () => {
    expect(incidentAttachmentSchema.safeParse(file({ contentType: "application/pdf" })).success).toBe(
      false,
    );
  });

  /*
   * The per-type cap, which is the one rule a `.max()` on the field cannot express. Weakening the
   * `superRefine` in `incident.ts` makes exactly this case pass, which is what says the test is
   * doing something.
   */
  it("holds an image to eight megabytes even though the field allows fifty", () => {
    const twenty = 20 * 1024 * 1024;
    expect(incidentAttachmentSchema.safeParse(file({ bytes: twenty })).success).toBe(false);
    expect(
      incidentAttachmentSchema.safeParse(file({ contentType: "video/mp4", bytes: twenty })).success,
    ).toBe(true);
  });

  it("refuses an empty file and one over the video limit", () => {
    expect(incidentAttachmentSchema.safeParse(file({ bytes: 0 })).success).toBe(false);
    expect(
      incidentAttachmentSchema.safeParse(
        file({ contentType: "video/mp4", bytes: INCIDENT_VIDEO_MAX_BYTES + 1 }),
      ).success,
    ).toBe(false);
  });
});

describe("incidentUpdateSchema", () => {
  it("accepts a message, a state change, or both", () => {
    expect(incidentUpdateSchema.safeParse({ note: "Mando al plomero el martes." }).success).toBe(true);
    expect(incidentUpdateSchema.safeParse({ movedTo: "in_progress" }).success).toBe(true);
    expect(
      incidentUpdateSchema.safeParse({ movedTo: "awaiting_confirmation", note: "Cambié el sifón." })
        .success,
    ).toBe(true);
  });

  /** Una fila en el hilo que no dice nada es una fila que no debería poderse escribir. */
  it("refuses an update that is neither a message nor a move nor a file", () => {
    expect(incidentUpdateSchema.safeParse({}).success).toBe(false);
    expect(incidentUpdateSchema.safeParse({ note: "   " }).success).toBe(false);
    expect(incidentUpdateSchema.safeParse({ note: "", movedTo: null }).success).toBe(false);
  });

  it("accepts an update that is only a file", () => {
    expect(
      incidentUpdateSchema.safeParse({
        attachments: [file({ contentType: "video/mp4", fileName: "arreglado.mp4" })],
      }).success,
    ).toBe(true);
  });

  it("refuses a state that is not one of the five", () => {
    expect(incidentUpdateSchema.safeParse({ movedTo: "cancelado" }).success).toBe(false);
  });

  it("refuses a message longer than the field", () => {
    expect(incidentUpdateSchema.safeParse({ note: "x".repeat(1001) }).success).toBe(false);
  });
});
