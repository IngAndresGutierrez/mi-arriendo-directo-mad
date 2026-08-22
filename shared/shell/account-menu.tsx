"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";

import { signOutUser } from "@/shared/auth/client";
import { HOME_ROUTE, LOGIN_ROUTE, TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

/**
 * Who you are signed in as, on the pages that have no sidebar.
 *
 * The catalog and a property's detail are public, so their header used to offer "Iniciar sesión"
 * to everyone — including people who were already signed in, which reads as a session that
 * quietly expired. This is the other half of that answer: the initial says the session is live,
 * and the menu holds the two things you would want from here.
 *
 * The initial rather than the name: a header that fits a logo, a link and a button on a phone
 * does not also fit "Ana María Restrepo". What it shows comes from the **email**, which the
 * session cookie already carries — reading the profile would add a Firestore round trip to the
 * catalog, the one page where the first paint is the product.
 */
export function AccountMenu({ email }: { readonly email: string }) {
  const router = useRouter();
  const [isSigningOut, setSigningOut] = useState(false);

  const shown = email.trim();
  const initial = shown.slice(0, 1).toUpperCase() || "?";

  async function signOut() {
    setSigningOut(true);
    await signOutUser();
    router.replace(LOGIN_ROUTE);
    // Drops the router cache so Server Components stop seeing the session.
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tu cuenta${shown ? `, ${shown}` : ""}`}
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3",
          "text-sm font-medium text-foreground transition-colors hover:bg-muted",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        <UserIcon className="size-4" aria-hidden="true" />
        <span aria-hidden="true">{initial}.</span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {shown && (
          <>
            <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{shown}</p>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href={HOME_ROUTE}>Mi portal</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={TENANT_PROFILE_ROUTE}>Mi perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={isSigningOut}>
          <LogOutIcon aria-hidden="true" />
          {isSigningOut ? "Saliendo…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
