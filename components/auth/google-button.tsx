"use client";

import { Loader2Icon } from "lucide-react";

import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";

/** SVG estático elevado a nivel de módulo: no hay que recrear el nodo en cada render. */
const GOOGLE_ICON = <GoogleIcon className="size-4" />;

type GoogleButtonProps = {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  children: string;
};

export function GoogleButton({ onClick, loading, disabled, children }: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xl"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? <Loader2Icon className="animate-spin" /> : GOOGLE_ICON}
      {children}
    </Button>
  );
}
