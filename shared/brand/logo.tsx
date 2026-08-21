import Image from "next/image";

/** Intrinsic dimensions of `public/logo.png`. One single place for these numbers. */
const INTRINSIC_WIDTH = 2172;
const INTRINSIC_HEIGHT = 724;

type LogoProps = {
  /** Rendered width in px. It also feeds `sizes`, so the two cannot diverge. */
  width: number;
  /** `true` only for the logo visible without scrolling: it preloads the image. */
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
