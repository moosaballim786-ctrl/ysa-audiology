-- ════════════════════════════════════════════════════════════════════
-- YSA · Domain logic: visits on completion, recall due-date maths,
-- birthday helper, patient overview view.
-- ════════════════════════════════════════════════════════════════════

-- Birthday check that treats 29 Feb as 28 Feb in non-leap years.
create or replace function private.is_birthday(dob date, d date)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when dob is null then false
    when extract(month from dob) = 2 and extract(day from dob) = 29
         and not ((extract(year from d)::int % 4 = 0 and extract(year from d)::int % 100 <> 0)
                  or extract(year from d)::int % 400 = 0)
      then extract(month from d) = 2 and extract(day from d) = 28
    else extract(month from d) = extract(month from dob) and extract(day from d) = extract(day from dob)
  end
$$;

-- ── Recall maths ────────────────────────────────────────────────────
-- next_due_date = last relevant visit + interval (unless set manually).
create or replace function private.patient_recalls_compute()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_interval int;
  v_codes text[];
  v_last date;
  v_due date;
begin
  select coalesce(new.interval_months, rt.default_interval_months), rt.trigger_reason_codes
    into v_interval, v_codes
  from public.recall_types rt where rt.id = new.recall_type_id;

  select max(v.visit_date) into v_last
  from public.visits v
  left join public.appointment_reasons ar on ar.id = v.reason_id
  where v.patient_id = new.patient_id
    and (coalesce(cardinality(v_codes), 0) = 0 or ar.code = any (v_codes));

  new.last_visit_date := v_last;

  if not new.due_manually_set and v_interval is not null then
    v_due := (coalesce(v_last, (new.created_at at time zone 'Africa/Johannesburg')::date)
              + make_interval(months => v_interval))::date;
    new.next_due_date := v_due;
  end if;

  -- A new due date starts a new reminder cycle.
  if tg_op = 'UPDATE' and new.next_due_date is distinct from old.next_due_date then
    new.reminder_sent_at := null;
    new.reminder_due_date := null;
    new.overdue_notified_for := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger patient_recalls_compute
  before insert or update on public.patient_recalls
  for each row execute function private.patient_recalls_compute();

-- Logging / editing a visit recalculates that patient's recalls.
create or replace function private.visits_touch_recalls()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.patient_recalls
     set updated_at = now()
   where patient_id = coalesce(new.patient_id, old.patient_id) and active;
  return null;
end $$;

create trigger visits_touch_recalls
  after insert or update of visit_date, reason_id or delete on public.visits
  for each row execute function private.visits_touch_recalls();

-- ── Completing an appointment creates the visit record ─────────────
create or replace function private.appointments_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end $$;

create trigger appointments_status_before
  before update of status on public.appointments
  for each row execute function private.appointments_status_change();

create or replace function private.appointments_create_visit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.visits (patient_id, appointment_id, visit_date, reason_id, reason_label, created_by)
    select new.patient_id, new.id, (new.starts_at at time zone 'Africa/Johannesburg')::date,
           new.reason_id, ar.label, new.created_by
    from public.appointment_reasons ar where ar.id = new.reason_id
    on conflict (appointment_id) do nothing;
  end if;
  return null;
end $$;

create trigger appointments_create_visit
  after insert or update of status on public.appointments
  for each row execute function private.appointments_create_visit();

-- ── Patient overview (used by the patient list & filters) ──────────
create or replace view public.patient_overview
with (security_invoker = true) as
select
  p.*,
  (select max(v.visit_date) from public.visits v where v.patient_id = p.id) as last_visit_date,
  (select min(r.next_due_date) from public.patient_recalls r where r.patient_id = p.id and r.active) as next_due_date,
  exists (
    select 1 from public.ent_referrals e where e.patient_id = p.id and e.status <> 'closed'
  ) as has_open_ent,
  exists (select 1 from public.ent_referrals e where e.patient_id = p.id) as ever_sent_to_ent,
  extract(month from p.date_of_birth)::int as birth_month
from public.patients p;

grant select on public.patient_overview to authenticated;
revoke all on public.patient_overview from anon;
