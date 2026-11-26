-- ════════════════════════════════════════════════════════════════════
-- YSA · Core schema
-- All dates/times are interpreted in Africa/Johannesburg (SAST).
-- RLS is enabled on every table; only active staff can read/write.
-- Anonymous visitors only reach security-definer booking functions.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

-- ── Enums ────────────────────────────────────────────────────────────
create type public.staff_role as enum ('doctor', 'receptionist');
create type public.appointment_status as enum ('requested', 'approved', 'declined', 'completed', 'no_show', 'cancelled');
create type public.payment_method as enum ('cash', 'eft', 'unpaid');
create type public.ent_status as enum ('sent', 'awaiting_feedback', 'returned', 'closed');
create type public.message_status as enum ('queued', 'sent', 'delivered', 'failed', 'not_sent');
create type public.notification_type as enum (
  'booking_request', 'birthday', 'recall_due', 'recall_overdue', 'ent_followup_due', 'whatsapp_failed', 'system'
);
create type public.scan_kind as enum ('front', 'back', 'audiogram');

-- ── Helpers ──────────────────────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function private.sast_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Johannesburg')::date
$$;

-- ── Staff ────────────────────────────────────────────────────────────
create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'receptionist',
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s where s.id = (select auth.uid()) and s.active
  )
$$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to authenticated, anon, service_role;

-- ── Practice settings (single row) ──────────────────────────────────
create table public.practice_settings (
  id smallint primary key default 1 check (id = 1),
  practice_name text not null default 'Yusuf Suder Audiology',
  phone text,
  email text,
  address text,
  website_url text,
  booking_url text,                      -- public /book link used in recall messages
  booking_lead_minutes int not null default 120 check (booking_lead_minutes >= 0),
  booking_horizon_days int not null default 90 check (booking_horizon_days between 1 and 365),
  slot_step_minutes int not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  wa_use_templates boolean not null default true,
  wa_language text not null default 'en',
  msg_booking_confirmation text not null default 'Hi {{1}}, your {{2}} appointment at Yusuf Suder Audiology is confirmed for {{3}} at {{4}}. We''re hear for you.',
  msg_appointment_reminder text not null default 'Hi {{1}}, a reminder of your {{2}} appointment tomorrow, {{3}} at {{4}}, at Yusuf Suder Audiology.',
  msg_recall_reminder text not null default 'Hi {{1}}, you''re due for {{2}} on {{3}}. Please book your visit here: {{4}}. We''re hear for you — Yusuf Suder Audiology.',
  msg_birthday text not null default 'Happy birthday, may you be blessed with many more. Just know we''re always hear for you.',
  updated_at timestamptz not null default now()
);

-- ── Working hours (1 = Monday … 7 = Sunday) ─────────────────────────
create table public.working_hours (
  weekday smallint primary key check (weekday between 1 and 7),
  is_open boolean not null default true,
  open_time time not null default '08:30',
  close_time time not null default '17:00',
  lunch_start time,
  lunch_end time,
  check (close_time > open_time),
  check ((lunch_start is null) = (lunch_end is null)),
  check (lunch_end is null or lunch_end > lunch_start)
);

-- ── Appointment reasons ─────────────────────────────────────────────
create table public.appointment_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  color text not null default 'teal' check (color in ('teal', 'blue', 'sage', 'amber', 'slate', 'coral')),
  public_bookable boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0
);

-- ── Blocked times (leave, holidays) ─────────────────────────────────
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  note text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index blocked_times_range_idx on public.blocked_times (starts_at, ends_at);
create index blocked_times_created_by_idx on public.blocked_times (created_by);

-- ── Patients ─────────────────────────────────────────────────────────
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 160),
  phone text check (phone is null or phone ~ '^\+[0-9]{9,15}$'),
  email text,
  file_number text,
  date_of_birth date,
  address text,
  notes text,
  whatsapp_consent boolean not null default false,
  whatsapp_consent_at timestamptz,
  source text not null default 'staff' check (source in ('staff', 'online_booking')),
  is_new_from_booking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_phone_idx on public.patients (phone);
