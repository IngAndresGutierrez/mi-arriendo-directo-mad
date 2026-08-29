/**
 * The rental notice.
 *
 * A satori tree is the one thing in this repository that neither a unit test nor a browser driver
 * can look inside: it is laid out into a PNG on the server, and what comes back is pixels. So
 * everything about the notice that could be *wrong* rather than merely ugly lives in `poster.ts`
 * and is asserted here — above all the two negatives, that the address and the phone number are
 * not on it, and the rule that a listing nobody can open does not get a poster.
 */
import { describe, expect, it } from "vitest";

import { propertyLabels } from "./labels";
import {
  POSTER_FORMATS,
  POSTER_SIZES,
  POSTER_FORMAT_SEGMENTS,
  posterFormatFromSegment,
  posterBlocker,
  posterContent,
  posterQrTarget,
  posterReadableUrl,
} from "./poster";
import type { Property } from "./property";

const ORIGIN = "https://www.miarriendodirecto.com";

const MONEY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PROPERTY: Property = {
  id: "abc123",
  landlordUid: "landlord-1",
  title: "HERMOSO APTO REMODELADO 😍",
  description: "Hola. Un apartamento muy lindo, con vista a la montaña.",
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
    approx: { lat: 5.0675, lng: -75.5175 },
  },
  slug: "apartamento-luminoso-con-balcon-manizales",
  photos: [{ path: "properties/landlord-1/a.jpg", url: "https://cdn.test/a.jpg" }],
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
};

const content = (property: Property = PROPERTY, locale: "es" | "en" = "es") =>
  posterContent(property, { locale, labels: propertyLabels(locale), origin: ORIGIN, money: MONEY });

describe("posterBlocker", () => {
  /**
   * The rule the whole feature rests on: a code printed on paper has to open something.
   *
   * Only an `available` listing has a public page — everything else answers `null` to anybody but
   * the owner — so a poster made from a draft is a wall full of 404s that its owner cannot detect,
   * because for them the link works.
   */
  it("refuses a draft, whose link only resolves for its owner", () => {
    expect(posterBlocker({ status: "draft" })).toBe("draft");
  });

  it("refuses a listing that is no longer public", () => {
    expect(posterBlocker({ status: "rented" })).toBe("unavailable");
    expect(posterBlocker({ status: "inactive" })).toBe("unavailable");
  });

  it("allows the one status that has a public page", () => {
    expect(posterBlocker({ status: "available" })).toBeNull();
  });
});

describe("posterQrTarget", () => {
  it("is the listing's own public URL, absolute", () => {
    expect(posterQrTarget(ORIGIN, "casa-en-palermo-manizales", "es")).toBe(
      `${ORIGIN}/inmuebles/casa-en-palermo-manizales`,
    );
  });

  /** A notice generated on the English side opens the English listing. */
  it("carries the locale prefix, and only English has one", () => {
    expect(posterQrTarget(ORIGIN, "casa-en-palermo-manizales", "en")).toBe(
      `${ORIGIN}/en/inmuebles/casa-en-palermo-manizales`,
    );
  });

  /**
   * Nothing is appended. A campaign parameter would make the printed line below the code
   * untypeable and the link itself read as untrustworthy where these get shared — the same reason
   * the slug carries no id.
   */
  it("adds nothing to the URL", () => {
    const target = posterQrTarget(ORIGIN, "casa-en-palermo-manizales", "es");

    expect(target).not.toContain("?");
    expect(target).not.toContain("#");
  });
});

describe("posterReadableUrl", () => {
  it("drops the scheme and the www, and stays the same link", () => {
    expect(posterReadableUrl(`${ORIGIN}/inmuebles/casa-en-palermo-manizales`)).toBe(
      "miarriendodirecto.com/inmuebles/casa-en-palermo-manizales",
    );
  });

  it("leaves a host that is not www alone", () => {
    expect(posterReadableUrl("https://mad-git-x.vercel.app/inmuebles/casa")).toBe(
      "mad-git-x.vercel.app/inmuebles/casa",
    );
  });
});

