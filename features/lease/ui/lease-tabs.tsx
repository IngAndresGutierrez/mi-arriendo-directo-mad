"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BanknoteIcon, FileTextIcon, WrenchIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { incidentAnchor } from "../domain/incident";
import { periodAnchor } from "../domain/lease";

/** The three subjects of a tenancy. The value is what a hash has to resolve to. */
type TabValue = "informacion" | "pagos" | "incidentes";

/**
 * Which tab an anchor lives on.
 *
 * **Derived from the anchor helpers, never from a literal.** `periodAnchor("")` is `"mes-"` and
 * `incidentAnchor("")` is `"incidente-"`, so renaming either one moves this mapping with it. Two
 * copies of "what a link about September looks like" is exactly the pair whose first divergence
 * nobody notices — and the thing that breaks is an email somebody already received.
 */
function tabForHash(hash: string): TabValue | null {
  const anchor = hash.replace(/^#/, "");
  if (!anchor) return null;

  if (anchor.startsWith(periodAnchor(""))) return "pagos";
  if (anchor.startsWith(incidentAnchor("")) || anchor === "incidentes") return "incidentes";

  return null;
}

/**
 * The tenancy in three tabs: what it is, what is paid, and what is broken.
 *
 * **The default is Pagos, not Información**, even though Información is listed first. The question
 * this page exists to answer is not "¿vamos a hacer esto?" — that is the nine-stage process — it is
 * "¿está pagado este mes?", and the month that needs something is the one thing somebody comes here
 * for. Opening on a summary would put a reference card in front of the only action on the screen.
 *
 * **The anchors keep working, and that is the whole reason this is a Client Component.** Every
 * notification about a month links to `/arriendos/<id>#mes-2026-09` and every one about a report to
 * `#incidente-<id>`; with the months and the reports on different tabs, a link whose target is not
 * mounted scrolls nowhere and fails silently — the worst kind of regression, because the email looks
 * fine and the click looks like nothing happened. So the hash picks the tab. It has to happen in the
 * browser: a fragment is never sent to the server, so no Server Component can read it.
 *
 * The tab is deliberately **not written into the URL** on click. The hash is a contract with links
 * that already exist and it is read once, on arrival; adding a `?tab=` that every click rewrites
 * would put a second source of truth beside it, and the two would have to agree about a link
 * carrying both.
 */
export function LeaseTabs({
  info,
  payments,
  incidents,
  openMonths,
  incidentCount,
}: {
  /** Already-created JSX, not components: a function does not cross the RSC boundary. */
  readonly info: ReactNode;
  readonly payments: ReactNode;
  readonly incidents: ReactNode;
  /** Months that still need something, so the rail says where the work is. */
  readonly openMonths: number;
  readonly incidentCount: number;
}) {
  const [value, setValue] = useState<TabValue>("pagos");

  /*
   * The hash decides the tab, once, on arrival.
   *
   * Scheduled on the next frame rather than set in the body of the effect: a `setState` called
   * synchronously there is what the React compiler flags — and rightly, because it is a render
   * cascade — while a frame later is both allowed and what this actually wants, since the tab has to
   * be mounted before anything can be scrolled to.
   */
  useEffect(() => {
    const target = tabForHash(window.location.hash);
    if (!target) return;

    const frame = requestAnimationFrame(() => setValue(target));

    return () => cancelAnimationFrame(frame);
  }, []);

  /*
   * And again whenever the fragment changes without the page reloading.
   *
   * Arriving from an email or from another screen is a fresh document, so the effect above is enough.
   * Clicking a bell entry for *this* tenancy **while already on it** is not: the browser changes the
   * fragment in place, nothing remounts, and without this the tab would stay where it was while the
   * anchor it was asked for sat in a panel that is not rendered — a click that does nothing at all.
   *
   * `setValue` in a listener is not the effect-body cascade the compiler rejects, so no frame is
   * needed here; the scroll is the effect below, which fires when the panel is mounted.
   */
  useEffect(() => {
    const apply = () => {
      const target = tabForHash(window.location.hash);
      if (target) setValue(target);
    };

    window.addEventListener("hashchange", apply);

    return () => window.removeEventListener("hashchange", apply);
  }, []);

  /*
   * And then the scroll the browser could not do.
   *
   * It tried before the tab that holds the anchor existed and does not try again on its own. Keyed on
   * `value`, so it runs when the right panel is mounted — and it only acts when the hash belongs to
   * the tab now showing, so switching tabs by hand later does not yank the page back to an old
   * anchor.
   */
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || tabForHash(window.location.hash) !== value) return;

    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [value]);

  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as TabValue)}>
      <TabsList aria-label="Secciones del arriendo">
        <TabsTrigger value="informacion">
          <FileTextIcon className="size-4" aria-hidden="true" />
          Información
        </TabsTrigger>
        <TabsTrigger value="pagos">
          <BanknoteIcon className="size-4" aria-hidden="true" />
          Pagos
          {/*
            El número va donde está el trabajo, no en todas las pestañas: un contador en cada una es
            un contador que nadie lee. Se dicen los meses que piden algo, que es lo que hace volver a
            esta pantalla; si no hay ninguno, no hay nada que anunciar.
          */}
          {openMonths > 0 ? <Count value={openMonths} tone="attention" /> : null}
        </TabsTrigger>
        <TabsTrigger value="incidentes">
          <WrenchIcon className="size-4" aria-hidden="true" />
          Incidentes
          {incidentCount > 0 ? <Count value={incidentCount} tone="quiet" /> : null}
        </TabsTrigger>
      </TabsList>

      {/* `space-y-6` en cada panel, no en el contenedor: cada pestaña es su propia pila. */}
      <TabsContent value="informacion" className="space-y-6">
        {info}
      </TabsContent>
      <TabsContent value="pagos" className="space-y-6">
        {payments}
      </TabsContent>
      <TabsContent value="incidentes" className="space-y-6">
        {incidents}
      </TabsContent>
    </Tabs>
  );
}

/**
 * The number beside a label.
 *
 * `attention` for months that are owed and `quiet` for a count that is only a count — an incident
 * that was reported is not a thing anybody has to act on today, and colouring it like a debt would
 * make the rail cry wolf about a leak somebody already fixed.
 */
function Count({ value, tone }: { readonly value: number; readonly tone: "attention" | "quiet" }) {
  return (
    <span
      className={
        tone === "attention"
          ? "rounded-full bg-status-overdue-bg px-1.5 py-0.5 text-xs font-semibold text-status-overdue"
          : "rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
      }
    >
      {value}
    </span>
  );
}
