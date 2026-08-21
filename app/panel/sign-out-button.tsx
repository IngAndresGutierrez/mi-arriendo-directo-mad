"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutUser } from "@/lib/auth/client";
import { LOGIN_ROUTE } from "@/lib/auth/routes";

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
    <Button type="button" variant="outline" size="lg" disabled={isSigningOut} onClick={onClick}>
      <LogOutIcon />
      {isSigningOut ? "Saliendo…" : "Cerrar sesión"}
    </Button>
  );
}
