import { describe, expect, it } from "vitest";

import {
  allAttachments,
  allowedTransitions,
  attachmentLimit,
  attachmentProblem,
  attachmentsLabel,
  incidentAnchor,
  incidentFolder,
  canTransition,
  incidentState,
  isIncidentOpen,
  isOwnAttachmentPath,
  isVideoAttachment,
  transitionLabel,
  transitionRequiresNote,
  INCIDENT_STATES,
  INCIDENT_IMAGE_MAX_BYTES,
  INCIDENT_VIDEO_MAX_BYTES,
  type IncidentAttachment,
  type IncidentUpdate,
} from "./incident";

const attachment = (contentType: string, fileName = "x"): IncidentAttachment => ({
  path: `incidents/uid-tenant/${fileName}`,
  fileName,
  contentType,
  bytes: 1000,
  uploadedAt: "2026-08-24T12:00:00.000Z",
});

describe("attachmentLimit", () => {
  it("gives a video fifty megabytes and an image eight", () => {
    expect(attachmentLimit("video/mp4")).toBe(INCIDENT_VIDEO_MAX_BYTES);
    expect(attachmentLimit("video/quicktime")).toBe(INCIDENT_VIDEO_MAX_BYTES);
    expect(attachmentLimit("image/jpeg")).toBe(INCIDENT_IMAGE_MAX_BYTES);
  });

  it("gives nothing at all to a type that is not accepted", () => {
    // Zero rather than a default: a PDF of a leak is not a report of one, and a permissive
    // fallback here would let one through both the picker and the action.
    expect(attachmentLimit("application/pdf")).toBe(0);
    expect(attachmentLimit("")).toBe(0);
  });
});

