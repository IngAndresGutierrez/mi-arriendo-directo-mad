/**
 * A `<script type="application/ld+json">`, written once.
 *
 * There is no other way to put structured data on a page — React escapes text nodes, so a plain
 * `{JSON.stringify(data)}` between tags ships `&quot;` where a machine expects `"` and every
 * validator reads nothing. `dangerouslySetInnerHTML` is the documented answer, and the word
 * "dangerously" is earned: **the content of a `<script>` is not HTML-escaped by the browser**, so a
 * property title containing `</script>` would close the tag and everything after it would be parsed
 * as markup. A landlord types the title.
 *
 * So `<` is escaped as `<`, which is a legal JSON escape for it — the parsed value is
 * identical and the sequence `</script` can no longer appear. `&` and `>` go with it, because
 * `<!--` inside a script starts a comment in the HTML parser and can swallow the rest of the block.
 *
 * The component renders nothing visible; it exists so the escaping lives in one file rather than in
 * each page that wanted a `<script>`.
 */

/** Anything that survives `JSON.stringify` unchanged. */
type Serializable = { readonly [key: string]: unknown };

/** JSON that is safe to sit inside a `<script>` element. */
export function serializeJsonLd(data: Serializable): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ data }: { readonly data: Serializable }) {
  return (
    <script
      type="application/ld+json"
      // Escaped above. The tag has no other content and nothing here is read back.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
