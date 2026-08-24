"use client";

import type { ReactNode } from "react";

import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

type ConsentCheckboxProps = {
  readonly id: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly error?: string;
  /** The sentence being agreed to. A node, because these carry links to the documents. */
  readonly children: ReactNode;
};

/**
 * A checkbox whose label is a sentence somebody is agreeing to.
 *
 * It exists for the reason every component in this folder exists: the ARIA wiring was written by
 * hand in the one form that had a consent checkbox, and the moment there were **three** of them —
 * the terms, the data authorisation, and the declaration about a reference's data — that hand-
 * written `aria-describedby` was going to be copied three times and get it wrong once. A consent
 * whose error is computed and never announced is the worst field in the product to have that
 * happen to.
 *
 * Two details that are not cosmetic:
 *
 * - **`block` on the `Label`.** shadcn's `Label` ships `flex`, so a sentence with links inside it
 *   turns its own words into flex items and stacks them instead of flowing as a paragraph.
 * - **The error is `aria-describedby`, not `aria-labelledby`.** The label is what is being agreed
 *   to; the error is why it was not accepted.
 */
export function ConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  error,
  children,
}: ConsentCheckboxProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="block text-sm leading-relaxed font-normal">
          {children}
        </Label>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
