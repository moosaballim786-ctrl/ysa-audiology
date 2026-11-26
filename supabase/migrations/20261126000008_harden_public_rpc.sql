-- ════════════════════════════════════════════════════════════════════
-- YSA · Security advisor hardening
-- The public booking functions must run with elevated rights (they read
-- appointments to compute free slots and insert booking requests), but they
-- should not be SECURITY DEFINER functions in the exposed `public` schema.
-- Move the privileged implementations to the non-exposed `private` schema and
-- expose thin SECURITY INVOKER wrappers in `public`.
-- ════════════════════════════════════════════════════════════════════

alter function public.get_available_slots(date, text) set schema private;
alter function public.get_available_dates(date, date, text) set schema private;
alter function public.get_booking_options() set schema private;
alter function public.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) set schema private;

-- Implementations reference each other through the public wrappers created below.

create function public.get_available_slots(p_date date, p_reason_code text)
returns table (slot_start timestamptz, slot_label text)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_available_slots(p_date, p_reason_code)
$$;

create function public.get_available_dates(p_from date, p_to date, p_reason_code text)
returns setof date
language sql stable security invoker set search_path = '' as $$
  select * from private.get_available_dates(p_from, p_to, p_reason_code)
$$;

create function public.get_booking_options()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.get_booking_options()
$$;

create function public.request_booking(
  p_reason_code text,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_date_of_birth date default null,
  p_note text default null,
  p_consent boolean default false,
  p_website text default null
)
returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select private.request_booking(p_reason_code, p_starts_at, p_full_name, p_phone, p_email, p_date_of_birth, p_note, p_consent, p_website)
$$;

revoke all on function public.get_available_slots(date, text) from public;
revoke all on function public.get_available_dates(date, date, text) from public;
revoke all on function public.get_booking_options() from public;
revoke all on function public.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) from public;

grant execute on function public.get_available_slots(date, text) to anon, authenticated;
grant execute on function public.get_available_dates(date, date, text) to anon, authenticated;
grant execute on function public.get_booking_options() to anon, authenticated;
grant execute on function public.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) to anon, authenticated;

grant execute on function private.get_available_slots(date, text) to anon, authenticated;
grant execute on function private.get_available_dates(date, date, text) to anon, authenticated;
grant execute on function private.get_booking_options() to anon, authenticated;
grant execute on function private.request_booking(text, timestamptz, text, text, text, date, text, boolean, text) to anon, authenticated;
