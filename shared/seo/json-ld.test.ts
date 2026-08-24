import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "./json-ld";

/**
 * The content of a `<script>` is **not** HTML-escaped by the browser, so anything that can produce
 * the byte sequence `</script` inside it closes the tag and turns the rest into markup. A landlord
 * types the property title.
 */
describe("serializeJsonLd", () => {
  it("still parses back to exactly what went in", () => {
    const data = { "@type": "RealEstateListing", name: "Casa en Palermo", rooms: 3 };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("cannot close the script tag it lives in", () => {
    const escaped = serializeJsonLd({ name: "Casa </script><img src=x onerror=alert(1)>" });
    expect(escaped).not.toContain("</script");
    expect(escaped).not.toContain("<");
    // Y sigue siendo el mismo texto una vez leído: escapar no es censurar.
    expect(JSON.parse(escaped).name).toBe("Casa </script><img src=x onerror=alert(1)>");
  });

  /* `<!--` dentro de un script abre un comentario para el analizador de HTML y se traga el resto. */
  it("cannot open an HTML comment either", () => {
    const escaped = serializeJsonLd({ name: "Apartamento <!-- barato -->" });
    expect(escaped).not.toContain("<!--");
    expect(escaped).not.toContain(">");
    expect(JSON.parse(escaped).name).toBe("Apartamento <!-- barato -->");
  });

  it("escapes the ampersand that an HTML entity would need", () => {
    const escaped = serializeJsonLd({ name: "Dueño & arrendatario" });
    expect(escaped).not.toContain("&");
    expect(JSON.parse(escaped).name).toBe("Dueño & arrendatario");
  });

  /* Los acentos y las eñes no son un problema y no se tocan: el documento es UTF-8. */
  it("leaves accents alone", () => {
    expect(serializeJsonLd({ city: "Chinchiná" })).toContain("Chinchiná");
  });
});
