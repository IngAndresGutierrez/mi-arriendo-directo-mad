import { remindUpcomingErrands } from "@/features/collaboration";

/**
 * The clock behind the errand reminders: one sweep, run by Vercel Cron.
 *
 * A reminder is the one message nobody triggers — there is no click to hang it off — so something
 * has to wake the server. `vercel.json` schedules this every five minutes, which is also the
 * accuracy of the reminder: it goes out on the first tick inside the hour-before window, so
 * somewhere between sixty and fifty-five minutes ahead. For "leave now to get there" that is close
 * enough, and a minute-by-minute cron buys nothing anybody can feel.
 *
 * **Its own route rather than a branch inside the interview sweep**, even though both run on the
 * same schedule. They read different collections, fail for different reasons and are worth watching
 * separately: a sweep that quietly stopped reminding collaborators while still reminding tenants
 * would look healthy in the logs of a shared endpoint. The cost is one more cron entry, which on
 * Pro is free.
 *
 * **It is not a public endpoint.** Vercel sends `Authorization: Bearer $CRON_SECRET` when that
 * variable exists, and without a match this answers 401 — otherwise anyone who guessed the path
 * could make the platform message every collaborator with an errand. With no secret configured it
 * refuses outright rather than running unauthenticated: a job that texts people is not something to
 * leave open by default. The way to check the variable arrived is exactly this call — **401 to a
 * wrong bearer means it is there; 503 means it is not.**
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "CRON_SECRET no está configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return Response.json(await remindUpcomingErrands());
  } catch (error) {
    // The cron retries on its own schedule; what matters is that the reason is on the record.
    console.error("errand reminders sweep failed:", error instanceof Error ? error.message : error);

    return Response.json({ error: "El barrido falló" }, { status: 500 });
  }
}
