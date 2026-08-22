import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Analytics } from "@/shared/analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /**
   * Absolute base for every relative URL in metadata. Without it `og:url` and `og:image` ship
   * as paths, and a link pasted into WhatsApp or Facebook previews nothing: the crawler has no
   * host to resolve them against.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.miarriendodirecto.com"),
  title: {
    default: "miarriendoDIRECTO.com",
    template: "%s · miarriendoDIRECTO.com",
  },
  description:
    "Arrienda sin intermediarios: conecta propietarios e inquilinos, valida perfiles y gestiona contratos y pagos en una sola plataforma.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
