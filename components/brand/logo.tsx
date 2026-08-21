import Image from "next/image";

/** Dimensiones intrínsecas de `public/logo.png`. Un solo sitio para estos números. */
const INTRINSIC_WIDTH = 2172;
const INTRINSIC_HEIGHT = 724;

type LogoProps = {
  /** Ancho renderizado en px. Alimenta también `sizes`, para que no se dupliquen. */
  width: number;
  /** `true` solo en el logo visible sin hacer scroll: precarga la imagen. */
  priority?: boolean;
  className?: string;
};

export function Logo({ width, priority = false, className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="miarriendoDIRECTO.com"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      priority={priority}
      sizes={`${width}px`}
      style={{ width, height: "auto" }}
      className={className}
    />
  );
}
