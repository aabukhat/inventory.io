-- Custom inventory icon, shown in the sidebar instead of initials when set.
-- Free text, not validated as "real" emoji server-side — same posture as
-- other short display fields (subsection names, display names): a loose
-- length cap for defense-in-depth, no attempt at strict emoji-grapheme
-- validation, since multi-codepoint sequences (skin-tone modifiers, ZWJ
-- family/profession emoji) make that impractical to get right.
--
-- No new RPC: writes go through the same direct client update as
-- renameInventory() already uses, gated by the existing
-- inventories_update_owner RLS policy and enforce_inventory_update()
-- trigger (20260714042613_multi_inventory_sharing.sql) — both apply to
-- any column except the already-immutable type/owner_id, emoji included.

alter table public.inventories add column emoji text
  check (char_length(emoji) <= 8);