create index patients_name_idx on public.patients (lower(full_name));
create index patients_dob_md_idx on public.patients (extract(month from date_of_birth), extract(day from date_of_birth));
create trigger patients_updated before update on public.patients for each row execute function private.set_updated_at();

-- ── Appointments ────────────────────────────────────────────────────
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  reason_id uuid not null references public.appointment_reasons (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'approved',
  source text not null default 'staff' check (source in ('staff', 'online')),
  arrived_at timestamptz,
  completed_at timestamptz,
  patient_note text,
  staff_note text,
  decline_reason text,
  suggested_starts_at timestamptz,
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_status_idx on public.appointments (status, starts_at);
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_reason_idx on public.appointments (reason_id);
create index appointments_created_by_idx on public.appointments (created_by);
create trigger appointments_updated before update on public.appointments for each row execute function private.set_updated_at();

-- ── Visits ──────────────────────────────────────────────────────────
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  appointment_id uuid unique references public.appointments (id) on delete set null,
  visit_date date not null default private.sast_today(),
  reason_id uuid references public.appointment_reasons (id),
  reason_label text,
  notes text,
  -- Reserved for a future "Extract notes with AI" feature
  ai_notes text,
  ai_extracted_at timestamptz,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_patient_idx on public.visits (patient_id, visit_date desc);
create index visits_reason_idx on public.visits (reason_id);
create index visits_created_by_idx on public.visits (created_by);
create trigger visits_updated before update on public.visits for each row execute function private.set_updated_at();

-- ── Visit scans (paper sheet front/back + audiogram) ────────────────
create table public.visit_scans (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind public.scan_kind not null,
  storage_path text not null unique,
  width int,
  height int,
  size_bytes int,
  -- Reserved for future AI text extraction
  ai_status text not null default 'none' check (ai_status in ('none', 'pending', 'done', 'failed')),
  ai_text text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);
create index visit_scans_visit_idx on public.visit_scans (visit_id);
create index visit_scans_patient_idx on public.visit_scans (patient_id);
create index visit_scans_created_by_idx on public.visit_scans (created_by);

-- ── Recall plan types & per-patient recalls ─────────────────────────
create table public.recall_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_interval_months int check (default_interval_months is null or default_interval_months between 1 and 240),
  reason_text text not null default '',
  -- visit reason codes that count as the "last relevant visit"; empty = any visit
  trigger_reason_codes text[] not null default '{}',
  is_custom boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.patient_recalls (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  recall_type_id uuid not null references public.recall_types (id),
  interval_months int check (interval_months is null or interval_months between 1 and 240),
  custom_reason text,
  last_visit_date date,
  next_due_date date,
  due_manually_set boolean not null default false,
  active boolean not null default true,
  notes text,
  reminder_sent_at timestamptz,
  reminder_due_date date,          -- the due date the reminder was sent for (once per cycle)
  overdue_notified_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patient_recalls_patient_idx on public.patient_recalls (patient_id);
create index patient_recalls_type_idx on public.patient_recalls (recall_type_id);
create index patient_recalls_due_idx on public.patient_recalls (next_due_date) where active;

-- ── Payments (Cash · EFT · Unpaid) ──────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  payment_date date not null default private.sast_today(),
  amount numeric(12, 2) not null check (amount >= 0),
  method public.payment_method not null,
  received_on date,               -- date money was actually received (null while unpaid)
  was_unpaid boolean not null default false,
  note text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_received_idx on public.payments (received_on);
create index payments_method_idx on public.payments (method);
create index payments_date_idx on public.payments (payment_date);
create index payments_patient_idx on public.payments (patient_id);
create index payments_appointment_idx on public.payments (appointment_id);
create index payments_visit_idx on public.payments (visit_id);
create index payments_created_by_idx on public.payments (created_by);

create or replace function private.payments_normalise()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.method = 'unpaid' then
    new.received_on := null;
    new.was_unpaid := true;
  elsif new.received_on is null then
    new.received_on := new.payment_date;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger payments_normalise before insert or update on public.payments
  for each row execute function private.payments_normalise();

-- ── ENT referrals ───────────────────────────────────────────────────
create table public.ent_referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  date_sent date not null default private.sast_today(),
  ent_name text not null,
  reason text,
  follow_up_date date,
  status public.ent_status not null default 'sent',
  notes text,
  returned_on date,
  followup_notified_for date,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ent_referrals_patient_idx on public.ent_referrals (patient_id);
create index ent_referrals_followup_idx on public.ent_referrals (follow_up_date);
create index ent_referrals_created_by_idx on public.ent_referrals (created_by);
create trigger ent_referrals_updated before update on public.ent_referrals for each row execute function private.set_updated_at();

-- ── WhatsApp message log ────────────────────────────────────────────
create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  recall_id uuid references public.patient_recalls (id) on delete set null,
  template text not null,
  to_phone text,
  payload jsonb not null default '{}',
  body text,
  status public.message_status not null default 'queued',
  error text,
  wa_message_id text,
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index message_log_patient_idx on public.message_log (patient_id, created_at desc);
create index message_log_appointment_idx on public.message_log (appointment_id);
create index message_log_recall_idx on public.message_log (recall_id);
create index message_log_wa_idx on public.message_log (wa_message_id);
create trigger message_log_updated before update on public.message_log for each row execute function private.set_updated_at();

-- ── Notifications ───────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type public.notification_type not null,
  title text not null,
  body text,
  patient_id uuid references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  ent_referral_id uuid references public.ent_referrals (id) on delete cascade,
  recall_id uuid references public.patient_recalls (id) on delete cascade,
  message_log_id uuid references public.message_log (id) on delete set null,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);
create index notifications_unread_idx on public.notifications (created_at desc) where read_at is null;
create index notifications_patient_idx on public.notifications (patient_id);
create index notifications_appointment_idx on public.notifications (appointment_id);
create index notifications_ent_idx on public.notifications (ent_referral_id);
create index notifications_recall_idx on public.notifications (recall_id);
create index notifications_message_idx on public.notifications (message_log_id);

-- ── Spam protection & job audit (no direct client access) ───────────
create table public.booking_attempts (
  id bigint generated always as identity primary key,
  ip text,
  phone text,
  created_at timestamptz not null default now()
);
create index booking_attempts_ip_idx on public.booking_attempts (ip, created_at);
create index booking_attempts_phone_idx on public.booking_attempts (phone, created_at);

create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  details jsonb not null default '{}'
);
create index job_runs_job_idx on public.job_runs (job, started_at desc);

-- ── Row Level Security ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'staff','practice_settings','working_hours','appointment_reasons','blocked_times','patients',
    'appointments','visits','visit_scans','recall_types','patient_recalls','payments',
    'ent_referrals','message_log','notifications','booking_attempts','job_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Staff: full read/write on all practice tables (Doctor & Receptionist are equal)
do $$
declare t text;
begin
  foreach t in array array[
    'practice_settings','working_hours','appointment_reasons','blocked_times','patients',
    'appointments','visits','visit_scans','recall_types','patient_recalls','payments',
    'ent_referrals','message_log','notifications'
  ] loop
    execute format(
      'create policy "staff full access" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))',
      t);
  end loop;
end $$;

-- Staff table: staff can see colleagues and edit names; accounts are created/removed by the staff-admin edge function.
create policy "staff can view staff" on public.staff for select to authenticated using ((select private.is_staff()));
create policy "staff can update staff" on public.staff for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Audit tables: read-only for staff
create policy "staff can view job runs" on public.job_runs for select to authenticated using ((select private.is_staff()));
create policy "staff can view booking attempts" on public.booking_attempts for select to authenticated using ((select private.is_staff()));

-- Remove default anon privileges on tables (anon uses functions only)
revoke all on all tables in schema public from anon;
