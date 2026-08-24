/**
 * What went wrong uploading a file, in words the person can act on.
 *
 * The same job `shared/auth/errors.ts` does for Auth, and it exists for the same reason that one
 * does: a raw Firebase code is not something to show anybody, and a single catch-all is not much
 * better. Every uploader in this product used to end in "No pudimos subir el archivo. Revisa tu
 * conexión e inténtalo de nuevo." — which is **the wrong sentence for the most likely failure**.
 * The first time incident attachments were tried against the real project the rules for their path
 * had not been deployed yet, so Cloud Storage answered `storage/unauthorized`, and the screen told
 * somebody with a perfectly good connection to check their connection. They would have checked it
 * for ever.
 *
 * Pure on purpose: it takes the `code` off an error rather than the error, so it needs no SDK import
 * and can be unit-tested without one.
 */

/** The codes worth their own sentence. Anything else falls back to the generic one. */
const MESSAGES: Readonly<Record<string, string>> = {
  /*
   * The rules said no. Almost always one of three things: the rules for this path are not deployed,
   * the file is over the limit the rules enforce, or its type is not one they accept — Cloud Storage
   * does not say which, so the sentence must not pretend to know.
   */
  "storage/unauthorized": "No tienes permiso para subir este archivo. Si acaba de pasar con todos, avísanos por soporte.",
  /** The web SDK's own session, which is not the same as the server's cookie. */
  "storage/unauthenticated": "Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.",
  "storage/quota-exceeded": "No hay espacio para guardar el archivo ahora mismo. Avísanos por soporte.",
  /** The upload really did keep failing: this is the one case where the connection is the answer. */
  "storage/retry-limit-exceeded":
    "La subida se quedó a medias. Revisa tu conexión e inténtalo de nuevo.",
  "storage/canceled": "La subida se canceló.",
  "storage/invalid-checksum": "El archivo llegó incompleto. Vuelve a intentarlo.",
};

const FALLBACK = "No pudimos subir el archivo. Inténtalo de nuevo.";

/**
 * Reads the `code` off whatever was thrown and answers a sentence.
 *
 * `unknown` because that is what a `catch` gives you, and the shape of a rejected upload is not
 * something to assume: it may be a `FirebaseError`, a `TypeError` from somewhere else in the chain,
 * or a string.
 */
export function storageErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  return MESSAGES[code] ?? FALLBACK;
}
