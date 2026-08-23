"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

import {
  spotProblem,
  CONTRACT_PARTIES,
  CONTRACT_PARTY_LABELS,
  SPOT_DEFAULT_HEIGHT,
  SPOT_DEFAULT_WIDTH,
  type ContractParty,
  type SignatureSpot,
} from "../domain/contract";

/**
 * Where each party signs, marked by clicking on the page.
 *
 * **This is the only reason `pdfjs-dist` is in the bundle**, which is why the whole component is
 * behind a `next/dynamic` boundary and only the landlord, only on this stage, ever downloads it.
 * `CLAUDE.md` records what a careless import cost once: 630 KB of Firebase SDK on the login screen.
 *
 * Coordinates come out **normalised to 0..1** against the rendered page. The landlord's screen
 * width is not part of the record: the stamping happens server-side against the real page size, and
 * storing pixels would tie the box to the zoom of whatever browser placed it.
 */
export function SignaturePlacer({
  url,
  spots,
  onChange,
  disabled = false,
}: {
  /** The contract, by the signed URL the server produced. */
  readonly url: string;
  readonly spots: readonly SignatureSpot[];
  readonly onChange: (update: (current: readonly SignatureSpot[]) => readonly SignatureSpot[]) => void;
  readonly disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [placing, setPlacing] = useState<ContractParty>("landlord");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /*
   * El efecto lanza el trabajo y el `setState` ocurre en el callback, que es el único patrón que
   * un efecto debería usar: sincronizar con un sistema externo y reaccionar a su respuesta. La
   * bandera `alive` es lo que evita que un render viejo pise al nuevo cuando alguien pasa páginas
   * rápido — el `await` del PDF puede tardar más que el clic siguiente.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;
    renderContractPage({ url, page, canvas, width: boxRef.current?.clientWidth ?? 640 })
      .then((total) => {
        if (!alive) return;
        setPages(total);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        /*
         * Se registra la causa. La primera versión hacía `catch {}` y mostraba solo la frase
         * amable: cuando el visor falló de verdad no había forma de saber por qué, que es el peor
         * sitio donde ahorrarse una línea.
         */
        console.error("no se pudo renderizar el contrato:", cause);
        // Un PDF que no se puede mostrar no debe dejar la etapa sin salida: se firma sin dibujo.
        setError("No pudimos mostrar el contrato para marcar la firma. Puedes firmar sin dibujarla.");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page, url]);

  /** Cambiar de página es una acción: la espera se anuncia donde se origina. */
  function goTo(next: number) {
    setLoading(true);
    setError(null);
    setPage(next);
  }

  function place(event: React.MouseEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const box = event.currentTarget.getBoundingClientRect();

    /*
     * El clic marca el **centro** del recuadro, no su esquina: apuntar a una línea de firma es
     * apuntar al medio de ella, y obligar a acertar la esquina superior izquierda de una caja
     * invisible es pedir precisión sobre algo que no se ve.
     */
    const centerX = (event.clientX - box.left) / box.width;
    const centerY = (event.clientY - box.top) / box.height;

    const spot: SignatureSpot = {
      party: placing,
      page,
      x: clamp(centerX - SPOT_DEFAULT_WIDTH / 2, 1 - SPOT_DEFAULT_WIDTH),
      y: clamp(centerY - SPOT_DEFAULT_HEIGHT / 2, 1 - SPOT_DEFAULT_HEIGHT),
      width: SPOT_DEFAULT_WIDTH,
      height: SPOT_DEFAULT_HEIGHT,
    };

    // La misma función pura que valida el servidor: la frase que se lee es la que él diría.
    const problem = spotProblem(spot);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    /*
     * Actualización funcional: dos clics muy seguidos —o un doble clic— caen en el mismo render, y
     * calcular el array nuevo desde la prop haría que el segundo perdiera el primero.
     */
    onChange((current) => [...current.filter((each) => each.party !== placing), spot]);

    /*
     * Y se pasa a la otra parte, que con dos es siempre la contraria: encadenarlas evita un clic de
     * más y no hace falta consultar el array para saber cuál falta.
     */
    const other = CONTRACT_PARTIES.find((party) => party !== placing);
    if (other) setPlacing(other);
  }

  const onThisPage = spots.filter((spot) => spot.page === page);

  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Qué firma estás colocando</legend>
        {CONTRACT_PARTIES.map((party) => {
          const marked = spots.some((spot) => spot.party === party);

          return (
            <Button
              key={party}
              type="button"
              variant={placing === party ? "brand" : "ghost"}
              size="xl"
              aria-pressed={placing === party}
              disabled={disabled}
              onClick={() => setPlacing(party)}
            >
              {marked ? "✓ " : ""}
              {CONTRACT_PARTY_LABELS[party]}
            </Button>
          );
        })}
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Haz clic en el contrato donde firma {CONTRACT_PARTY_LABELS[placing].toLowerCase()}.
      </p>

      <div ref={boxRef} className="relative overflow-hidden rounded-lg border border-border">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onClick={place}
          aria-label={`Página ${page + 1} del contrato. Haz clic para marcar dónde firma ${CONTRACT_PARTY_LABELS[placing]}.`}
        />
        {/* Los recuadros ya marcados, sobre la página, en porcentajes: se mueven con ella. */}
        {onThisPage.map((spot) => (
          <span
            key={spot.party}
            /* Asidero estable: colgarse de una clase de Tailwind cuenta también los botones que
               comparten esa clase, y eso ya pasó una vez. */
            data-slot="signature-spot"
            className="pointer-events-none absolute rounded border-2 border-brand-panel bg-brand-panel/10"
            style={{
              left: `${spot.x * 100}%`,
              top: `${spot.y * 100}%`,
              width: `${spot.width * 100}%`,
              height: `${spot.height * 100}%`,
            }}
          >
            <span className="absolute -top-5 left-0 rounded bg-brand-panel px-1 text-[10px] text-brand-panel-foreground">
              {CONTRACT_PARTY_LABELS[spot.party]}
            </span>
          </span>
        ))}
        {loading && (
          <p role="status" aria-label="Cargando el contrato" className="p-6 text-sm text-muted-foreground">
            Cargando el contrato…
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Páginas del contrato" className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xl"
            disabled={page === 0}
            onClick={() => goTo(Math.max(0, page - 1))}
          >
            <ChevronLeftIcon aria-hidden="true" />
            Anterior
          </Button>
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {pages}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xl"
            disabled={page >= pages - 1}
            onClick={() => goTo(Math.min(pages - 1, page + 1))}
          >
            Siguiente
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </nav>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/**
 * Renders one page of the PDF onto the canvas and answers how many pages it has.
 *
 * Outside the component and free of React on purpose: an effect should hand its state updates to a
 * callback, not to a function that reaches back into the component. Here there is nothing to reach.
 *
 * The worker is pointed at the copy that ships with the package. Without that, pdf.js fetches one
 * from a CDN — which the product's CSP would refuse, and which would put a third party in the path
 * of a lease.
 */
async function renderContractPage(input: {
  readonly url: string;
  readonly page: number;
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
}): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const document_ = await pdfjs.getDocument({ url: input.url }).promise;
  const rendered = await document_.getPage(input.page + 1);

  const base = rendered.getViewport({ scale: 1 });
  const viewport = rendered.getViewport({ scale: input.width / base.width });

  input.canvas.width = Math.round(viewport.width);
  input.canvas.height = Math.round(viewport.height);

  const context = input.canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");

  await rendered.render({ canvas: input.canvas, canvasContext: context, viewport }).promise;

  return document_.numPages;
}
