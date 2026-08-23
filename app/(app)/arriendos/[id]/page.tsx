import { redirect } from "next/navigation";

import { applicationRoute } from "@/shared/auth/routes";

/**
 * Every notification email sent so far points at `/arriendos/<id>#etapa-…`, so this has to keep
 * answering. The browser carries the fragment across the redirect, which is what lands the reader
 * on the stage the message was about.
 *
 * A 307 and not a 301, and in code rather than in `next.config.ts`, for the reason in the sibling
 * page: once the tenancy exists, this same file serves it — showing the tenancy when there is one
 * for this id and forwarding to the process when there is not.
 */
export default async function RentalBridge({ params }: PageProps<"/arriendos/[id]">) {
  const { id } = await params;

  redirect(applicationRoute(id));
}
