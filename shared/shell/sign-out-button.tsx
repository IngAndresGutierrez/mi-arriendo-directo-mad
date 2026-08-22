"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { signOutUser } from "@/shared/auth/client";
import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type SignOutButtonProps = {
  /**
   * `"drawer"` for the purple navigation panel; `"inline"` for a light surface, such as the
   * header row of the auth shell.
   */
  readonly variant?: "drawer" | "inline";
  /** `"drawer"` only: icon over label, for the collapsed rail. */
  readonly collapsed?: boolean;
};

/**
 * Signs out on the client, drops the session cookie on the server and returns to the login.
 *
 * One component for both surfaces on purpose: the sign-out sequence (revoke, replace, refresh)
 * must not be duplicated, only its presentation changes.
 */
export function SignOutButton({ variant = "drawer", collapsed = false }: SignOutButtonProps) {
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
      className={cn(
        "flex w-full rounded-xl font-medium text-brand-panel-muted transition-colors hover:bg-white/5 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none disabled:opacity-50",
        collapsed
          ? "flex-col items-center gap-1.5 px-1 py-2.5 text-center text-xs"
          : "items-center gap-3 px-3 py-2.5 text-sm",
      )}
    >
      <LogOutIcon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
