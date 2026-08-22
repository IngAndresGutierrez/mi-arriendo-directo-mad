import type { ReactNode } from "react";

import { ProductChrome } from "@/app/product-chrome";

/**
 * Every screen behind a session wears the product's chrome, composed once.
 *
 * Each page still guards itself with `requireCompleteProfile()`: a layout does not re-run on
 * every navigation within the group, so authorization cannot live here.
 */
export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return <ProductChrome>{children}</ProductChrome>;
}
