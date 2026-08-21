"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { signOutUser } from "@/shared/auth/client";
import { LOGIN_ROUTE } from "@/shared/auth/routes";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setSigningOut] = useState(false);

  async function onClick() {
    setSigningOut(true);
    await signOutUser();
    router.replace(LOGIN_ROUTE);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSigningOut}
      className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium text-brand-panel-muted transition-colors hover:bg-white/5 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none disabled:opacity-50"
    >
      <LogOutIcon className="size-5" aria-hidden="true" />
      {isSigningOut ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
