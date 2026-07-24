# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # start Vite dev server
npm run build              # production build
npm run preview            # preview the production build locally
npm run generate-products  # regenerate the liquor section of src/lib/products.js from Iowa's public liquor-sales dataset
```

There is no test suite and no linter/formatter configured in this repo — don't invent `npm test`/`npm run lint` commands or assume CI runs them. The production build currently emits a ">500kB chunk" warning; that's pre-existing (unsplit vendor bundle), not a regression to chase unless asked.

### Database (Supabase)

Schema lives entirely in `supabase/migrations/*.sql`, applied in filename order (`YYYYMMDDHHMMSS_description.sql`). There is no separate `schema.sql` to keep in sync — the migrations *are* the schema; read them to understand current state, and add a new migration for any change rather than editing an already-applied one (comment-only fixes to old migrations are fine; behavioral edits are not, they won't replay).

```bash
npx supabase link --project-ref ebckeamwutuyovwezrrw   # project: "inventory.io"
npx supabase db push                                    # apply pending migrations to the linked project
npx supabase db query --linked "<sql>"                  # run one-off SQL against the linked project directly
npx supabase db query --linked --file path/to.sql       # same, from a file
```

**Known gotcha:** `supabase migration list` / `db push` currently show 5 local migrations as not recorded in the remote's history table even though their schema *is* live on the linked project (`20260723193000`, `20260723200000`, `20260723201000`, `20260724060000`, `20260724070000`) — verified directly via `db query`, not a guess. This happened because those were applied via `db query`/dashboard SQL rather than `db push`, without a follow-up `migration repair`. **Don't run `db push --include-all`** to "fix" this — it will try to replay non-idempotent `CREATE TABLE`/`ADD COLUMN` statements against objects that already exist and fail. If you need to push a *new* migration and `db push` complains about the gap, apply just your new file with `db query --linked --file <your-new-migration>.sql` instead, the same way the 5 above were applied. Only run `migration repair` to close this gap if the user asks for it explicitly — leaving it alone has been a deliberate choice, not an oversight.

Local dev env vars go in `.env.local` (copy from `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Architecture

**Stack:** React 19 + Vite, Tailwind v4 + shadcn/ui (`components.json`, style `radix-nova`), Supabase (Postgres + Auth + Realtime + Storage), deployed to Netlify. Path alias `@/` → `src/` (see `vite.config.js` / `jsconfig.json`).

**Data flow:** Components → `src/hooks/*.js` (React state + realtime subscription) → `src/lib/*.js` (Supabase `.from()`/`.rpc()` calls + error translation) → Supabase (RLS-gated tables, or `SECURITY DEFINER` RPCs for anything with cross-row invariants or business-rule validation). Almost every domain has this exact three-layer shape; when adding a feature, follow it rather than fetching data ad hoc inside a component.

### Data model

All tables have RLS enabled. `owner_id`/`user_id`/`inventory_id` columns reference `auth.users`/`public.inventories` with `on delete cascade` unless noted.

- **`profiles`** (id = `auth.users.id`) — `email`, `display_name`, `display_name_set` (bool, gates onboarding), `avatar_url` (storage path, nullable), `favorite_color` (text, `check` against the fixed 10-token palette), `theme_preference` (`'dark'|'light'`, default `'dark'`).
- **`inventories`** — `name`, `type` (`'personal'|'shared'`, default `'shared'`), `owner_id`, `emoji` (nullable, ≤8 chars, shown in the sidebar in place of initials when set — no server-side emoji-grapheme validation, just a loose length cap). Unique partial index: exactly one `type='personal'` row per `owner_id`.
- **`inventory_members`** — composite PK `(inventory_id, user_id)`, `role` (`'owner'|'editor'|'contributor'|'viewer'`), `invited_by`.
- **`inventory_subsections`** — `inventory_id`, `preset_key` (nullable — null means custom, not a preset), `name` (1–40 chars, case-insensitively unique per inventory), `position` (int, explicit ordering), `is_uncategorized` (bool). Unique partial indexes: one `is_uncategorized` row per inventory, and `(inventory_id, preset_key)` where `preset_key is not null` (a given preset can only be added once per inventory).
- **`drinks`** — `drink_name` (renamed from `name`), `brand` (nullable — grouping requires it; deliberately no `not null` constraint, see Postgres check-constraint gotcha below), `flavor` (nullable), `type` (default `'beer'`), `quantity` (default `0`), `unit`/`unit_size`, `last_change` (free text, e.g. `"Alex +1 · Jul 23, 2:14 PM"`, parsed back by `src/lib/variantGrouping.js`'s `parseLastChange`), `inventory_id`, `subsection_id` (both `not null`).
- **`pack_size_presets`** — `inventory_id`, `type` (`check` in the 5 drink types), `sizes` (`int[]`, e.g. `{6,12,24}`). Unique `(inventory_id, type)`.
- **`drink_frequency`** — per-user, per-inventory usage stats: `user_id`, `inventory_id`, `brand`/`drink_name`/`flavor`/`type`/`unit`/`unit_size`, `count`, `last_added_at`, plus generated stored columns `norm_brand`/`norm_drink_name`/`norm_flavor` (lower+trim) that back the unique conflict target `(user_id, inventory_id, norm_brand, norm_drink_name, norm_flavor)`. RLS is select-own-only with **no insert/update policy** — all writes go through `record_drink_frequency()`.
- **`storage.buckets['avatars']`** — public bucket, 5MB server-side limit, `image/webp` only. Client validates up to 15MB raw upload client-side (`src/lib/avatar.js`) *before* resizing/re-encoding to webp, so the effective ceiling is whatever the resize produces, not the raw upload size.

### Key RPCs (all `SECURITY DEFINER`, `revoke all ... from public, anon` + `grant ... to authenticated`)

| RPC | Purpose | Notable validation |
|---|---|---|
| `create_shared_inventory(name)` | Create a shared inventory | Caps owned inventories at 10; also creates the owner membership + Uncategorized subsection in the same call |
| `invite_member(inventory_id, email, role)` | Invite by email | Owner-only; role must be editor/contributor/viewer (never owner); errors `USER_NOT_FOUND`/`NOT_OWNER` |
| `add_subsection(inventory_id, preset_key, name)` | Add a subsection | Owner/editor; unique-violation is disambiguated by constraint name into `SUBSECTION_ALREADY_EXISTS` vs `SUBSECTION_NAME_TAKEN` |
| `reorder_subsections(inventory_id, ids[])` | Persist drag-reorder | Owner/editor; rejects if `ids[]` length doesn't match the inventory's actual subsection count |
| `delete_subsection(id)` | Delete a subsection | Owner/editor; blocks deleting the Uncategorized row; reassigns its items to Uncategorized first |
| `move_drinks(drink_ids[], subsection_id)` | Move one or many drinks | Owner/editor/contributor; requires all ids exist, belong to one inventory, and the target subsection belongs to that same inventory |
| `set_display_name(name)` | Set/change display name | 2–30 chars, must contain alnum, profanity blocklist — **mirrored client-side** in `src/lib/displayName.js`, keep both in sync |
| `set_avatar_path(path)` | Point profile at an uploaded avatar | Path must be prefixed with the caller's own `auth.uid()` |
| `set_favorite_color(color)` | Set favorite color | Must be one of the 10 fixed tokens — **mirrored client-side** in `src/lib/colorPalette.js` |
| `set_theme_preference(theme)` | Set light/dark | Must be `'dark'` or `'light'` |
| `record_drink_frequency(...)` | Log a drink add for quick-picks | Owner/editor/contributor; the sole writer of `drink_frequency` |

### Triggers

- **`handle_new_user()`** (after insert on `auth.users`) — bootstraps a new signup: `profiles` row, personal `inventories` row, owner `inventory_members` row, and an Uncategorized `inventory_subsections` row, all in one shot.
- **`enforce_drink_update_permissions()`** (before update on `drinks`) — the real security boundary behind `src/lib/permissions.js`'s client-side gating. Owner/editor: unrestricted. Contributor: can raise quantity but not lower it (`CONTRIBUTOR_CANNOT_DECREASE`), and can't touch `drink_name`/`type`/`unit`/`unit_size` (`CONTRIBUTOR_CANNOT_EDIT_DETAILS` — note this predates `brand`/`flavor` and doesn't currently gate those two columns). Anything else: `INSUFFICIENT_ROLE`. Changing `inventory_id` directly is always rejected (`MOVE_NOT_SUPPORTED` — use the `move_drinks` RPC).
- **`enforce_inventory_update()`** (before update on `inventories`) — owner-only; `type`/`owner_id` are immutable even for the owner.
- **`prevent_personal_inventory_delete()`** (before delete on `inventories`) — blocks deleting any `type='personal'` row.
- **`protect_owner_membership()`** (before update/delete on `inventory_members`) — blocks demoting/removing an owner's membership *while the inventory still exists*; the guard is conditional specifically so that deleting the whole inventory (which cascades into deleting the owner's membership row too) isn't blocked by its own trigger.

### Permission model

`src/lib/permissions.js` is pure UI gating (hide/disable controls) and its header comment names, function by function, exactly which trigger/RLS policy in which migration file it mirrors. **The database is the actual security boundary, not this file** — but the two must be changed together, since a client that shows a control the server will reject is a real usability bug (see the contributor quantity-update trigger bug fixed in `20260724060000`, which was invisible client-side because the UI correctly thought contributors *should* be able to increase quantity).

| capability | owner | editor | contributor | viewer |
|---|:---:|:---:|:---:|:---:|
| add items | ✓ | ✓ | ✓ | |
| increase quantity | ✓ | ✓ | ✓ | |
| decrease quantity | ✓ | ✓ | | |
| edit item details | ✓ | ✓ | | |
| delete items | ✓ | ✓ | | |
| manage subsections | ✓ | ✓ | | |
| manage pack sizes | ✓ | ✓ | | |
| manage members / invite | ✓ | | | |

`current_user_role(inventory_id)` (SQL) is the single source of truth every RLS policy and trigger calls into — never duplicate the role lookup logic itself.

### Realtime sync goes through one hook

`src/hooks/useRealtimeTable.js` centralizes the get-session → `setAuth` → channel subscribe → cleanup boilerplate for Supabase Realtime, taking `{ channelName, table, filter?, event?, enabled? }` plus an `onEvent` callback. Every live-updating table subscribes through it: `drinks` (Inventory.jsx), `inventory_members` (useInventories), `profiles` (useProfile, and again with no filter + `event: 'UPDATE'` in MembersModal so it catches *other* members' name/avatar changes), `inventory_subsections` (useSubsections), `pack_size_presets` (usePackSizes). **Don't hand-roll another realtime `useEffect`** — extend this hook if a new need doesn't fit its shape. A table must also be added to the `supabase_realtime` publication in its own migration (`alter publication supabase_realtime add table ...`) or subscriptions silently receive nothing — `drink_frequency` deliberately has no realtime subscription and isn't in the publication, since RLS scopes it to `user_id = auth.uid()` and only the current user's own actions can ever change their own rows.

### `src/lib/` and `src/hooks/` — one module per domain, paired

Each `lib/*.js` file owns Supabase calls for one concern and translates raw Postgres error codes (exception messages like `'INVENTORY_CAP_REACHED'`) into user-facing `Error` messages via a local `friendly*Error()` helper — grep for the RPC's `raise exception '...'` string in the migrations to find the matching client-side translation, they're always named after each other. `hooks/*.js` pair close to 1:1 with these to add React state + realtime (`useInventories`, `useProfile`, `useSubsections`, `usePackSizes`, `useFrequentDrinks`). `useFrequentDrinks` is the deliberate exception with no realtime leg, per above. Components consume the hooks; they call into `lib/` directly only for one-off mutations that don't need local reactive state (e.g. `renameInventory`, `deleteInventory` from `MembersModal`).

### Drink variants and grouping

Rows sharing the same `subsection_id` + normalized `brand`+`drink_name` (`src/lib/variantGrouping.js`'s `normalizeKey`, case/whitespace-insensitive) collapse into one expandable group row in `Inventory.jsx`. Rows with no `brand` never group — every pre-migration row (from before `brand` existed) renders as an ungrouped single item for this reason, not by explicit versioning. Moves are always batched through `move_drinks(uuid[], ...)` (never the retired single-id `move_drink`) so an expanded group's drag-and-drop moves all its variants atomically. A variant that hits zero quantity while its group is expanded is kept as a re-stock placeholder instead of being deleted (`Inventory.jsx`'s `adjustQty`, `isVariant` param) — a lone (non-grouped) item hitting zero is still deleted with the fade-out animation as before. Drag-and-drop payload is a JSON array of drink ids under the `ITEM_DRAG_MIME` (`'application/x-drink-id'`) mime type (`src/lib/subsections.js`) — a single-item drag is just an array of length 1, so `Subsections.jsx`'s drop handler and `Inventory.jsx`'s row/group drag sources share one code path regardless of whether one row or a whole group is being dragged.

### Migration hygiene

When an RPC or trigger function is replaced, the old one is dropped in the same migration that replaces it (e.g. `move_drink` → `move_drinks`, with an explicit `drop function if exists public.move_drink(uuid, uuid);`), with a comment explaining why. Migrations here are expected to leave the schema in a coherent end state at every step, not accumulate superseded-but-still-present functions. Follow this pattern for future replacements. (The one known miss is documented above: the 2026-07-23 `drink_name` rename didn't propagate into `enforce_drink_update_permissions()`'s body, since Postgres doesn't rewrite plpgsql function text on a column rename — fixed 2026-07-24. If you rename a column, grep all migrations for the old name to catch this class of bug before it ships.)

### Theming

`src/index.css` defines the app's own CSS variables (`--bg`, `--surface`, `--accent`, `--badge-*-bg`/`--badge-*-fg`, etc.) under `:root` (dark, default) and `:root[data-theme="light"]` (override), then aliases shadcn's semantic tokens (`--background`, `--primary`, `--card`, ...) to those — so shadcn components pick up this app's palette instead of shadcn's defaults, and adding a new shadcn component won't reintroduce shadcn's own colors. The active theme is a `data-theme` attribute set on `<html>` in `App.jsx`, driven by the signed-in user's server-persisted `profiles.theme_preference` — not `prefers-color-scheme`, and not localStorage (an explicit product decision, so it follows the user across devices). Drink-type badge colors are theme-tokenized (`src/lib/badgeStyles.js`, `TYPE_BADGE_CLASSES`) rather than hardcoded hex in components, specifically because the bright dark-mode-tuned hex values were found to be illegible light-on-light in light mode — new per-type or per-state colors should follow the same CSS-variable pattern, not inline hex.

### Product catalog

`src/lib/products.js` has a hand-maintained beer/seltzer/cider section and an auto-generated liquor section bounded by `// BEGIN:liquor` / `// END:liquor` comments, regenerated by `scripts/generate-products.js` from Iowa's public liquor-sales open data (category-mapped, deduplicated preferring the entry closest to 750ml). A `// BEGIN:manual` / `// END:manual` block below it holds manually-added liquor entries that survive regeneration — add one-off liquor products there, never inside the generated block (a regeneration run will overwrite it).

## Development guidelines

These describe conventions this codebase already follows — match them rather than introducing a parallel pattern, even a "better" one, without discussing it first:

- **New tables default to direct client CRUD gated by RLS.** Reach for a `SECURITY DEFINER` RPC only when there's a concrete reason a plain policy-gated `.insert()`/`.update()` can't express — an atomic counter (`record_drink_frequency`'s `count = count + 1`), a cross-row invariant (`reorder_subsections` validating the full id set), or Postgres-level business-rule validation with custom error codes (`set_display_name`'s length/profanity checks). `pack_size_presets` is the plain-RLS baseline to compare against; `drink_frequency` documents its own RPC exception directly in its migration's header comment — write a similarly explicit justification if you add another one.
- **Client-side validation and permission checks must exactly mirror their server-side counterpart, and say so.** `displayName.js`'s profanity regex and `set_display_name()`'s are duplicated on purpose (fast client feedback + a real server boundary) — but they're kept in lockstep and each comments where its counterpart lives. Never let a client check silently drift from what the server actually enforces; when you change one, grep for and update the other.
- **One `lib/` module per domain, one paired `hooks/` file if it needs live state.** Don't add a new top-level state-fetching pattern; extend an existing domain module or add a new one shaped like the existing ones.
- **Realtime always goes through `useRealtimeTable`,** and any new realtime table gets added to the `supabase_realtime` publication in the same migration that creates it.
- **When a function/RPC is superseded, drop the old one in the same migration.** Don't leave two code paths doing the same thing, and don't rename a column or function without grepping every migration for the old name first (see the 2026-07-24 bugfix).
- **No hardcoded hex/colors in components.** Route anything visual through the CSS variables in `index.css` (extend `badgeStyles.js`/`colorPalette.js`-style token maps) so both themes stay correct automatically.
- **Prefer small, explicit, one-purpose functions over a generic/configurable engine.** `permissions.js`'s eight one-line role checks are a deliberate example — resist collapsing them into a single table-driven or config-driven permission function; the explicit form is what made the contributor-trigger mismatch this session easy to spot and cross-reference in the first place.
- **Migrations are immutable history once applied** — express a schema change as a new migration file, never by editing an old one's logic (comment-only fixes, like removing a stale local file path, are fine).
- **Prefer a shared component over a per-file implementation for anything that renders the same way in more than one place.** This codebase grew by copy-pasting small display elements (a label style, an error message, the wordmark, an initials-avatar) across files instead of sharing them, and every one of those eventually drifted (mismatched font sizes, a stale column reference, a hand-rolled copy of `Card`'s own styling). Current shared display components live directly in `src/components/` (not `ui/`, which is reserved for shadcn-generated primitives): `Wordmark`, `FieldLabel`, `FormError`, and `Avatar` (which also exports the `initials()` helper — import it rather than redefining it). Before writing a new one-off label, error message, badge, or avatar-like element, check whether one of these already covers it or should be extended to; before adding a second copy of any small presentational block, extract it into `src/components/` instead.
