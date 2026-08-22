/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * Next resolves that import itself and turns it into a build error when a Client Component
 * pulls in server code; outside Next there is nothing to resolve, so a unit test that reaches a
 * module marked this way — usually through a feature's `index.ts` — fails to load.
 *
 * Aliasing it to nothing does not weaken the guard: the guard is Next's, at build time, and it
 * still runs. This only lets the tests import the pure half of a module that shares a barrel
 * with the server half.
 */
export {};
