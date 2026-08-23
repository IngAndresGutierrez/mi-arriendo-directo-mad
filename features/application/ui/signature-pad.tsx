"use client";

import { useEffect, useRef, useState } from "react";
import { EraserIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

/**
 * Draw your signature with the mouse, or with a finger.
 *
 * No library: pointer events cover mouse, pen and touch in one API, and a 2D canvas is the whole
 * of it. What a library would add here is a bezier smoother, and a signature is more recognisable
 * for being exactly the line the hand made.
 *
 * **A canvas is not operable with a keyboard, and that is not solved by trying harder.** So this is
 * offered as an addition, never as the gate: the one-time code is what signs, and the panel lets
 * anybody sign without drawing. That is the accessible path, and it is the same path — not a
 * lesser one bolted on the side.
 *
 * The drawing is captured at twice the CSS size (`RESOLUTION`), because it ends up scaled into a
 * box on a PDF page and a 1:1 canvas stamps as a blurry line.
 */
const RESOLUTION = 2;

export function SignaturePad({
  onChange,
  disabled = false,
}: {
  /** The PNG data URL, or `""` once cleared. */
  readonly onChange: (dataUrl: string) => void;
  readonly disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
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
    context.strokeStyle = brand || "currentColor";
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

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="space-y-2">
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
        <Button type="button" variant="ghost" size="xl" disabled={disabled || !hasInk} onClick={clear}>
          <EraserIcon aria-hidden="true" />
          Borrar y volver a dibujar
        </Button>
        <p className="text-sm text-muted-foreground">
          {hasInk ? "Se dibujará en el contrato." : "Con el ratón o con el dedo. Es opcional."}
        </p>
      </div>
    </div>
  );
}
