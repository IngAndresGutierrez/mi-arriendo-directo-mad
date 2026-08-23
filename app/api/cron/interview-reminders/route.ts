import { remindUpcomingInterviews } from "@/features/application";

/**
 * The clock behind the interview reminders: one sweep, run by Vercel Cron.
 *
 * A reminder is the one notification nobody triggers — there is no click to hang it off, so
 * something has to wake the server up. `vercel.json` schedules this every five minutes, which is
 * also the accuracy of the "ten minutes before" reminder: it goes out on the first tick inside
 * that window, so somewhere between ten and fifteen minutes ahead. Closer than that means a
 * minute-by-minute cron for a gain nobody can feel.
 *
 * **It is not a public endpoint.** Vercel sends `Authorization: Bearer $CRON_SECRET` when that
 * variable exists, and without a match this answers 401 — otherwise anyone who guessed the path
 * could make the platform message every tenant with an interview. With no secret configured it
 * refuses outright rather than running unauthenticated: a job that mails people is not something
 * to leave open by default.
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
    const result = await remindUpcomingInterviews();

    return Response.json(result);
  } catch (error) {
    // The cron retries on its own schedule; what matters is that the reason is on the record.
    console.error("interview reminders sweep failed:", error instanceof Error ? error.message : error);

    return Response.json({ error: "El barrido falló" }, { status: 500 });
  }
}
