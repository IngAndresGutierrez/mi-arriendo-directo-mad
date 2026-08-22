import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  fromDateParts,
  isRealDate,
  toDateParts,
  EMPTY_DATE_PARTS,
  MONTHS,
} from "./date-parts";

describe("MONTHS", () => {
  it("names the twelve, in Spanish, in order", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("Enero");
    expect(MONTHS[4]).toBe("Mayo");
    expect(MONTHS[11]).toBe("Diciembre");
  });
});

describe("toDateParts", () => {
  it("splits a stored date, keeping the padding", () => {
    expect(toDateParts("1994-05-03")).toEqual({ year: "1994", month: "05", day: "03" });
  });

  // Half-parsing a malformed value is how a form silently loses a field.
  it("returns nothing for anything that is not a stored date", () => {
    expect(toDateParts("")).toEqual(EMPTY_DATE_PARTS);
    expect(toDateParts("3/5/1994")).toEqual(EMPTY_DATE_PARTS);
    expect(toDateParts("1994-5-3")).toEqual(EMPTY_DATE_PARTS);
  });
});

describe("isRealDate", () => {
  it("knows how long each month is", () => {
    expect(isRealDate(2026, 1, 31)).toBe(true);
    expect(isRealDate(2026, 4, 31)).toBe(false);
    expect(isRealDate(2026, 2, 29)).toBe(false);
  });

  it("knows which years are leap years, including the century rule", () => {
    expect(isRealDate(2024, 2, 29)).toBe(true);
    expect(isRealDate(1900, 2, 29)).toBe(false);
    expect(isRealDate(2000, 2, 29)).toBe(true);
  });

  it("rejects what is not a date at all", () => {
    expect(isRealDate(1994, 0, 10)).toBe(false);
    expect(isRealDate(1994, 13, 10)).toBe(false);
    expect(isRealDate(1994, 5, 0)).toBe(false);
    expect(isRealDate(Number.NaN, 5, 3)).toBe(false);
  });
});

describe("fromDateParts", () => {
  it("joins the three back into a stored date", () => {
    expect(fromDateParts({ day: "3", month: "05", year: "1994" })).toBe("1994-05-03");
    expect(fromDateParts({ day: "03", month: "5", year: "1994" })).toBe("1994-05-03");
  });

  // A half-filled date is not a date. Guessing here is how a form stores something nobody typed.
  it("gives nothing while the three are not complete", () => {
    expect(fromDateParts({ day: "3", month: "05", year: "" })).toBe("");
    expect(fromDateParts({ day: "", month: "05", year: "1994" })).toBe("");
    expect(fromDateParts({ day: "3", month: "", year: "1994" })).toBe("");
    expect(fromDateParts({ day: "3", month: "05", year: "94" })).toBe("");
  });

  it("gives nothing for a day that does not exist in that month", () => {
    expect(fromDateParts({ day: "31", month: "02", year: "1994" })).toBe("");
    expect(fromDateParts({ day: "29", month: "02", year: "2024" })).toBe("2024-02-29");
  });

  it("round-trips", () => {
    expect(fromDateParts(toDateParts("1994-05-03"))).toBe("1994-05-03");
  });
});

describe("digitsOnly", () => {
  it("keeps digits and caps how many", () => {
    expect(digitsOnly("03", 2)).toBe("03");
    expect(digitsOnly("3a", 2)).toBe("3");
    expect(digitsOnly("199412", 4)).toBe("1994");
    expect(digitsOnly("3 de mayo", 2)).toBe("3");
  });
});
