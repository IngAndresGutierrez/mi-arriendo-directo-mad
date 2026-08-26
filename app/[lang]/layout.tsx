import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

import { ConsentGate } from "@/features/legal/client";
import { LOCALES, LOCALE_HTML_LANG, LOCALE_OG } from "@/shared/i18n";
import { LocaleProvider } from "@/shared/i18n/locale-context";
import { currentLocale, dictionary } from "@/shared/i18n/server";
import { metadataOrigin } from "@/shared/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * **This is the root layout, and it lives under `[lang]` for one specific reason.**
 *
 * `next/root-params` only exposes a getter for a dynamic segment that sits *above* the root layout.
 * With the old `app/layout.tsx` still in place, `lang` would have been an ordinary route parameter
 * — available through `params` in the page that declares it and nowhere else — and every component
 * in the product that needs the language would have had to receive it as a prop, threaded down from
 * whichever page rendered it. Moving the root layout here is what turns `lang` into a root
 * parameter and makes `currentLocale()` readable from any Server Component. It is the single
 * structural decision the whole migration rests on.
 *
 * What deliberately did **not** move: `app/robots.ts`, `app/sitemap.ts`, the icons and `app/api/**`.
 * None of them has a language — a crawler fetches `/robots.txt` and `/sitemap.xml` by fixed name,
 * and a Route Handler cannot read a root param anyway.
 */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const copy = (await dictionary()).metadata;

  return {
    /**
     * Absolute base for every relative URL in metadata. Without it `og:url` and `og:image` ship
     * as paths, and a link pasted into WhatsApp or Facebook previews nothing: the crawler has no
     * host to resolve them against.
     */
    metadataBase: new URL(metadataOrigin()),
    title: {
      default: copy.defaultTitle,
      template: `%s · ${copy.siteName}`,
    },
    description: copy.defaultDescription,
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
      siteName: copy.siteName,
      /* `es_CO` or `en_US` — the one metadata field that has to move with the language. */
      locale: LOCALE_OG[locale],
    },
    /*
     * `summary_large_image` is what turns a shared link into a card with the photo across the top
     * instead of a stamp beside two lines of text. The image itself comes from the `opengraph-image`
     * files: Twitter falls back to Open Graph, so there is no second copy of it to keep in step.
     */
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await currentLocale();

  return (
    /*
      `es-CO` or `en`. It is not the raw segment: the `lang` attribute wants a BCP 47 tag, and this
      product's Spanish is Colombian — which is what tells a screen reader which voice to read the
      page in, and a translation tool that the page is already in the language it was asked for.
    */
    <html
      lang={LOCALE_HTML_LANG[locale]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          The locale, and only the locale, for the client half of the product. `LocaleLink` reads it
          so a click inside an English page stays in English; the dictionary deliberately does not
          travel through here, because that would put both languages in the browser bundle on every
          page. Client components are handed the slice they need as a prop instead.
        */}
        <LocaleProvider locale={locale}>
          {children}

          {/*
            Analytics used to mount here unconditionally, on every public page, for a visitor who
            had been asked nothing. `ConsentGate` renders it only with an authorisation, and renders
            the cookie banner while there is no decision. It reads the cookie in the browser on
            purpose: reading `cookies()` here would make every route in the product dynamic,
            including the catalogue and a listing's detail.
          */}
          <ConsentGate />
        </LocaleProvider>
      </body>
    </html>
  );
}
