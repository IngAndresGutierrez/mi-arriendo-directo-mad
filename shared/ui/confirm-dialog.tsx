"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  /** What exactly is about to be lost. Vague copy here is how people delete the wrong thing. */
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly pendingLabel?: string;
  readonly onConfirm: () => void | Promise<void>;
};

/**
 * Confirmation before something is destroyed.
 *
 * Every delete in the product goes through here, so the answer to "did that ask me first?" is
 * always yes and the wording is always shaped the same way: what is being deleted, by name, and
 * what will not come back.
 *
 * The confirm button owns the pending state: a destructive action that can be double-clicked
 * runs twice, and the second run usually fails against something that is already gone.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [isPending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" variant="destructive" size="lg" disabled={isPending} onClick={confirm}>
            {isPending ? (pendingLabel ?? "Eliminando…") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
