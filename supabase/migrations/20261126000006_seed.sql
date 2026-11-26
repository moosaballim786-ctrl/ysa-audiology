-- ════════════════════════════════════════════════════════════════════
-- YSA · Default settings (all editable in Settings)
-- ════════════════════════════════════════════════════════════════════

insert into public.practice_settings (id) values (1) on conflict (id) do nothing;

-- Mon–Fri 08:30–17:00 with lunch 13:00–14:00, Sat 08:30–13:00, Sun closed.
insert into public.working_hours (weekday, is_open, open_time, close_time, lunch_start, lunch_end) values
  (1, true,  '08:30', '17:00', '13:00', '14:00'),
  (2, true,  '08:30', '17:00', '13:00', '14:00'),
  (3, true,  '08:30', '17:00', '13:00', '14:00'),
  (4, true,  '08:30', '17:00', '13:00', '14:00'),
  (5, true,  '08:30', '17:00', '13:00', '14:00'),
  (6, true,  '08:30', '13:00', null, null),
  (7, false, '08:30', '13:00', null, null)
on conflict (weekday) do nothing;

-- Public booking reasons (exactly two) + staff-only reasons for the schedule.
insert into public.appointment_reasons (code, label, duration_minutes, color, public_bookable, sort_order) values
  ('hearing_assessment', 'Hearing assessment', 45, 'teal', true, 1),
  ('wax_removal', 'Wax removal or cleaning', 20, 'blue', true, 2),
  ('hearing_aid_service', 'Hearing aid service / check-up', 30, 'sage', false, 3),
  ('hearing_aid_fitting', 'Hearing aid fitting', 60, 'sage', false, 4),
  ('follow_up', 'Follow-up', 20, 'amber', false, 5),
  ('other', 'Other', 30, 'slate', false, 6)
on conflict (code) do nothing;

insert into public.recall_types (name, default_interval_months, reason_text, trigger_reason_codes, is_custom, sort_order) values
  ('Annual hearing test', 12, 'your annual hearing test', '{hearing_assessment}', false, 1),
  ('Hearing aid service / check-up', 6, 'your hearing aid service and check-up', '{hearing_aid_service,hearing_aid_fitting}', false, 2),
  ('Hearing aid upgrade', 48, 'a hearing aid upgrade assessment — you may be due for new hearing aids', '{hearing_aid_fitting}', false, 3),
  ('Wax removal / cleaning', 6, 'your routine wax removal and ear cleaning', '{wax_removal}', false, 4),
  ('Custom', null, '', '{}', true, 5)
on conflict (name) do nothing;
