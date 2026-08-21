"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { signOutUser } from "@/shared/auth/client";
import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

type SignOutButtonProps = {
  /**
   * `"sidebar"` for the purple app rail (stacked icon over label); `"inline"` for a light
   * surface, such as the header row of the auth shell.
   */
  readonly variant?: "sidebar" | "inline";
};

/**
 * Signs out on the client, drops the session cookie on the server and returns to the login.
 *
 * One component for both surfaces on purpose: the sign-out sequence (revoke, replace, refresh)
 * must not be duplicated, only its presentation changes.
 */
export function SignOutButton({ variant = "sidebar" }: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setSigningOut] = useState(false);

  async function onClick() {
    setSigningOut(true);
    await signOutUser();
    router.replace(LOGIN_ROUTE);
    // Drops the router cache so Server Components no longer see the session.
    router.refresh();
  }

  const label = isSigningOut ? "Saliendo…" : "Cerrar sesión";

  if (variant === "inline") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={isSigningOut}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOutIcon aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSigningOut}
      className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium text-brand-panel-muted transition-colors hover:bg-white/5 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none disabled:opacity-50"
    >
      <LogOutIcon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
