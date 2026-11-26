-- ════════════════════════════════════════════════════════════════════
-- YSA · Public booking (/book). Anonymous visitors can ONLY:
--   • read booking options and open time slots (times only, no patient data)
--   • submit a booking request
-- Protected by a honeypot, consent check and rate limits.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if p is null then return null; end if;
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  if s like '00%' then s := '+' || substr(s, 3); end if;
  if s like '0%' then s := '+27' || substr(s, 2);
  elsif s like '27%' then s := '+' || s;
  elsif s not like '+%' then s := '+27' || s;
  end if;
  if s ~ '^\+[0-9]{9,15}$' then return s; end if;
  return null;
end $$;

-- Booking options for the public page (reasons, open weekdays, horizon).
create or replace function public.get_booking_options()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'practice_name', (select practice_name from public.practice_settings where id = 1),
    'horizon_days', (select booking_horizon_days from public.practice_settings where id = 1),
    'today', private.sast_today(),
    'reasons', coalesce((
      select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'duration_minutes', duration_minutes) order by sort_order)
      from public.appointment_reasons where public_bookable and active), '[]'::jsonb),
    'open_weekdays', coalesce((select jsonb_agg(weekday order by weekday) from public.working_hours where is_open), '[]'::jsonb)
  )
$$;

-- Open slots for a date and reason. Returns times only.
create or replace function public.get_available_slots(p_date date, p_reason_code text)
returns table (slot_start timestamptz, slot_label text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz constant text := 'Africa/Johannesburg';
  v_wh public.working_hours;
  v_dur int;
  v_step int;
  v_lead int;
  v_horizon int;
  v_today date := private.sast_today();
begin
  select duration_minutes into v_dur
  from public.appointment_reasons where code = p_reason_code and active;
  if v_dur is null then return; end if;

  select slot_step_minutes, booking_lead_minutes, booking_horizon_days
    into v_step, v_lead, v_horizon
  from public.practice_settings where id = 1;

  if p_date < v_today or p_date > v_today + v_horizon then return; end if;

  select * into v_wh from public.working_hours where weekday = extract(isodow from p_date)::int;
  if not found or not v_wh.is_open then return; end if;

  return query
  with candidates as (
    select t::time as t_local
    from generate_series(
      p_date + v_wh.open_time,
      p_date + v_wh.close_time - make_interval(mins => v_dur),
      make_interval(mins => v_step)
    ) as t
  ), slots as (
    select c.t_local,
           ((p_date + c.t_local) at time zone v_tz) as s,
           ((p_date + c.t_local) at time zone v_tz) + make_interval(mins => v_dur) as e
    from candidates c
  )
  select sl.s, to_char(sl.t_local, 'HH24:MI')
  from slots sl
  where sl.s >= now() + make_interval(mins => v_lead)
    and not (v_wh.lunch_start is not null
             and sl.t_local < v_wh.lunch_end
             and (sl.t_local + make_interval(mins => v_dur)) > v_wh.lunch_start)
    and not exists (
      select 1 from public.appointments a
      where a.status in ('requested', 'approved', 'completed')
        and a.starts_at < sl.e and a.ends_at > sl.s)
    and not exists (
      select 1 from public.blocked_times b
      where b.starts_at < sl.e and b.ends_at > sl.s)
  order by sl.s;
end $$;

-- Dates in a range that have at least one open slot (for the calendar).
create or replace function public.get_available_dates(p_from date, p_to date, p_reason_code text)
returns setof date
language sql stable security definer set search_path = '' as $$
  select d::date
  from generate_series(greatest(p_from, private.sast_today()), least(p_to, p_from + 62), interval '1 day') d
  where exists (select 1 from public.get_available_slots(d::date, p_reason_code))
  order by 1
$$;

-- Submit a booking request.
create or replace function public.request_booking(
  p_reason_code text,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_date_of_birth date default null,
  p_note text default null,
  p_consent boolean default false,
  p_website text default null          -- honeypot: real people never fill this in
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ip text;
  v_reason public.appointment_reasons;
  v_patient_id uuid;
  v_appt_id uuid;
  v_local timestamp;
begin
  -- Honeypot: pretend success, store nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your full name.' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'Please enter a valid mobile number.' using errcode = 'P0001';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Please agree to receive appointment messages on WhatsApp.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    v_note := left(v_note, 500);
  end if;
  if p_date_of_birth is not null and (p_date_of_birth > private.sast_today() or p_date_of_birth < date '1900-01-01') then
    raise exception 'Please check your date of birth.' using errcode = 'P0001';
  end if;

  -- Rate limits (per IP, per phone, and overall).
  begin
    v_ip := split_part(coalesce(
      (current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip'),
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      'unknown'), ',', 1);
  exception when others then
    v_ip := 'unknown';
  end;

  if (select count(*) from public.booking_attempts where ip = v_ip and created_at > now() - interval '1 hour') >= 6
     or (select count(*) from public.booking_attempts where phone = v_phone and created_at > now() - interval '1 day') >= 4
     or (select count(*) from public.booking_attempts where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Too many booking requests. Please try again later or call the practice.' using errcode = 'P0001';
  end if;
  insert into public.booking_attempts (ip, phone) values (v_ip, v_phone);

  select * into v_reason from public.appointment_reasons where code = p_reason_code and active and public_bookable;
  if not found then
    raise exception 'Please choose a reason for your visit.' using errcode = 'P0001';
  end if;

  -- Serialise bookings so two people can't take the same slot.
  perform pg_advisory_xact_lock(hashtext('ysa-booking'));

  v_local := p_starts_at at time zone 'Africa/Johannesburg';
  if not exists (
    select 1 from public.get_available_slots(v_local::date, p_reason_code) s where s.slot_start = p_starts_at
  ) then
    raise exception 'Sorry, that time is no longer available. Please choose another time.' using errcode = 'P0001';
  end if;

  -- Match an existing patient by phone; otherwise create a new one.
  select id into v_patient_id from public.patients where phone = v_phone order by created_at limit 1;
  if v_patient_id is null then
    insert into public.patients (full_name, phone, email, date_of_birth, whatsapp_consent, whatsapp_consent_at,
                                 source, is_new_from_booking)
    values (v_name, v_phone, v_email, p_date_of_birth, true, now(), 'online_booking', true)
    returning id into v_patient_id;
  else
    update public.patients
       set email = coalesce(email, v_email),
           date_of_birth = coalesce(date_of_birth, p_date_of_birth),
           whatsapp_consent = true,
           whatsapp_consent_at = case when whatsapp_consent then whatsapp_consent_at else now() end
     where id = v_patient_id;
  end if;

  insert into public.appointments (patient_id, reason_id, starts_at, ends_at, status, source, patient_note)
  values (v_patient_id, v_reason.id, p_starts_at, p_starts_at + make_interval(mins => v_reason.duration_minutes),
          'requested', 'online', v_note)
  returning id into v_appt_id;

  insert into public.notifications (type, title, body, patient_id, appointment_id)
  values ('booking_request', 'New booking request',
          v_name || ' — ' || v_reason.label || ' on ' || to_char(v_local, 'FMDy FMDD FMMon') || ' at ' || to_char(v_local, 'HH24:MI'),
          v_patient_id, v_appt_id);

  return jsonb_build_object('ok', true);
end $$;

-- Lock down: anon/authenticated may only call the booking functions.
revoke all on function public.get_booking_options() from public;
revoke all on function public.get_available_slots(date, text) from public;
revoke all on function public.get_available_dates(date, date, text) from public;
revoke all on function public.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) from public;
grant execute on function public.get_booking_options() to anon, authenticated;
grant execute on function public.get_available_slots(date, text) to anon, authenticated;
grant execute on function public.get_available_dates(date, date, text) to anon, authenticated;
grant execute on function public.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) to anon, authenticated;
grant execute on function public.normalize_phone(text) to anon, authenticated;
