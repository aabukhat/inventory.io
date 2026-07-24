# 🧺 inventory.io

A shared drink inventory for your household — track what's on hand, restock the right amount, and never double-buy again. Live updates across devices, per-person accounts, role-based sharing, and per-item change history.

**Stack:** React 19 + Vite · Tailwind v4 + shadcn/ui · Supabase (Postgres + Auth + Realtime + Storage) · Netlify

---

## features

- **Accounts** — email/password sign-up via Supabase Auth, with a required display-name onboarding step for new users.
- **Personal + shared inventories** — everyone gets a personal inventory automatically; anyone can also create shared ones (up to 10 owned, during beta) and invite others by email.
- **Roles per shared inventory** — owner / editor / contributor / viewer, enforced both in the UI (`src/lib/permissions.js`) and at the database layer (RLS policies + triggers, so the UI checks are a convenience, not the security boundary).
- **Subsections** — organize an inventory into sections (preset ones like Beer/Liquor/Wine, or custom names); drag-and-drop items or whole variant groups between them.
- **Drink variants** — items sharing a brand + name (e.g. different flavors of the same seltzer) collapse into one expandable row.
- **Pack-size quick-add** — configurable per drink type, per inventory (e.g. one-tap "+12" for beer).
- **Frequent-drink quick-picks** — personalized, recency-weighted "your usual" suggestions when adding an item.
- **Profiles** — display name, avatar upload (client-side cropped/resized before upload), a favorite-color fallback avatar, and a light/dark theme toggle — all synced server-side across devices.
- **Bulk add & CSV export.**
- **Live sync** — everything above updates in real time across every open session via Supabase Realtime.

---

## setup (one-time)

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don't have it, then link this repo to your project:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Apply the schema — every table, RLS policy, and RPC lives in `supabase/migrations/`, applied in order:
   ```bash
   supabase db push
   ```
4. In the Supabase dashboard, go to **Settings → API** and copy the **Project URL** and **anon/publishable key**.

### 2. Local dev

```bash
git clone <this-repo>
cd drink-inventory
npm install

cp .env.example .env.local
# edit .env.local with your Supabase URL + anon key

npm run dev
```

### 3. Deploy to Netlify

1. Push this repo to GitHub.
2. On [netlify.com](https://netlify.com): **Add new site → Import from Git**, select the repo.
3. Build command: `npm run build`, publish directory: `dist` (already set in `netlify.toml`).
4. Add environment variables under **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Trigger a deploy.

---

## usage

- **Sign up / sign in** with email + password. First-time users pick a display name before entering their inventory.
- **Add items** one at a time (with autocomplete against a built-in product catalog and your own frequent picks) or paste a bulk list (`name, type, quantity`).
- **+/−** buttons adjust quantity and stamp who changed it and when.
- **Organize** items into subsections; drag rows (or whole collapsed variant groups) between them.
- **Export** downloads a CSV snapshot.
- **Manage** a shared inventory (rename, invite/remove members, change roles, delete) from the "manage" button if you're the owner.
- Changes appear **live** for everyone viewing the same inventory — no refresh needed.

---

## project structure

```
src/
  components/       # Screens, modals, and Sidebar; ui/ holds shadcn primitives
  hooks/            # Data-fetching + realtime-subscription hooks per domain
  lib/              # Supabase client + one module per domain (inventories,
                     # profiles, subsections, packSizes, drinkFrequency,
                     # permissions, avatar, colorPalette, products, ...)
  App.jsx           # Auth/onboarding/routing shell
  main.jsx
  index.css         # Theme tokens (dark default, light override) + shadcn setup
supabase/
  migrations/       # Full schema history — tables, RLS policies, RPCs
scripts/
  generate-products.js  # Regenerates the liquor section of src/lib/products.js
                         # from Iowa's public liquor sales dataset (see script header)
netlify.toml
.env.example
```

## regenerating the product catalog

`src/lib/products.js` ships a static beer/seltzer/cider list plus a liquor list generated from Iowa's public liquor sales data. To refresh the liquor section:

```bash
npm run generate-products
```

This only rewrites the section between the `BEGIN:liquor`/`END:liquor` markers; anything you've added manually between `BEGIN:manual`/`END:manual` is preserved.
