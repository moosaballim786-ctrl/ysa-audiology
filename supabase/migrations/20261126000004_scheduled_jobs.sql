-- ════════════════════════════════════════════════════════════════════
-- YSA · Scheduled jobs (called by the `scheduled-jobs` Edge Function,
-- which pg_cron triggers at 08:00 SAST daily and hourly).
-- Every job is idempotent (dedupe keys / sent markers) and logged in job_runs.
-- The SQL creates the notifications; the Edge Function sends WhatsApp.
-- ════════════════════════════════════════════════════════════════════

-- Daily: birthdays, recall reminders (7 days before), overdue recalls, ENT follow-ups.
create or replace function public.run_daily_jobs(p_today date default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, private.sast_today());
  v_run bigint;
  v_sends jsonb := '[]'::jsonb;
  v_counts jsonb;
  r record;
  v_nid uuid;
  n_bday int := 0; n_recall int := 0; n_overdue int := 0; n_ent int := 0;
begin
  insert into public.job_runs (job, details) values ('daily', jsonb_build_object('date', v_today)) returning id into v_run;

  -- Birthdays (once per patient per year)
  for r in
    select p.id, p.full_name, p.phone, p.whatsapp_consent
    from public.patients p
    where private.is_birthday(p.date_of_birth, v_today)
  loop
    insert into public.notifications (type, title, body, patient_id, dedupe_key)
    values ('birthday', 'Today is ' || r.full_name || '''s birthday 🎂',
            case when r.whatsapp_consent and r.phone is not null
                 then 'Sending the birthday message on WhatsApp.'
                 else 'No WhatsApp consent — no message will be sent.' end,
            r.id, 'birthday:' || r.id || ':' || extract(year from v_today))
    on conflict (dedupe_key) do nothing
    returning id into v_nid;
    if v_nid is not null then
      n_bday := n_bday + 1;
      if r.whatsapp_consent and r.phone is not null then
        v_sends := v_sends || jsonb_build_object('template', 'birthday_greeting', 'patient_id', r.id, 'notification_id', v_nid);
      end if;
    end if;
    v_nid := null;
  end loop;

  -- Recall due within 7 days (once per due cycle)
  for r in
    select pr.id, pr.patient_id, pr.next_due_date, p.full_name,
           coalesce(nullif(pr.custom_reason, ''), rt.reason_text, rt.name) as reason
    from public.patient_recalls pr
    join public.patients p on p.id = pr.patient_id
    join public.recall_types rt on rt.id = pr.recall_type_id
    where pr.active
      and pr.next_due_date between v_today and v_today + 7
      and pr.reminder_due_date is distinct from pr.next_due_date
  loop
    insert into public.notifications (type, title, body, patient_id, recall_id, dedupe_key)
    values ('recall_due',
            'Recall due: ' || r.full_name || ' — ' || r.reason || ' on ' || to_char(r.next_due_date, 'FMDD FMMonth YYYY'),
            null, r.patient_id, r.id, 'recall_due:' || r.id || ':' || r.next_due_date)
    on conflict (dedupe_key) do nothing;
    update public.patient_recalls
       set reminder_sent_at = now(), reminder_due_date = r.next_due_date
     where id = r.id;
    v_sends := v_sends || jsonb_build_object('template', 'recall_reminder', 'recall_id', r.id, 'patient_id', r.patient_id);
    n_recall := n_recall + 1;
  end loop;

  -- Overdue recalls (once per due date)
  for r in
    select pr.id, pr.patient_id, pr.next_due_date, p.full_name,
           coalesce(nullif(pr.custom_reason, ''), rt.reason_text, rt.name) as reason
    from public.patient_recalls pr
    join public.patients p on p.id = pr.patient_id
    join public.recall_types rt on rt.id = pr.recall_type_id
    where pr.active
      and pr.next_due_date < v_today
      and pr.overdue_notified_for is distinct from pr.next_due_date
  loop
    insert into public.notifications (type, title, body, patient_id, recall_id, dedupe_key)
    values ('recall_overdue',
            'Recall overdue: ' || r.full_name || ' — ' || r.reason,
            'Was due on ' || to_char(r.next_due_date, 'FMDD FMMonth YYYY') || '.',
            r.patient_id, r.id, 'recall_overdue:' || r.id || ':' || r.next_due_date)
    on conflict (dedupe_key) do nothing;
    update public.patient_recalls set overdue_notified_for = r.next_due_date where id = r.id;
    n_overdue := n_overdue + 1;
  end loop;

  -- ENT follow-ups reached
  for r in
    select e.id, e.patient_id, e.follow_up_date, e.ent_name, p.full_name
    from public.ent_referrals e
    join public.patients p on p.id = e.patient_id
    where e.status in ('sent', 'awaiting_feedback')
      and e.follow_up_date is not null
      and e.follow_up_date <= v_today
      and e.followup_notified_for is distinct from e.follow_up_date
  loop
    insert into public.notifications (type, title, body, patient_id, ent_referral_id, dedupe_key)
    values ('ent_followup_due', 'ENT follow-up due: ' || r.full_name,
            'Referred to ' || r.ent_name || '. Follow-up date ' || to_char(r.follow_up_date, 'FMDD FMMonth YYYY') || '.',
            r.patient_id, r.id, 'ent_followup:' || r.id || ':' || r.follow_up_date)
    on conflict (dedupe_key) do nothing;
    update public.ent_referrals set followup_notified_for = r.follow_up_date where id = r.id;
    n_ent := n_ent + 1;
  end loop;

  v_counts := jsonb_build_object('birthdays', n_bday, 'recalls_due', n_recall, 'recalls_overdue', n_overdue, 'ent_followups', n_ent);
  update public.job_runs set finished_at = now(), status = 'ok', details = details || v_counts where id = v_run;

  return jsonb_build_object('run_id', v_run, 'counts', v_counts, 'sends', v_sends);
end $$;

-- Hourly: 24-hour appointment reminders for tomorrow's approved appointments.
-- Only sends between 08:00 and 19:59 SAST so nobody is messaged at night.
create or replace function public.run_hourly_jobs()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_now_local timestamp := now() at time zone 'Africa/Johannesburg';
  v_run bigint;
  v_sends jsonb := '[]'::jsonb;
  r record;
begin
  insert into public.job_runs (job) values ('hourly') returning id into v_run;

  if extract(hour from v_now_local) between 8 and 19 then
    for r in
      update public.appointments a
         set reminder_sent_at = now()
       where a.status = 'approved'
         and a.reminder_sent_at is null
         and (a.starts_at at time zone 'Africa/Johannesburg')::date = v_now_local::date + 1
      returning a.id, a.patient_id
    loop
      v_sends := v_sends || jsonb_build_object('template', 'appointment_reminder', 'appointment_id', r.id, 'patient_id', r.patient_id);
    end loop;
  end if;

  update public.job_runs set finished_at = now(), status = 'ok',
         details = jsonb_build_object('reminders', jsonb_array_length(v_sends)) where id = v_run;
  return jsonb_build_object('run_id', v_run, 'sends', v_sends);
end $$;

create or replace function public.finish_job_run(p_run_id bigint, p_details jsonb)
returns void language sql volatile security definer set search_path = '' as $$
  update public.job_runs set details = details || coalesce(p_details, '{}'::jsonb) where id = p_run_id
$$;

-- Cron secret check (the secret lives in Supabase Vault, never in the repo).
create or replace function public.check_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'ysa_cron_secret' and decrypted_secret = p_secret and coalesce(p_secret, '') <> ''
  )
$$;

revoke all on function public.run_daily_jobs(date) from public, anon, authenticated;
revoke all on function public.run_hourly_jobs() from public, anon, authenticated;
revoke all on function public.finish_job_run(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.run_daily_jobs(date) to service_role;
grant execute on function public.run_hourly_jobs() to service_role;
grant execute on function public.finish_job_run(bigint, jsonb) to service_role;
grant execute on function public.check_cron_secret(text) to service_role;
