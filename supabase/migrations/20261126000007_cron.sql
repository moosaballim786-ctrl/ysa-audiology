-- ════════════════════════════════════════════════════════════════════
-- YSA · Scheduled jobs (pg_cron → pg_net → scheduled-jobs Edge Function)
--
-- Prerequisite (run once per project, NOT committed — keeps the secret out of git):
--   select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'ysa_cron_secret');
--   select vault.create_secret('https://<project-ref>.supabase.co', 'ysa_project_url');
--
-- pg_cron runs in UTC. 06:00 UTC = 08:00 SAST (South Africa has no daylight saving).
-- ════════════════════════════════════════════════════════════════════

create or replace function private.call_scheduled_jobs(p_job text)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ysa_project_url')
           || '/functions/v1/scheduled-jobs?job=' || p_job,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ysa_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
$$;
revoke all on function private.call_scheduled_jobs(text) from public, anon, authenticated;

-- Daily 08:00 SAST: birthdays, recall reminders (7 days before), overdue recalls, ENT follow-ups
select cron.schedule('ysa-daily-0800-sast', '0 6 * * *', $$ select private.call_scheduled_jobs('daily') $$);

-- Hourly: 24-hour appointment reminders (sent 08:00–19:59 SAST only)
select cron.schedule('ysa-hourly-reminders', '5 * * * *', $$ select private.call_scheduled_jobs('hourly') $$);

-- Housekeeping: keep spam-protection and job logs small
select cron.schedule(
  'ysa-housekeeping',
  '30 1 * * *',
  $$ delete from public.booking_attempts where created_at < now() - interval '30 days';
     delete from public.job_runs where started_at < now() - interval '180 days'; $$
);
