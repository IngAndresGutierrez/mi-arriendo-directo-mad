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
};

export default nextConfig;
