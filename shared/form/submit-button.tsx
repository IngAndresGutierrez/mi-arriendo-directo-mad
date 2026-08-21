"use client";

import { Loader2Icon } from "lucide-react";

import { Button } from "@/shared/ui/button";

type SubmitButtonProps = {
  loading: boolean;
  disabled?: boolean;
  /** Label at rest. */
  children: string;
  /** Label while submitting. Without it the resting label stays. */
  loadingLabel?: string;
};

/** Submit CTA with spinner and progress label. Brand cyan (`variant="accent"`). */
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
