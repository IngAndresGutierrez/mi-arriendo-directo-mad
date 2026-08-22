import { describe, expect, it } from "vitest";

import { PRODUCTION_ORIGIN, resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("uses the request's own origin in local development", () => {
    expect(resolveSiteUrl({ host: "localhost:3000", proto: "http" })).toBe("http://localhost:3000");
    expect(resolveSiteUrl({ host: "127.0.0.1:3001", proto: "http" })).toBe("http://127.0.0.1:3001");
  });

  it("uses the production domain in production", () => {
    expect(resolveSiteUrl({ host: "www.miarriendodirecto.com", proto: "https" })).toBe(
      "https://www.miarriendodirecto.com",
    );
    expect(resolveSiteUrl({ host: "miarriendodirecto.com", proto: "https" })).toBe(
      "https://miarriendodirecto.com",
    );
  });

  // A preview build must link to itself, or reviewing a change means following links to prod.
  it("uses the deployment's own domain on a preview", () => {
    expect(resolveSiteUrl({ host: "mad-git-features-x.vercel.app", proto: "https" })).toBe(
      "https://mad-git-features-x.vercel.app",
    );
  });

  /*
   * The `Host` header is written by whoever is calling. Without this check, anyone able to
   * reach the server could make it email *its own users* a button pointing at a domain they
   * chose, from the domain those users trust.
   */
  it("ignores a host it does not recognise", () => {
    expect(resolveSiteUrl({ host: "evil.example.com", proto: "https" })).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ host: "miarriendodirecto.com.evil.example", proto: "https" })).toBe(
      PRODUCTION_ORIGIN,
    );
    expect(resolveSiteUrl({ host: "notvercel.app.evil.com", proto: "https" })).toBe(PRODUCTION_ORIGIN);
  });

  it("never downgrades a real domain to http", () => {
    expect(resolveSiteUrl({ host: "www.miarriendodirecto.com", proto: "http" })).toBe(
      "https://www.miarriendodirecto.com",
    );
  });

  it("falls back to production when there is no host at all", () => {
    expect(resolveSiteUrl({})).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ host: null, proto: null })).toBe(PRODUCTION_ORIGIN);
  });

  // Someone setting it is saying something deliberate.
  it("lets an explicit setting win, without a trailing slash", () => {
    expect(resolveSiteUrl({ host: "localhost:3000", configured: "https://staging.example.com/" })).toBe(
      "https://staging.example.com",
    );
  });
});
