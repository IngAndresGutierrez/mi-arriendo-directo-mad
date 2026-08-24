import type { ReactNode } from "react";

import { getSessionUser } from "@/shared/auth/session";

import { ProductChrome } from "./product-chrome";
import { PublicChrome } from "./public-chrome";

/**
 * The frame a legal document wears: the product's when there is a session, the public one when
 * there is not.
 *
 * The same reasoning as `/soporte`, which was the first page to need it: **reading a policy must
 * not require an account.** Somebody deciding whether to sign up is exactly the person who needs
 * to read the privacy policy, and putting it behind the login would mean the document explaining
 * what we do with their data is only readable once they have given us some.
 *
 * It exists as a component rather than as three copies of the same six lines because there are now
 * three of these pages, and the day the chrome changes it should change once. `/soporte` predates
 * it and keeps its own copy: it also greets by name, which these do not.
 *
 * They live outside both route groups, so they inherit the root layout's `index: true`. That is
 * deliberate — a policy nobody can find is not published, and both Fincaraíz and Metrocuadrado
 * index theirs.
 */
export async function LegalChrome({ children }: { readonly children: ReactNode }) {
  const user = await getSessionUser();
  const Chrome = user ? ProductChrome : PublicChrome;

  return <Chrome>{children}</Chrome>;
}
