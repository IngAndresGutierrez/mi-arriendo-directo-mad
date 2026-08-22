import type { ReactNode } from "react";

import { PublicChrome } from "@/app/public-chrome";

/** Every page in this group wears the public header. `/soporte` uses the same one when there is no session. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicChrome>{children}</PublicChrome>;
}
