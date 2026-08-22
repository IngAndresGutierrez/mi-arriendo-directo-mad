"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { SUPPORT_EMAIL } from "@/shared/lib/support-contact";
import { cn } from "@/shared/lib/utils";

/** How long the button stays on "Correo copiado" before going back to offering the copy. */
const CONFIRMATION_MS = 2500;

/**
 * The email action for a device with a mouse.
 *
 * `mailto:` needs the operating system to have a mail client registered, and somebody who
 * reads their mail at gmail.com in a browser has never registered one — so the link opens
 * nothing at all and the click reads as a broken button. Copying the address is the one thing
 * that works on every desktop, and the address is where the person was heading anyway.
 *
 * The clipboard can still refuse (an insecure origin, a permission the browser withholds), so
 * the failure is not silent: the address itself appears under the button, ready to select.
 */
export function CopyEmailButton({ className }: { readonly className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A component unmounted mid-confirmation would otherwise set state on nothing.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), CONFIRMATION_MS);
    } catch {
      // No console noise: the person already has the answer on screen.
      setState("failed");
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button type="button" variant="outline" size="xl" className="w-full" onClick={copy}>
        {state === "copied" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        {state === "copied" ? "Correo copiado" : "Copiar correo"}
      </Button>

      {/*
        Polite and always mounted: a region that appears with its message is announced
        inconsistently, and the confirmation is the whole point of the button.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? `${SUPPORT_EMAIL} copiado al portapapeles` : ""}
      </p>

      {state === "failed" && (
        <p className="text-xs break-all text-muted-foreground">
          No pudimos copiarlo. La dirección es{" "}
          <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span>.
        </p>
      )}
    </div>
  );
}
