import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where the build output goes, and **why it is not always `.next`**.
   *
   * The e2e server and an ordinary `pnpm dev` are meant to run side by side — that is the whole
   * reason `dev:e2e` listens on 3100, so the drivers cannot wander into a server pointed at the real
   * project. They could not: `next dev` keeps its lock inside the output directory, so the second one
   * to start refuses with "you can access the existing server at http://localhost:3000" and the
   * drivers fail on `ERR_CONNECTION_REFUSED`, which looks like a broken app rather than a busy port.
   *
   * `.env.e2e` sets this to `.next-e2e`, so the two have separate output and separate locks. It also
   * means `pnpm build` no longer pulls the e2e server's `.next` out from under it mid-run.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

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
      { source: "/contrato", destination: "/contratos", permanent: true },
      { source: "/contrato/:id", destination: "/contratos/:id", permanent: true },
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
