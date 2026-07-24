-- Display name onboarding (Epic 2, Story 2.1).
-- `profiles.display_name` already existed (auto-filled from the email prefix
-- on signup); this adds an explicit "did the user actually choose one"
-- flag so new signups can be gated into a required onboarding step, while
-- existing users are grandfathered in and never see it.

alter table public.profiles
  add column display_name_set boolean not null default false;

-- grandfather in everyone who already has an account — onboarding only
-- applies to signups going forward.
update public.profiles set display_name_set = true;

create or replace function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));

  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    raise exception 'INVALID_LENGTH';
  end if;

  if v_name !~ '[[:alnum:]]' then
    raise exception 'INVALID_CONTENT';
  end if;

  if lower(v_name) ~ '(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut)' then
    raise exception 'INVALID_CONTENT';
  end if;

  update public.profiles
    set display_name = v_name, display_name_set = true
    where id = auth.uid();
end;
$$;
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

alter publication supabase_realtime add table public.profiles;