describe("posterContent", () => {
  /**
   * **The two negatives, and they are the reason this feature was allowed to exist at all.**
   *
   * A poster is a file, and the point of the feature is that the file gets shared onward — so
   * anything on it is published in a way that cannot be withdrawn. The street lives in
   * `properties/{id}/private/location`; the landlord's phone lives on their profile; neither is
   * reachable from a `Property`, and this asserts that nothing in the resolved content smuggles a
   * fragment of either through the neighbourhood label or the URL.
   */
  it("carries no address and no phone number anywhere in it", () => {
    const printed = JSON.stringify(content());

    expect(printed).not.toContain("Calle");
    expect(printed).not.toContain("landlord-1");
    expect(printed).not.toMatch(/\+?57\s?3\d{9}/);
    /* The blunted coordinate is on the public document and still does not belong on paper. */
    expect(printed).not.toContain("5.0675");
    expect(printed).not.toContain("-75.5175");
  });

  /**
   * The landlord's headline is not used, exactly as in the `<title>`. "HERMOSO APTO REMODELADO 😍"
   * is neither specific nor comparable, and at two metres on a wall the fact sheet is what sells.
   */
  it("uses the fact sheet, never the landlord's own headline", () => {
    const resolved = content();

    expect(JSON.stringify(resolved)).not.toContain("HERMOSO");
    expect(resolved.kind).toBe("Apartamento");
    expect(resolved.where).toBe("Palermo, Manizales");
  });

  /** The price is the total the tenant pays — rent plus administration — as everywhere else. */
  it("prices the total, not the rent alone", () => {
    expect(content().price).toBe(MONEY.format(1_400_000));
  });

  /** "0 habitaciones" reads as a mistake on a printed sheet. The type is the honest answer. */
  it("names a studio instead of counting its bedrooms", () => {
    const studio: Property = { ...PROPERTY, type: "studio", bedrooms: 0 };

    expect(content(studio).facts[0]).toBe("Apartaestudio");
    expect(content(studio, "en").facts[0]).toBe("Studio");
  });

  it("keeps the counted rooms when there are any", () => {
    expect(content().facts).toEqual(["2 habitaciones", "1 baño", "68 m²"]);
  });

  /** No photo is a different composition, and the drawing needs to be able to tell. */
  it("reports the absence of a cover rather than an empty string", () => {
    expect(content().photoUrl).toBe("https://cdn.test/a.jpg");
    expect(content({ ...PROPERTY, photos: [] }).photoUrl).toBeNull();
  });

  it("speaks the language it was asked for", () => {
    expect(content(PROPERTY, "es").headline).toBe("SE ARRIENDA");
    expect(content(PROPERTY, "en").headline).toBe("FOR RENT");
    expect(content(PROPERTY, "en").target).toContain("/en/inmuebles/");
  });
});

describe("the caption", () => {
  /**
   * **The mechanism of the social format, so it is asserted like one.**
   *
   * The square carries no QR — nobody scans a code off the phone they are reading it on — so the
   * only route from a post to the listing is this text. If it loses the link it is a fact sheet
   * about a flat nobody can find.
   */
  it("carries the link", () => {
    expect(content().shareText).toContain(`${ORIGIN}/inmuebles/${PROPERTY.slug}`);
    expect(content(PROPERTY, "en").shareText).toContain(`${ORIGIN}/en/inmuebles/${PROPERTY.slug}`);
  });

  /** And the same fact sheet the image shows, so the post and the picture do not disagree. */
  it("says what the poster says", () => {
    const caption = content().shareText;

    expect(caption).toContain("Palermo, Manizales");
    expect(caption).toContain(MONEY.format(1_400_000));
    expect(caption).toContain("2 habitaciones · 1 baño · 68 m²");
  });

  /**
   * **Not clamped**, unlike `propertyMetaDescription`, which shares the sentence with it. 160
   * characters is a fact about what a search result shows; a caption in a WhatsApp group is not a
   * search result, and trimming it there would publish a fact sheet ending in an ellipsis.
   */
  it("is not truncated the way the search-result sentence is", () => {
    const caption = content().shareText;

    expect(caption).toContain("sin comisión de inmobiliaria");
    expect(caption).not.toContain("…");
  });

  /** The two negatives again, in the one place a landlord will paste by hand. */
  it("carries no address and no phone number", () => {
    const caption = content().shareText;

    expect(caption).not.toContain("Calle");
    expect(caption).not.toContain("landlord-1");
    expect(caption).not.toMatch(/\+?57\s?3\d{9}/);
  });

  it("is written in the language it was asked for", () => {
    expect(content(PROPERTY, "en").shareText).toContain("for rent");
    expect(content(PROPERTY, "en").shareText).not.toContain("en arriendo");
  });
});

describe("the two prompts", () => {
  /**
   * Each format's closing band says the thing that is true of it, and they are separate strings
   * rather than one because they describe two different mechanisms — scanning, and typing or
   * tapping a link. A single sentence covering both would tell somebody holding a phone to scan.
   */
  it("keeps the scan prompt and the link prompt apart", () => {
    const resolved = content();

    expect(resolved.scanPrompt).toContain("Escanea");
    expect(resolved.linkPrompt).not.toContain("Escanea");
    expect(resolved.linkPrompt).not.toBe(resolved.scanPrompt);
  });
});

describe("the formats", () => {
  it("resolves exactly the two segments that exist, and nothing else", () => {
    expect(posterFormatFromSegment("pared")).toBe("wall");
    expect(posterFormatFromSegment("redes")).toBe("social");
    /* The English key is not the segment: a URL is Spanish, like every other path here. */
    expect(posterFormatFromSegment("wall")).toBeNull();
    expect(posterFormatFromSegment("historia")).toBeNull();
    expect(posterFormatFromSegment(undefined)).toBeNull();
    expect(posterFormatFromSegment("")).toBeNull();
  });

  /** Every format has a segment, and the round trip holds — otherwise one of them is unreachable. */
  it("gives every format a segment that resolves back to it", () => {
    for (const format of POSTER_FORMATS) {
      expect(posterFormatFromSegment(POSTER_FORMAT_SEGMENTS[format])).toBe(format);
    }
  });

  /** A4 at 150 dpi, and the square every feed crops to. Both sized for what they are posted on. */
  it("is A4 portrait for the wall and a square for a feed", () => {
    expect(POSTER_SIZES.wall.height).toBeGreaterThan(POSTER_SIZES.wall.width);
    expect(POSTER_SIZES.wall.width / POSTER_SIZES.wall.height).toBeCloseTo(210 / 297, 2);
    expect(POSTER_SIZES.social.width).toBe(POSTER_SIZES.social.height);
  });
});
