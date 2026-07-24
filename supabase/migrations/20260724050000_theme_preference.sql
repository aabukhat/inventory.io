-- Light mode toggle (Epic 2, Story 2.4).
-- Per-user, server-persisted so it follows the user across devices/sessions
-- (not just localStorage). Defaults to 'dark' — matches current behavior,
-- light is an explicit opt-in (confirmed with the user rather than
-- following prefers-color-scheme on first run).

alter table public.profiles add column theme_preference text not null default 'dark'
  check (theme_preference in ('dark', 'light'));

create or replace function public.set_theme_preference(p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_theme not in ('dark', 'light') then
    raise exception 'INVALID_THEME';
  end if;

  update public.profiles set theme_preference = p_theme where id = auth.uid();
end;
$$;
revoke all on function public.set_theme_preference(text) from public, anon;
grant execute on function public.set_theme_preference(text) to authenticated;
