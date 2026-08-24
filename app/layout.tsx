import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ConsentGate } from "@/features/legal/client";
import { metadataOrigin } from "@/shared/lib/site-url";

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
  metadataBase: new URL(metadataOrigin()),
  title: {
    default: "miarriendoDIRECTO.com",
    template: "%s · miarriendoDIRECTO.com",
  },
  description:
    "Arrienda sin intermediarios: conecta propietarios e inquilinos, valida perfiles y gestiona contratos y pagos en una sola plataforma.",
  /**
   * The defaults every public page inherits, so no page has to remember them.
   *
   * `max-image-preview: large` is the one that changes what a person actually sees: without it
   * Google shows a thumbnail beside a result, and for a rental listing the photo *is* the result.
   * It is under `googleBot` because that is the crawler that reads it; `index`/`follow` are the
   * defaults anyway and are stated so that the pages that say the opposite — everything behind a
   * session — read as a deliberate exception rather than as the only file anyone thought about.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: "miarriendoDIRECTO.com",
    locale: "es_CO",
  },
  /*
   * `summary_large_image` is what turns a shared link into a card with the photo across the top
   * instead of a stamp beside two lines of text. The image itself comes from the `opengraph-image`
   * files: Twitter falls back to Open Graph, so there is no second copy of it to keep in step.
   */
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Analytics used to mount here unconditionally, on every public page, for a visitor who
          had been asked nothing. `ConsentGate` renders it only with an authorisation, and renders
          the cookie banner while there is no decision. It reads the cookie in the browser on
          purpose: reading `cookies()` here would make every route in the product dynamic,
          including the catalogue and a listing's detail.
        */}
        <ConsentGate />
      </body>
    </html>
  );
}
