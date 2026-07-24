-- Profile picture uploads (Epic 2, Story 2.2).
-- Client resizes/crops to a square before upload and always writes to the
-- same per-user path (`{uid}/avatar.webp`, upsert) so re-uploading replaces
-- the old file instead of accumulating storage bloat.

alter table public.profiles add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- p_path null clears the avatar (used by "remove photo"). When set, must be
-- the caller's own storage path — the object itself is already scoped to
-- auth.uid() by the storage policies above, this just keeps profiles.avatar_url
-- consistent with what the caller is actually allowed to have uploaded.
create or replace function public.set_avatar_path(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is not null and p_path !~ ('^' || auth.uid()::text || '/') then
    raise exception 'INVALID_PATH';
  end if;

  update public.profiles set avatar_url = p_path where id = auth.uid();
end;
$$;
revoke all on function public.set_avatar_path(text) from public, anon;
grant execute on function public.set_avatar_path(text) to authenticated;
