-- ════════════════════════════════════════════════════════════════════
-- YSA · Private scan storage + realtime
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-scans', 'patient-scans', false, 10485760, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "staff read scans" on storage.objects for select to authenticated
  using (bucket_id = 'patient-scans' and (select private.is_staff()));
create policy "staff upload scans" on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-scans' and (select private.is_staff()));
create policy "staff update scans" on storage.objects for update to authenticated
  using (bucket_id = 'patient-scans' and (select private.is_staff()))
  with check (bucket_id = 'patient-scans' and (select private.is_staff()));
create policy "staff delete scans" on storage.objects for delete to authenticated
  using (bucket_id = 'patient-scans' and (select private.is_staff()));

-- Live updates for the notification badge, booking requests and today's schedule.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.appointments;
