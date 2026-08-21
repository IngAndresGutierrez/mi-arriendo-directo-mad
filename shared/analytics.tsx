"use client";

import { useEffect } from "react";

/**
 * Inicializa Google Analytics **después** de la hidratación y con `import()` dinámico:
 * el chunk de Firebase Analytics no entra en el bundle inicial ni bloquea la interacción.
 *
 * No renderiza nada. La recolección de vistas de página la hace Firebase por su cuenta
 * una vez inicializado.
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
