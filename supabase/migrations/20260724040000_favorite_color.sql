-- Favorite color (Epic 2, Story 2.3).
-- Stored as a token (not raw hex) per the story's Technical Notes, so the
-- design system can retune shades later without a data migration. Keep this
-- list in sync with COLOR_PALETTE in src/lib/colorPalette.js.

alter table public.profiles add column favorite_color text
  check (favorite_color in (
    'lime', 'sky', 'amber', 'violet', 'pink',
    'mint', 'red', 'yellow', 'indigo', 'green'
  ));

create or replace function public.set_favorite_color(p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_color not in (
    'lime', 'sky', 'amber', 'violet', 'pink',
    'mint', 'red', 'yellow', 'indigo', 'green'
  ) then
    raise exception 'INVALID_COLOR';
  end if;

  update public.profiles set favorite_color = p_color where id = auth.uid();
end;
$$;
revoke all on function public.set_favorite_color(text) from public, anon;
grant execute on function public.set_favorite_color(text) to authenticated;
