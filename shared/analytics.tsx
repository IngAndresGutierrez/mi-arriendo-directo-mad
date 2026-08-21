"use client";

import { useEffect } from "react";

/**
 * Initializes Google Analytics **after** hydration and through a dynamic `import()`: the
 * Firebase Analytics chunk stays out of the initial bundle and never blocks interaction.
 *
 * Renders nothing. Page view collection is handled by Firebase itself once initialized.
 */
export function Analytics() {
  useEffect(() => {
    let cancelled = false;

    void import("@/shared/firebase/analytics").then(({ getAnalyticsInstance }) => {
      if (!cancelled) void getAnalyticsInstance();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
