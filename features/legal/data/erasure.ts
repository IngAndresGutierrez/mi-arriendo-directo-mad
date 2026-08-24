import "server-only";

import { cache } from "react";

import { isCompleted, listApplicationsFor } from "@/features/application";
import { listLeasesFor } from "@/features/lease";

import { erasureBlocker, type ErasureBlocker } from "../domain/erasure";

/**
 * Whether this account can be deleted right now, and if not, why.
 *
 * It reuses `listApplicationsFor` and `listLeasesFor` rather than querying `applications` and
 * `leases` here, and that is deliberate: both of those carry composite indexes that
 * `firestore.indexes.json` declares and `lease-indexes.test.ts` pins. A second copy of a
 * `where(...).orderBy(...)` written in this module would be a second index to remember, and the
 * emulator does not enforce indexes — so the omission would survive every check in the repo and
 * fail on production, which is exactly how `/arriendos` broke the first time it was opened there.
 *
 * **A read that fails means "cannot delete", never "nothing in the way".** `listLeasesFor` answers
 * `{ ok: false }` when its index is still building, and reading that as zero tenancies would delete
 * somebody's account in the middle of their lease. Fail closed: the one direction where being
 * wrong is not recoverable.
 *
 * Cached per request: the screen renders the blocker and the action checks it again.
 */
export const erasureStatus = cache(
  async (uid: string): Promise<ErasureBlocker | { readonly reason: "unknown" } | null> => {
    const [applications, leases] = await Promise.all([
      listApplicationsFor(uid),
      listLeasesFor(uid),
    ]);

    if (!leases.ok) return { reason: "unknown" };

    return erasureBlocker({
      // A completed process is counted by its tenancy instead: they are one story, and counting
      // both would tell somebody to close a process that finished months ago.
      openApplications: applications.filter(
        (application) => application.status === "open" && !isCompleted(application),
      ).length,
      /*
       * **Every tenancy counts, because this product has no `ended` state and that is on purpose:**
       * Ley 820 de 2003 renews a residential lease for an equal term unless notice is given in the
       * form and within the time it sets out, so "the months are up" is not "it ended". A lease
       * document existing is a relationship existing.
       */
      runningLeases: leases.leases.length,
    });
  },
);
