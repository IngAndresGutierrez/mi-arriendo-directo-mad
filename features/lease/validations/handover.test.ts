import { describe, expect, it } from "vitest";

import { MAX_AREA_PHOTOS, MAX_HANDOVER_AREAS } from "../domain/handover";
import { handoverDraftSchema, handoverObjectionSchema } from "./handover";

const photo = {
  path: "handovers/u1/1.jpg",
  fileName: "cocina.jpg",
  contentType: "image/jpeg",
  bytes: 1000,
};

const area = {
  id: "a1",
  name: "Cocina",
  condition: "good",
  note: "Todo funciona.",
  photos: [photo],
};

describe("handoverDraftSchema", () => {
  it("acepta un acta con un espacio bien descrito", () => {
    const parsed = handoverDraftSchema.safeParse({ areas: [area] });

    expect(parsed.success).toBe(true);
  });

  /**
   * Lo obligatorio es el nombre y el estado: son las dos cosas contra las que una devolución se
   * compara seis meses después. La nota y las fotos no, porque un formulario que exige una frase
   * por habitación recibe "ok" por habitación.
   */
  it("no exige nota ni fotos", () => {
    const parsed = handoverDraftSchema.safeParse({
      areas: [{ id: "a1", name: "Balcón", condition: "fair" }],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.areas[0]?.note).toBe("");
    expect(parsed.data?.areas[0]?.photos).toEqual([]);
  });

  it("exige nombre y estado", () => {
    expect(handoverDraftSchema.safeParse({ areas: [{ ...area, name: "  " }] }).success).toBe(false);
    expect(handoverDraftSchema.safeParse({ areas: [{ ...area, condition: "regular" }] }).success).toBe(
      false,
    );
  });

  /** Un acta sin espacios no es el borrador de nada, y la pantalla no tendría qué dibujar. */
  it("rechaza un acta vacía", () => {
    expect(handoverDraftSchema.safeParse({ areas: [] }).success).toBe(false);
  });

  it("pone techo a los espacios y a las fotos de cada uno", () => {
    const muchos = Array.from({ length: MAX_HANDOVER_AREAS + 1 }, (_, i) => ({ ...area, id: `a${i}` }));
    const muchasFotos = { ...area, photos: Array.from({ length: MAX_AREA_PHOTOS + 1 }, () => photo) };

    expect(handoverDraftSchema.safeParse({ areas: muchos }).success).toBe(false);
    expect(handoverDraftSchema.safeParse({ areas: [muchasFotos] }).success).toBe(false);
  });

  /** Sin video: el acta compara paredes, y dos videos de una pared se comparan peor que dos fotos. */
  it("rechaza un archivo que no es una foto", () => {
    const conVideo = { ...area, photos: [{ ...photo, contentType: "video/mp4" }] };

    expect(handoverDraftSchema.safeParse({ areas: [conVideo] }).success).toBe(false);
  });

  it("rechaza una foto de más de 8 MB", () => {
    const pesada = { ...area, photos: [{ ...photo, bytes: 9 * 1024 * 1024 }] };

    expect(handoverDraftSchema.safeParse({ areas: [pesada] }).success).toBe(false);
  });
});

describe("handoverObjectionSchema", () => {
  /** Una objeción sin palabras es un "no" sobre el que el propietario no puede hacer nada. */
  it("exige que diga qué no coincide", () => {
    expect(handoverObjectionSchema.safeParse({ note: "no" }).success).toBe(false);
    expect(handoverObjectionSchema.safeParse({ note: "" }).success).toBe(false);
  });

  it("acepta una objeción con motivo, con fotos o sin ellas", () => {
    expect(
      handoverObjectionSchema.safeParse({ note: "La grieta del baño ya estaba antes." }).success,
    ).toBe(true);
    expect(
      handoverObjectionSchema.safeParse({
        note: "La grieta del baño ya estaba antes.",
        photos: [photo],
      }).success,
    ).toBe(true);
  });
});
