"use client";

import { useEffect, useRef, useState } from "react";
import { EraserIcon, TypeIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

/**
 * Draw your signature with the mouse, or with a finger.
 *
 * No library: pointer events cover mouse, pen and touch in one API, and a 2D canvas is the whole
 * of it. What a library would add here is a bezier smoother, and a signature is more recognisable
 * for being exactly the line the hand made.
 *
 * **Both parties draw, and it is required of both.** It used to be optional, on the reasoning that
 * a canvas cannot be operated with a keyboard and the code is what legally signs — so making it a
 * gate would have shut out anybody who cannot draw. That reasoning was right about the cost and
 * wrong about the fix: the cost is answered here, by **"Usar mi nombre como firma"**, which produces
 * the same stroke from the keyboard in one press. So there is no signer this stage cannot serve, and
 * the PDF both parties keep carries a visible signature instead of a blank line.
 *
 * The drawing is captured at twice the CSS size (`RESOLUTION`), because it ends up scaled into a
 * box on a PDF page and a 1:1 canvas stamps as a blurry line.
 */
const RESOLUTION = 2;

/**
 * La firma escrita, cuando se pulsa el botón: cursiva y con respaldos, porque ninguna de estas
 * fuentes está en todos los sistemas y un `font` que el navegador no resuelve cae en la de por
 * defecto — que es la del resto de la página y no se lee como una firma.
 */
const scriptFont = (size: number) =>
  `italic ${size}px "Segoe Script", "Brush Script MT", "Apple Chancery", "Lucida Handwriting", cursive`;

export function SignaturePad({
  onChange,
  signerName = "",
  disabled = false,
}: {
  /** The PNG data URL, or `""` once cleared. */
  readonly onChange: (dataUrl: string) => void;
  /**
   * The signer's name as their profile has it, for the keyboard path.
   *
   * Their **own** name and not free text: the stamped page already prints the name on record under
   * the stroke, and letting somebody type a different one there would put two names on one
   * signature. Empty hides the button rather than offering one that draws nothing.
   */
  readonly signerName?: string;
  readonly disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  /** El morado resuelto del token, guardado porque lo usan el trazo y el texto. */
  const ink = useRef("currentColor");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /*
     * The backing store is sized from the element's real box, so the stroke lands under the
     * pointer at any width. Done in an effect rather than with fixed attributes because the panel
     * is fluid and the box is narrower on a phone.
     */
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * RESOLUTION);
    canvas.height = Math.round(box.height * RESOLUTION);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(RESOLUTION, RESOLUTION);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    /*
     * El morado de marca, leído del token y no escrito a mano: un canvas 2D no acepta una variable
     * CSS, así que se resuelve su valor computado. El respaldo existe porque `getPropertyValue`
     * devuelve cadena vacía si la hoja de estilos todavía no se aplicó.
     */
    const brand = getComputedStyle(canvas).getPropertyValue("--brand-panel").trim();
    ink.current = brand || "currentColor";
    context.strokeStyle = ink.current;
    context.fillStyle = ink.current;
  }, []);

  function positionOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();

    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    /*
     * La captura hace que un trazo que se sale del recuadro siga dibujando en vez de cortarse a
     * mitad de letra. Va protegida porque `setPointerCapture` lanza `InvalidStateError` si el
     * puntero ya no está activo, y si eso aborta el handler el trazo no empieza nunca — que es
     * justo el fallo que se vio: el lienzo estaba, y no pintaba.
     */
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Sin captura se dibuja igual; solo se corta si el puntero sale del recuadro.
    }
    drawing.current = true;

    const { x, y } = positionOf(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const { x, y } = positionOf(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setHasInk(true);
    onChange(canvas.toDataURL("image/png"));
  }

  /**
   * La firma, escrita en vez de dibujada.
   *
   * **Este es el camino de teclado, y no es una versión menor**: sale el mismo PNG por el mismo
   * `onChange`, se estampa en el mismo recuadro y el registro que la acompaña —el código, la hora,
   * el hash del archivo— es idéntico. Existe porque el dibujo pasó a ser obligatorio, y un lienzo
   * no se opera con el teclado.
   */
  function writeName() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !signerName || disabled) return;

    const width = canvas.width / RESOLUTION;
    const height = canvas.height / RESOLUTION;
    context.clearRect(0, 0, width, height);

    context.fillStyle = ink.current;
    context.textAlign = "center";
    context.textBaseline = "middle";

    /*
     * Se reduce el cuerpo hasta que quepa, en vez de estirar el texto: una firma comprimida en
     * horizontal deja de parecer una firma. Nunca baja de 10 px, que es cuando el problema es el
     * nombre y no el tamaño.
     */
    let size = Math.round(height * 0.5);
    context.font = scriptFont(size);
    while (size > 10 && context.measureText(signerName).width > width * 0.9) {
      size -= 2;
      context.font = scriptFont(size);
    }

    context.fillText(signerName, width / 2, height / 2, width * 0.9);
    setHasInk(true);
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="space-y-2" data-slot="signature-pad">
      <canvas
        ref={canvasRef}
        /*
         * `touch-none` o el navegador se lleva el gesto para desplazar la página y el trazo sale a
         * pedazos. Es la única forma de dibujar con el dedo.
         */
        className="h-32 w-full touch-none rounded-lg border border-dashed border-border bg-background"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Dibuja tu firma"
      />
      <div className="flex flex-wrap items-center gap-2">
        {/*
          El camino de teclado va primero, y como control de verdad y no como enlace de última
          hora: para quien no puede dibujar es *la* forma de firmar, y una salida escondida al final
          de la fila es una salida que no se encuentra.
        */}
        {signerName && (
          <Button type="button" variant="brand" size="xl" disabled={disabled} onClick={writeName}>
            <TypeIcon aria-hidden="true" />
            Usar mi nombre como firma
          </Button>
        )}
        <Button type="button" variant="ghost" size="xl" disabled={disabled || !hasInk} onClick={clear}>
          <EraserIcon aria-hidden="true" />
          Borrar y volver a dibujar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {hasInk
          ? "Se dibujará en el contrato."
          : signerName
            ? "Obligatoria: con el ratón, con el dedo, o pulsando el botón para firmar con tu nombre."
            : "Obligatoria: con el ratón o con el dedo."}
      </p>
    </div>
  );
}
