/**
 * What a listing says about itself outside this site.
 *
 * The assertion that matters most in here is the negative one: **no street and no coordinate ever
 * reach the structured data**. `tests/e2e/map.mjs` proves the rendered HTML does not carry the
 * exact point; this proves the object that gets serialised into it does not carry the address
 * either, which is the same rule one layer earlier and the layer where somebody would add a `geo`
 * field to silence a validator warning.
 */
import { describe, expect, it } from "vitest";

import {
  catalogJsonLd,
  catalogMetaDescription,
  catalogMetaTitle,
  clampText,
  propertyBreadcrumbJsonLd,
  propertyImageAlt,
  propertyJsonLd,
  propertyMetaDescription,
  propertyMetaTitle,
  DESCRIPTION_MAX,
  TITLE_MAX,
} from "./seo";
import type { Property } from "./property";

const PROPERTY: Property = {
  id: "abc123",
  landlordUid: "landlord-1",
  title: "Apartamento luminoso con balcón",
  description: "Hola. Un apartamento muy lindo, remodelado, con vista a la montaña.",
  type: "apartment",
  status: "available",
  rent: 1_300_000,
  adminFee: 100_000,
  areaM2: 68,
  bedrooms: 2,
  bathrooms: 1,
  parking: "private",
  stratum: 4,
  furnished: false,
  petsAllowed: true,
  minLeaseMonths: 12,
  availableFrom: "2026-10-01",
  area: {
    neighborhood: "Palermo",
    city: "Manizales",
    department: "Caldas",
    // La zona desafilada sí está en el documento público, y aun así no sale en el JSON-LD.
    approx: { lat: 5.0675, lng: -75.5175 },
  },
  slug: "apartamento-luminoso-con-balcon-manizales",
  photos: [{ path: "properties/landlord-1/a.jpg", url: "https://cdn.test/a.jpg" }],
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
};

