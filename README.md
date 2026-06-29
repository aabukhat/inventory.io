# 🍺 drink inventory

A lightweight shared drink tracker for you and your roommate. Live updates across devices, PIN-based identity, change history per item.

**Stack:** React + Vite · Supabase (Postgres + Realtime) · Netlify

---

## setup (one-time, ~15 min)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick any region, save the database password)
3. Once the project is ready, go to **SQL Editor → New query**
4. Paste the contents of `supabase-setup.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`) 
https://ebckeamwutuyovwezrrw.supabase.co

   - **anon public** key
sb_publishable_FG_d9A5C6GJ_0dtT4kz5Sw_3QMqs_Nz

### 2. Local dev

```bash
# clone and install
git clone https://ebckeamwutuyovwezrrw.supabase.co
cd drink-inventory
npm install

# set up env
cp .env.example .env.local
# edit .env.local and fill in your Supabase URL + anon key
# also set your PINs (default: me=1234, roommate=5678)

# run locally
npm run dev
```

Your `.env.local` should look like:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PIN_ME=yourpin
VITE_PIN_ROOMMATE=roommatespin
```

### 3. Deploy to Netlify

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com), sign up (free), and click **Add new site → Import from Git**
3. Select your repo
4. Set build command: `npm run build`, publish directory: `dist`
5. Go to **Site configuration → Environment variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PIN_ME`
   - `VITE_PIN_ROOMMATE`
6. Trigger a deploy — you'll get a free `.netlify.app` URL to share

---

## usage

- **Sign in** with your PIN (each person picks their own)
- **Add items** one at a time or paste a bulk list (`name, type, quantity`)
- **+/−** buttons adjust quantity and stamp who changed it and when
- **Export** downloads a CSV snapshot
- Changes appear **live** on both devices (no refresh needed)

---

## changing PINs

Update the `VITE_PIN_ME` and `VITE_PIN_ROOMMATE` environment variables in Netlify and redeploy. PINs are never stored in the database.

---

## project structure

```
src/
  components/
    Login.jsx      # PIN entry screen
    Inventory.jsx  # main table + controls
    Modals.jsx     # add/edit/bulk modals
  lib/
    supabase.js    # client + PIN session logic
  App.jsx          # auth state router
  main.jsx
  index.css
supabase-setup.sql # run once in Supabase SQL editor
netlify.toml       # SPA redirect rule
.env.example       # copy to .env.local
```
