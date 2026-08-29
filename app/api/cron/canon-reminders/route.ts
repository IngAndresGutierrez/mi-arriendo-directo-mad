import { remindDueCanons } from "@/features/lease";

/**
 * The clock behind the canon reminders: one sweep, run by Vercel Cron.
 *
 * A month falling due is the one thing in a tenancy nobody clicks. `vercel.json` schedules this
 * **hourly**, and the hour is not a guess: a message about money owed is collection contact under
 * Ley 2300, so the sweep refuses outside the legal window and lets the next tick handle it. On a
 * Sunday or a public holiday every tick that day is refused and the reminder leaves on Monday
 * morning — which is the correct behaviour, not a missed run.
 *
 * Hourly rather than daily for exactly that reason: a single daily tick that happened to land on a
 * holiday would skip the day entirely, and a daily tick at a fixed hour is one deploy away from
 * landing outside the window without anybody noticing.
 *
 * **It is not a public endpoint.** Same contract as the interview sweep: Vercel sends
 * `Authorization: Bearer $CRON_SECRET`, a wrong one is 401, and a missing secret is 503 rather
 * than an unauthenticated run — a job that emails every tenant in the product about money is not
 * something to leave open on a guessable path.
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
    const result = await remindDueCanons();

    return Response.json(result);
  } catch (error) {
    // The cron retries on its own schedule; what matters is that the reason is on the record.
    console.error("canon reminders sweep failed:", error instanceof Error ? error.message : error);

    return Response.json({ error: "El barrido falló" }, { status: 500 });
  }
}
