// scheduled-jobs — called by pg_cron (08:00 SAST daily, and hourly).
// Auth: x-cron-secret header must match the `ysa_cron_secret` Vault secret.
// The SQL functions create notifications idempotently; this function sends the WhatsApp messages.
import { admin, cors, json } from "../_shared/common.ts";
import { sendWhatsApp, type SendInput } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = await db.rpc("check_cron_secret", { p_secret: secret });
  if (!ok) return json({ error: "Unauthorised" }, 401);

  const job = new URL(req.url).searchParams.get("job") ?? "daily";
  const { data, error } = job === "hourly" ? await db.rpc("run_hourly_jobs") : await db.rpc("run_daily_jobs", {});
  if (error) return json({ error: error.message }, 500);

  const run = data as { run_id: number; sends: SendInput[] };
  const tally = { sent: 0, not_sent: 0, failed: 0 };
  for (const item of run.sends ?? []) {
    const r = await sendWhatsApp(db, item);
    tally[r.status]++;
  }
  await db.rpc("finish_job_run", { p_run_id: run.run_id, p_details: { whatsapp: tally } });
  return json({ job, run_id: run.run_id, whatsapp: tally });
});
