import { describe, expect, it } from "vitest";

import { SERVER_ONLY_NAMESPACES, dictionaryFor } from "./dictionary";
import { LOCALES } from "./locale";

/** Every leaf of a nested object, with the path that reached it. */
function leaves(value: unknown, path = ""): readonly (readonly [string, unknown])[] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }

  return [[path, value]];
}

describe("the dictionary", () => {
  /**
   * **The assertion three separate 500s paid for.**
   *
   * Any namespace not named in `SERVER_ONLY_NAMESPACES` may be handed whole to a Client Component,
   * so every value in it has to survive the RSC boundary — and a function does not. It has happened
   * **four** times in this codebase: `language` carrying `switchTo`, `property` carrying `found`,
   * `auth` carrying `resetSentTo`, and `dossier` carrying `previewOf`. Each compiled cleanly and
   * took down every page that rendered it.
   *
   * The fourth is why this checks everything by default: the guard used to read an *allowlist*, so a
   * namespace nobody remembered to register was simply not checked. Forgetting now goes red here.
   *
   * Adding a parameterised entry to one of these namespaces turns this red immediately, which is
   * the point: the fix is to resolve it on the server and pass the finished string, or to split it
   * into the plain pieces around the value.
   */
  it("has no functions in any namespace that may cross to a Client Component", () => {
    const serverOnly = new Set<string>(SERVER_ONLY_NAMESPACES);

    for (const locale of LOCALES) {
      const dictionary = dictionaryFor(locale);

      for (const namespace of Object.keys(dictionary)) {
        if (serverOnly.has(namespace)) continue;

        for (const [path, value] of leaves(dictionary[namespace as keyof typeof dictionary])) {
          expect(typeof value, `${locale}.${namespace}.${path} is a ${typeof value}`).toBe("string");
        }
      }
    }
  });

  /**
   * The other half of the contract: the two languages hold the same keys.
   *
   * `en.ts` is annotated with `typeof es`, so a **missing** key already fails `pnpm typecheck`. What
   * a type cannot catch is a key present but empty — a translation started and left blank, which
   * renders as nothing at all rather than as an obvious hole.
   */
  it("has a non-empty value for every key, in every language", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of leaves(dictionaryFor(locale))) {
        if (typeof value === "function") continue;
        expect(value, `${locale}.${path}`).toBeTruthy();
      }
    }
  });

  /** And that they are actually different languages, not one copied over the other. */
  it("does not serve Spanish as English", () => {
    expect(dictionaryFor("es").nav.home).toBe("Inicio");
    expect(dictionaryFor("en").nav.home).toBe("Home");
    expect(dictionaryFor("es").auth.signIn).not.toBe(dictionaryFor("en").auth.signIn);
  });
});
