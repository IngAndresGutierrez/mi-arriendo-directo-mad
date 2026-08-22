import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `firebase-admin` ships in Next's built-in list of server-external packages, so it is
   * loaded with a native `require()` at runtime. Its transitive `jwks-rsa@4` does
   * `require("jose")`, and `jose@6` is ESM-only: on a Node without `require(esm)` support
   * (added in 20.19 / 22.12) that throws ERR_REQUIRE_ESM and every route that touches the
   * Admin SDK answers 500. Listing it here makes Turbopack bundle it instead, so the
   * bundler resolves that ESM import and the runtime's Node version stops mattering.
   */
  transpilePackages: ["firebase-admin"],

  /**
   * `/contrato` was the rental process's URL, and every email already sent points at it —
   * `/contrato/<id>#etapa-<stage>`. A permanent redirect keeps those links working: the id
   * carries over, and the browser keeps the fragment on its own, so an email from last week
   * still lands on the stage it was about.
   */
  async redirects() {
    return [
      { source: "/contrato", destination: "/arriendos", permanent: true },
      { source: "/contrato/:id", destination: "/arriendos/:id", permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      // Property photos live in Cloud Storage; the download URL is public and tokenised.
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
