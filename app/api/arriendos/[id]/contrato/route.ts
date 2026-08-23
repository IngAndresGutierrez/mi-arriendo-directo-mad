import { getApplicationFor, type Application } from "@/features/application";
import { requireCompleteProfile } from "@/features/profile";
import { adminStorage } from "@/shared/firebase/admin";

/**
 * The contract, streamed from **our own origin**.
 *
 * ## Why this exists
 *
 * The panel already had a signed Storage URL, and for a link or a download that is enough. But the
 * signature placer hands the file to `pdf.js`, which **fetches** it — and a Firebase Storage bucket
 * sends no `Access-Control-Allow-Origin`, so the browser blocks it. `<a href>` and `<img src>` do
 * not need CORS; `fetch` does. The viewer was failing for that reason alone, silently, from the day
 * it was written.
 *
 * The alternative was a CORS policy on the bucket, which would mean opening a Google-hosted origin
 * to our web app for every object in it. Streaming through here keeps the bucket closed, keeps the
 * PDF same-origin so the CSP stays tight, and — the part that matters most — means the signed URL is
 * never handed to a script at all.
 *
 * ## What it checks
 *
 * The same question the page asks: is the caller a party to this process? `getApplicationFor`
 * answers `null` for a stranger, which is the same answer as "no such process" — so a caller cannot
 * tell an id that exists from one that does not, and this route inherits that property for free.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const user = await requireCompleteProfile();

  const application: Application | null = await getApplicationFor(id, user.uid);
  const path = application?.contract?.document?.path;

  if (!path) {
    // A stranger and a process with no contract get the same answer, on purpose.
    return new Response("No encontrado", { status: 404 });
  }

  try {
    const [file] = await adminStorage().bucket().file(path).download();

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": application?.contract?.document?.contentType ?? "application/pdf",
        /*
         * `no-store`: the response is decided by who is asking, so a shared cache holding it would
         * be a lease served to the next person through the same proxy.
         */
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("could not stream the contract:", error instanceof Error ? error.message : error);

    return new Response("No pudimos leer el contrato", { status: 502 });
  }
}
