"use client";

import { Loader2Icon } from "lucide-react";

import { Button } from "@/shared/ui/button";

type SubmitButtonProps = {
  loading: boolean;
  disabled?: boolean;
  /** Texto en reposo. */
  children: string;
  /** Texto mientras se envía. Sin él se mantiene el de reposo. */
  loadingLabel?: string;
};

/** CTA de envío con spinner y etiqueta de progreso. Cian de marca (`variant="accent"`). */
export function SubmitButton({
  loading,
  disabled = false,
  children,
  loadingLabel,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant="accent"
      size="xl"
      className="w-full"
      disabled={loading || disabled}
    >
      {loading ? <Loader2Icon className="animate-spin" /> : null}
      {loading ? (loadingLabel ?? children) : children}
    </Button>
  );
}