describe("attachmentProblem", () => {
  it("accepts a phone photo and a short video", () => {
    expect(attachmentProblem({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
    expect(attachmentProblem({ type: "video/quicktime", size: 30 * 1024 * 1024 })).toBeNull();
  });

  it("rejects a document, an empty file and anything over its own limit", () => {
    expect(attachmentProblem({ type: "application/pdf", size: 1000 })).toMatch(/fotos.*videos/);
    expect(attachmentProblem({ type: "image/png", size: 0 })).toMatch(/vac/);
    expect(attachmentProblem({ type: "image/png", size: INCIDENT_IMAGE_MAX_BYTES + 1 })).toMatch(
      /8 MB/,
    );
    expect(attachmentProblem({ type: "video/mp4", size: INCIDENT_VIDEO_MAX_BYTES + 1 })).toMatch(
      /50 MB/,
    );
  });

  it("holds each type to its own limit and not to the larger one", () => {
    // The whole reason the limit is a function of the type: a 20 MB image is over its cap while a
    // 20 MB video is well inside its own.
    const twenty = 20 * 1024 * 1024;
    expect(attachmentProblem({ type: "image/jpeg", size: twenty })).not.toBeNull();
    expect(attachmentProblem({ type: "video/mp4", size: twenty })).toBeNull();
  });

  it("tells a video apart from an image so the message names the right limit", () => {
    expect(isVideoAttachment("video/webm")).toBe(true);
    expect(isVideoAttachment("image/webp")).toBe(false);
  });
});

describe("isOwnAttachmentPath", () => {
  it("accepts a file inside the person's own folder", () => {
    expect(isOwnAttachmentPath("incidents/uid-tenant/abc-foto.jpg", "uid-tenant")).toBe(true);
    expect(incidentFolder("uid-tenant")).toBe("incidents/uid-tenant/");
  });

  it("rejects somebody else's folder, the folder itself and a traversal", () => {
    // What this stops: recording a file that exists but is not yours. The Storage rules would have
    // refused the upload; they cannot refuse a path that was already there.
    expect(isOwnAttachmentPath("incidents/uid-other/abc.jpg", "uid-tenant")).toBe(false);
    expect(isOwnAttachmentPath("applicants/uid-tenant/cedula.pdf", "uid-tenant")).toBe(false);
    expect(isOwnAttachmentPath("incidents/uid-tenant/../uid-other/abc.jpg", "uid-tenant")).toBe(
      false,
    );
    // A prefix that only *looks* like the folder: `uid-tenant2` is a different person.
    expect(isOwnAttachmentPath("incidents/uid-tenant2/abc.jpg", "uid-tenant")).toBe(false);
  });
});

describe("attachmentsLabel", () => {
  it("counts photos and videos separately, and says when there are none", () => {
    expect(attachmentsLabel([])).toBe("Sin archivos");
    expect(attachmentsLabel([attachment("image/jpeg")])).toBe("1 foto");
    expect(attachmentsLabel([attachment("video/mp4")])).toBe("1 video");
    expect(
      attachmentsLabel([attachment("image/jpeg"), attachment("image/png"), attachment("video/mp4")]),
    ).toBe("2 fotos · 1 video");
  });
});

describe("incidentAnchor", () => {
  it("is the anchor a notification lands on", () => {
    expect(incidentAnchor("abc123")).toBe("incidente-abc123");
  });
});

// ---------------------------------------------------------------------------
// la vida de un incidente
// ---------------------------------------------------------------------------

const update = (over: Partial<IncidentUpdate> = {}): IncidentUpdate => ({
  by: "landlord",
  authorUid: "uid-landlord",
  authorName: "Ana Propietaria",
  at: "2026-08-24T12:00:00.000Z",
  note: "",
  attachments: [],
  movedTo: null,
  ...over,
});

describe("incidentState", () => {
  it("is `reported` while nothing has happened", () => {
    expect(incidentState({ updates: [] })).toBe("reported");
    // Un mensaje no mueve nada: hablar de una gotera no la arregla.
    expect(incidentState({ updates: [update({ note: "Voy a mirarlo." })] })).toBe("reported");
  });

  it("is the last move, not the last update", () => {
    expect(
      incidentState({
        updates: [
          update({ movedTo: "in_progress" }),
          update({ note: "El plomero viene el jueves." }),
        ],
      }),
    ).toBe("in_progress");
  });

  /*
   * Derivarlo del hilo es lo que hace imposible que el estado y el registro se contradigan. Este
   * caso es el que lo demuestra: una reapertura después de un resuelto.
   */
  it("follows a whole life, reopening included", () => {
    expect(
      incidentState({
        updates: [
          update({ movedTo: "in_progress" }),
          update({ movedTo: "awaiting_confirmation", note: "Cambié el sifón." }),
          update({ by: "tenant", movedTo: "resolved" }),
          update({ by: "tenant", movedTo: "in_progress", note: "Volvió a gotear." }),
        ],
      }),
    ).toBe("in_progress");
  });
});

describe("an incident written before the thread existed", () => {
  /*
   * Estos documentos están en la base ahora mismo: se reportaron cuando `updates` no existía. La
   * lista se cayó con `Cannot read properties of undefined (reading 'length')` justo por esto, así
   * que las dos funciones que lo tocan tienen que ser totales.
   */
  it("reads as `reported` instead of throwing", () => {
    expect(incidentState({})).toBe("reported");
    expect(incidentState({ updates: undefined })).toBe("reported");
  });

  it("still lists the files it was reported with", () => {
    const roto = attachment("image/jpeg", "roto.jpg");

    expect(allAttachments({ attachments: [roto] }).map((one) => one.fileName)).toEqual(["roto.jpg"]);
    expect(allAttachments({})).toEqual([]);
  });

  it("offers the same actions a fresh one does", () => {
    expect(allowedTransitions(incidentState({}), true)).toEqual([
      "in_progress",
      "awaiting_confirmation",
    ]);
  });
});

describe("isIncidentOpen", () => {
  it("counts everything except resolved and withdrawn", () => {
    expect(INCIDENT_STATES.filter(isIncidentOpen)).toEqual([
      "reported",
      "in_progress",
      "awaiting_confirmation",
    ]);
  });
});

describe("allowedTransitions", () => {
  /*
   * **Solo el inquilino resuelve**, en cualquier estado y desde cualquier lado. Es la regla que
   * mantiene honesto todo el dominio: si la ducha funciona lo sabe quien se ducha, igual que si el
   * dinero llegó lo sabe el dueño de la cuenta. Se comprueba sobre los cinco estados, no sobre uno.
   */
  it("never lets the landlord resolve, in any state", () => {
    for (const state of INCIDENT_STATES) {
      expect(allowedTransitions(state, true)).not.toContain("resolved");
      expect(canTransition(state, "resolved", true)).toBe(false);
    }
  });

  it("never lets the landlord withdraw somebody else's report", () => {
    for (const state of INCIDENT_STATES) {
      expect(canTransition(state, "withdrawn", true)).toBe(false);
    }
  });

  it("lets the landlord take it on and then say it is fixed", () => {
    expect(canTransition("reported", "in_progress", true)).toBe(true);
    expect(canTransition("in_progress", "awaiting_confirmation", true)).toBe(true);
  });

  /** Ya dijo que lo arregló: no le queda nada que hacer más que esperar. */
  it("gives the landlord nothing to press once they have said it is fixed", () => {
    expect(allowedTransitions("awaiting_confirmation", true)).toEqual([]);
  });

  it("lets the tenant confirm it or say it is still broken", () => {
    expect(canTransition("awaiting_confirmation", "resolved", false)).toBe(true);
    expect(canTransition("awaiting_confirmation", "in_progress", false)).toBe(true);
  });

  /** Una gotera que vuelve es la misma gotera: reabrir conserva la historia del primer arreglo. */
  it("lets the tenant reopen a resolved one", () => {
    expect(canTransition("resolved", "in_progress", false)).toBe(true);
  });

  it("closes a withdrawn one for good, for both sides", () => {
    expect(allowedTransitions("withdrawn", false)).toEqual([]);
    expect(allowedTransitions("withdrawn", true)).toEqual([]);
  });

  /** No hay transición de "esto no me toca a mí": eso es la pregunta de la responsabilidad. */
  it("offers nobody a way to declare whose fault it is", () => {
    for (const state of INCIDENT_STATES) {
      for (const isLandlord of [true, false]) {
        for (const to of allowedTransitions(state, isLandlord)) {
          expect(INCIDENT_STATES).toContain(to);
          expect(to).not.toBe(state);
        }
      }
    }
  });
});

describe("transitionRequiresNote", () => {
  /** Decir "sigue roto" obliga a decir qué sigue roto: es lo único que dice qué corregir. */
  it("requires a reason only for saying it is still broken", () => {
    expect(transitionRequiresNote("awaiting_confirmation", "in_progress")).toBe(true);
    expect(transitionRequiresNote("awaiting_confirmation", "resolved")).toBe(false);
    expect(transitionRequiresNote("reported", "in_progress")).toBe(false);
    expect(transitionRequiresNote("in_progress", "awaiting_confirmation")).toBe(false);
  });
});

describe("allAttachments", () => {
  it("puts the files of the report and of the thread in one list", () => {
    const reported = attachment("image/jpeg", "roto.jpg");
    const repaired = attachment("image/png", "arreglado.png");

    expect(
      allAttachments({
        attachments: [reported],
        updates: [update({ attachments: [repaired] }), update({ note: "sin archivos" })],
      }).map((one) => one.fileName),
    ).toEqual(["roto.jpg", "arreglado.png"]);
  });
});

describe("transitionLabel", () => {
  /*
   * Tres cosas distintas mueven un incidente a `in_progress`, y el botón tiene que decir cuál. La
   * primera versión llamaba a las tres "Está en arreglo", así que un incidente resuelto le ofrecía al
   * inquilino un botón que afirmaba que alguien ya lo estaba arreglando.
   */
  it("says which of the three moves to in_progress this is", () => {
    expect(transitionLabel("reported", "in_progress")).toBe("Está en arreglo");
    expect(transitionLabel("awaiting_confirmation", "in_progress")).toBe("Sigue sin arreglar");
    expect(transitionLabel("resolved", "in_progress")).toBe("Volvió a pasar");
  });

  it("names the rest from where they are going", () => {
    expect(transitionLabel("in_progress", "awaiting_confirmation")).toBe("Ya lo arreglé");
    expect(transitionLabel("awaiting_confirmation", "resolved")).toMatch(/Confirmar/);
    expect(transitionLabel("reported", "withdrawn")).toMatch(/Cerrar/);
  });

  /** Todo movimiento que el dominio ofrece tiene una etiqueta, y ninguna está vacía. */
  it("has a label for every move either party is ever offered", () => {
    for (const from of INCIDENT_STATES) {
      for (const isLandlord of [true, false]) {
        for (const to of allowedTransitions(from, isLandlord)) {
          expect(transitionLabel(from, to).length).toBeGreaterThan(3);
        }
      }
    }
  });
});