describe("clampText", () => {
  it("leaves a short sentence exactly as it is", () => {
    expect(clampText("Apartamento en Palermo", 60)).toBe("Apartamento en Palermo");
  });

  it("collapses the whitespace a template literal leaves behind", () => {
    expect(clampText("Casa   grande\n  con patio", 60)).toBe("Casa grande con patio");
  });

  /*
   * Cortar a mitad de palabra se lee como roto, no como abreviado — y esta es la única frase que
   * alguien ve antes de decidir si abre el enlace.
   */
  it("cuts on a word boundary and marks the cut", () => {
    const cut = clampText("Apartamento luminoso con balcón y vista", 20);
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
    expect("Apartamento luminoso con balcón y vista".startsWith(cut.slice(0, -1))).toBe(true);
  });

  /* Una palabra sola más larga que el hueco no tiene borde donde cortar: se corta y ya. */
  it("still fits when there is no space to break on", () => {
    const cut = clampText("Aaaaaaaaaaaaaaaaaaaaaaaaaaaa", 10);
    expect(cut.length).toBeLessThanOrEqual(10);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("propertyMetaTitle", () => {
  it("says what it is, where it is and what it costs", () => {
    // El espacio tras el `$` que pone `Intl` es un espacio duro, no uno normal.
    expect(propertyMetaTitle(PROPERTY)).toBe(
      "Apartamento en arriendo en Palermo, Manizales · $\u00a01.400.000",
    );
  });

  /* El canon es la suma: publicar solo el arriendo y cobrar la administración aparte es la
     diferencia que el inquilino descubre al final. */
  it("prices the total, not the rent alone", () => {
    expect(propertyMetaTitle(PROPERTY)).toContain("1.400.000");
    expect(propertyMetaTitle(PROPERTY)).not.toContain("1.300.000");
  });

  /*
   * El título del anuncio es del propietario y suele venir en mayúsculas con emojis; lo que sale a
   * buscadores y a la vista previa de un enlace es la ficha, igual en todos los anuncios.
   */
  it("never uses the landlord's own headline", () => {
    const shouty: Property = { ...PROPERTY, title: "HERMOSO APTO REMODELADO 😍😍" };
    expect(propertyMetaTitle(shouty)).not.toContain("HERMOSO");
    expect(propertyMetaTitle(shouty)).not.toContain("😍");
  });

  /* Y cabe: el layout le pega " · miarriendoDIRECTO.com" detrás, así que pasarse cuesta la marca. */
  it("fits the budget even with a long neighbourhood and city", () => {
    const long: Property = {
      ...PROPERTY,
      area: { ...PROPERTY.area, neighborhood: "Ciudadela del Norte La Enea", city: "Villamaría" },
    };
    expect(propertyMetaTitle(long).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  /*
   * Y cuando hay que recortar se quita entero lo que sobra, en orden: primero el precio, después el
   * barrio. La ciudad no se toca — sin ella el título deja de decir dónde está el inmueble, que es
   * la pregunta anterior a cuánto cuesta. Recortando la cadena larga sin más salía
   * "…en Ciudadela del Norte La Enea…" y Villamaría desaparecía.
   */
  it("drops the price, then the neighbourhood, and never the city", () => {
    const long: Property = {
      ...PROPERTY,
      area: { ...PROPERTY.area, neighborhood: "Ciudadela del Norte La Enea", city: "Villamaría" },
    };
    const title = propertyMetaTitle(long);
    expect(title).toContain("Villamaría");
    expect(title).not.toContain("1.400.000");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  /* Con un barrio corto solo sobra el precio, y el barrio se queda. */
  it("keeps the neighbourhood when only the price is in the way", () => {
    const long: Property = {
      ...PROPERTY,
      rent: 12_000_000,
      area: { ...PROPERTY.area, neighborhood: "La Francia", city: "Villamaría" },
    };
    const title = propertyMetaTitle(long);
    expect(title).toContain("La Francia");
    expect(title).toContain("Villamaría");
    expect(title).not.toContain("12.100.000");
  });
});

describe("propertyMetaDescription", () => {
  it("carries the facts somebody compares on", () => {
    const description = propertyMetaDescription(PROPERTY);
    expect(description).toContain("Palermo, Manizales");
    expect(description).toContain("$ 1.400.000");
    expect(description).toContain("2 habitaciones");
    expect(description).toContain("1 baño");
    expect(description).toContain("68 m²");
  });

  it("says baño in the singular and baños in the plural", () => {
    expect(propertyMetaDescription({ ...PROPERTY, bathrooms: 2 })).toContain("2 baños");
    expect(propertyMetaDescription({ ...PROPERTY, bathrooms: 1 })).toContain("1 baño");
  });

  /* Un apartaestudio no tiene "0 habitaciones": tiene el espacio y ya. */
  it("does not offer zero bedrooms", () => {
    const studio = propertyMetaDescription({ ...PROPERTY, type: "studio", bedrooms: 0 });
    expect(studio).not.toContain("0 habitaciones");
    expect(studio).toContain("sin habitación separada");
  });

  it("fits what a search result and a link preview will show", () => {
    expect(propertyMetaDescription(PROPERTY).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  /* Lo que el propietario escribió es suyo y arranca casi siempre con un saludo. */
  it("does not paste the landlord's description into the preview", () => {
    expect(propertyMetaDescription(PROPERTY)).not.toContain("Hola");
  });
});

describe("propertyImageAlt", () => {
  it("describes the card for whoever cannot see it", () => {
    expect(propertyImageAlt(PROPERTY)).toBe("Apartamento en arriendo en Palermo, Manizales");
  });
});

describe("the catalog's own words", () => {
  it("names the city when there is one", () => {
    expect(catalogMetaTitle({ city: "Manizales" })).toBe("Arriendos en Manizales");
    expect(catalogMetaDescription({ city: "Manizales" })).toContain("en Manizales");
  });

  it("and speaks of the whole country when there is not", () => {
    expect(catalogMetaTitle({ city: null })).toContain("Colombia");
    expect(catalogMetaDescription({ city: null })).toContain("toda Colombia");
  });

  it("fits in a search result", () => {
    expect(catalogMetaDescription({ city: null }).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(catalogMetaDescription({ city: "Villamaría" }).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe("propertyJsonLd", () => {
  const url = "https://www.miarriendodirecto.com/inmuebles/apartamento-luminoso-con-balcon-manizales";
  const data = propertyJsonLd(PROPERTY, url);

  it("describes the page as a listing and the thing as somewhere to live", () => {
    expect(data["@type"]).toBe("RealEstateListing");
    expect((data.about as Record<string, unknown>)["@type"]).toBe("Apartment");
    expect((data.about as Record<string, unknown>).numberOfRooms).toBe(2);
  });

  it("maps a house to a house and anything commercial to plain accommodation", () => {
    const house = propertyJsonLd({ ...PROPERTY, type: "house" }, url);
    expect((house.about as Record<string, unknown>)["@type"]).toBe("House");
    const office = propertyJsonLd({ ...PROPERTY, type: "office" }, url);
    expect((office.about as Record<string, unknown>)["@type"]).toBe("Accommodation");
  });

  /*
   * Arrendar, no vender. Sin `businessFunction` la oferta se lee como el precio de compra del
   * inmueble, y `MON` es lo que dice que ese precio es por mes y no total.
   */
  it("says it is a lease, priced by the month, in pesos", () => {
    const offer = data.offers as Record<string, unknown>;
    expect(offer.businessFunction).toBe("https://schema.org/LeaseOut");
    expect(offer.price).toBe(1_400_000);
    expect(offer.priceCurrency).toBe("COP");
    expect((offer.priceSpecification as Record<string, unknown>).unitCode).toBe("MON");
  });

  /**
   * **La afirmación que sostiene todo el diseño de privacidad de este producto.**
   *
   * La calle vive en `properties/{id}/private/location` porque una coordenada precisa *es* la
   * dirección. Un bloque `geo` en los datos estructurados la entregaría por la puerta de atrás, y
   * es el sitio donde nadie mira: un `<script>` no se revisa al mirar una página. Ni siquiera va la
   * zona desafilada — invitaría al buscador a pintar el alfiler que este producto no pinta.
   */
  it("carries no address and no coordinate, anywhere in the tree", () => {
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("geo");
    expect(serialized).not.toContain("streetAddress");
    expect(serialized).not.toContain("5.06");
    expect(serialized).not.toContain("-75.5");
    expect(serialized).not.toContain("latitude");
  });

  it("publishes the city and the department, which the listing already says in words", () => {
    const address = (data.about as Record<string, unknown>).address as Record<string, unknown>;
    expect(address.addressLocality).toBe("Manizales");
    expect(address.addressRegion).toBe("Caldas");
    expect(address.addressCountry).toBe("CO");
  });

  /* Marcar valoraciones que no existen es el error de datos estructurados que trae una sanción. */
  it("invents no ratings and no expiry date", () => {
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("aggregateRating");
    expect(serialized).not.toContain("review");
    expect(serialized).not.toContain("priceValidUntil");
  });

  it("omits the image list rather than publishing an empty one", () => {
    expect(propertyJsonLd({ ...PROPERTY, photos: [] }, url).image).toBeUndefined();
  });

  it("serialises to JSON with nothing left over", () => {
    expect(() => JSON.stringify(data)).not.toThrow();
    expect(JSON.parse(JSON.stringify(data))["@id"]).toBe(url);
  });
});

describe("propertyBreadcrumbJsonLd", () => {
  const trail = propertyBreadcrumbJsonLd(
    PROPERTY,
    "https://www.miarriendodirecto.com",
    "/inmuebles",
    "/inmuebles/apartamento-luminoso-con-balcon-manizales",
  );

  /* Mismos dos enlaces que la página ofrece: un rastro que nombra una página a la que no se puede
     llegar desde aquí es un rastro que Google descarta. */
  it("mirrors the two links the page itself offers", () => {
    const items = trail.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    expect(items[0]!.item).toBe("https://www.miarriendodirecto.com/inmuebles");
    expect(items[1]!.item).toBe("https://www.miarriendodirecto.com/inmuebles?city=Manizales");
    expect(items[2]!.name).toBe(PROPERTY.title);
  });

  it("escapes a city with an accent into the query it would actually be linked with", () => {
    const accented = propertyBreadcrumbJsonLd(
      { ...PROPERTY, area: { ...PROPERTY.area, city: "Chinchiná" } },
      "https://x.test",
      "/inmuebles",
      "/inmuebles/x",
    );
    const items = accented.itemListElement as Record<string, unknown>[];
    expect(items[1]!.item).toBe("https://x.test/inmuebles?city=Chinchin%C3%A1");
  });
});

describe("catalogJsonLd", () => {
  const build = (page: number, items: readonly Property[] = [PROPERTY]) =>
    catalogJsonLd(
      items,
      { city: "Manizales", page },
      "https://x.test",
      "/inmuebles?city=Manizales",
      (slug) => `/inmuebles/${slug}`,
      6,
    );

  it("lists what is on the page, with absolute links", () => {
    const list = build(1).mainEntity as Record<string, unknown>;
    const items = list.itemListElement as Record<string, unknown>[];
    expect(list.numberOfItems).toBe(1);
    expect(items[0]!.url).toBe(`https://x.test/inmuebles/${PROPERTY.slug}`);
  });

  /*
   * Las posiciones cuentan desde donde empieza la página. Un `ItemList` que dice 1..6 en la página
   * cuatro le está diciendo al buscador que cuatro URLs distintas son los mismos seis resultados.
   */
  it("counts positions from where the page starts, not from one", () => {
    const items = (build(4).mainEntity as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[];
    expect(items[0]!.position).toBe(19);
  });

  it("survives an empty page without claiming there is something on it", () => {
    const list = build(1, []).mainEntity as Record<string, unknown>;
    expect(list.numberOfItems).toBe(0);
    expect(list.itemListElement).toEqual([]);
  });
});
