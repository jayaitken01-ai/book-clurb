# 📚💕 All Booked Up

A cute, pink, phone-friendly book club app. React + Vite on the front, Supabase for the database, logins, and image storage.

## What's inside

| Feature | Where it lives |
|---|---|
| 🏠 The book we're reading right now | Home |
| 📅 A meetings board — when, where, what we're doing, who's coming | Home |
| 📍 Chapter updates — emoji mood + a comment, spoiler-locked | Home, and each book's **Updates** tab |
| 💭 A theory board per book — your own categories, threads and replies | Theories, and each book's **Theories** tab |
| 😏 A ten-emoji mood scale for how a chapter landed | The **+ Update** button |
| 🗳️ Polls in two phases — everyone suggests, then everyone votes | Polls |
| 📋 A TBR shelf of everything that didn't win | Library → TBR |
| ⭐ A proper review template + the club's combined verdict | Each book's **Reviews** tab |
| 📚 Every book we've read, past boards and updates included | Library |
| 🏷️ Genres on every book | Tap a book — shown under the title |
| 🎀 Profiles with name, phone, email, photo | Me |

**Every book keeps its own everything.** Tap a book you finished two years ago and its theory board, chapter updates and reviews are all still there, exactly as they were.

---

## The spoiler wall 🔒

This is the part worth understanding, because it's enforced by the *database*, not just hidden in the app.

Each person has a bookmark — "I'm on chapter 12" — for each book. When you ask for chapter updates, Postgres only ever hands back posts for chapters at or below your bookmark. Someone poking at the browser console gets the same filtered list you do. There's nothing to peek at.

- Posting an update for chapter 20 moves your bookmark to 20 automatically.
- You can also move it by hand (**Change** on the Updates tab) if you've been reading without posting.
- Tick **I finished this book** and everything unlocks at once.
- The app tells you how many posts are still locked ahead of you — a count, never a word of content.

Theory threads work a little more gently: they're tagged with a chapter and blurred if you're behind, but you *can* tap through if you're feeling brave. That's deliberate — theories are usually speculation, chapter updates are usually reactions to what just happened.

---

## Setup — about 20 minutes

### 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → **New project**.
2. Name it `all-booked-up`, pick a strong database password (save it), choose a region near you.
3. Wait for it to provision (~2 min).

### 2. Build the database

1. Supabase → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql`, copy the whole file, paste it in.
3. **Run**. You should see "Success. No rows returned."

That creates every table, all the security rules, the spoiler policy, and the two image buckets.

> This schema has been run against a real Postgres 16 database with 38 checks covering the spoiler wall, the full poll lifecycle, TBR routing, meeting RSVPs, the one-current-book rule, genres and the review template. All passing — see `supabase/tests/` for the suite and what each test proves.

### 3. Turn off email confirmation (recommended for a small club)

**Authentication → Sign In / Providers → Email** → toggle **Confirm email** *off* → Save.

Leave it on if you'd rather verify addresses — the app handles both.

### 4. Get your keys

**Project Settings → API**:

- **Project URL** — `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting with `eyJ…`

> The anon key is *meant* to be public. Row Level Security protects your data, not key secrecy. Never put the **service_role** key in this app.

### 5. Run it

```bash
npm install
cp .env.example .env
```

Put your two values in `.env`:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then:

```bash
npm run dev
```

Open the link it prints (usually http://localhost:5173), create your profile, and you're in.

### 6. Add your first book

Library → **+ Add book** → title, chapter count, status **Reading now**. It becomes your homepage instantly, and its theory board arrives pre-stocked with three categories (Predictions, Characters, General chat). Anyone can add more.

---

## Putting it on GitHub

```bash
git init
git add .
git commit -m "All Booked Up"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/all-booked-up.git
git push -u origin main
```

`.env` is already in `.gitignore` — your keys stay off GitHub on purpose. You'll paste them into the host instead.

## Deploying

**Vercel** (easiest, free):

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your repo.
2. It auto-detects Vite. Before deploying, open **Environment Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy, and send the link to the club.

**Netlify** is the same: build command `npm run build`, publish directory `dist`, same two variables.

**After deploying:** Supabase → **Authentication → URL Configuration** → set **Site URL** to your live link, or password-reset emails will point at localhost.

---

## Picking the next book

Polls run in two phases, and nobody has to press anything to move them along.

**1. Collecting (24 hours by default).** Anyone starts a poll with their own suggestion. Everyone else then has a day to add one of their own — title, author and genres. One suggestion each, so nobody can flood the ballot, and you can swap yours out any time before the window shuts.

**2. Voting (24 or 48 hours, set by whoever started it).** Suggestions lock. One vote each, changeable until the clock runs out.

**Then it settles itself.** The winner becomes the book on the homepage, with a fresh theory board and everyone's chapter count back at zero. Every suggestion that didn't win moves to the **TBR shelf** in the Library, where it waits to be suggested again next time — and if a TBR book later wins, it's promoted rather than duplicated.

The database does the settling, not a background job: whenever anyone opens the app it calls `settle_polls()`, which moves along any poll whose clock has run out. Nothing depends on a particular person being online at the right moment. A poll nobody voted in just closes, and everything in it goes to TBR.

## How it works day to day

- Only one book is "reading now" at a time. A new one files the old one under Finished — nothing is deleted, nothing is archived out of reach.
- You don't have to update every chapter. Post when a chapter wrecks you, skip the ones that don't.
- Covers can be added or swapped any time: open a book, **Edit details**, then **Add a cover**. A photo of your own copy works.
- Your book count goes up when you tick **I finished this book**. Club total lives in the Library, personal counts on your profile and in the members list.

## Meetings

The board sits on the homepage, under whatever we're reading.

Anyone can post one: a title, the date and time, where it is, and what we'll be doing. Everyone else answers with one of two buttons — **I'll be there** or **Can't make it**. Tapping your answer again clears it, and changing your mind replaces your old answer rather than adding a second one.

Under each meeting you get the faces of everyone coming and a short line naming whoever can't. Only the person who posted it can edit or remove it.

Meetings disappear from the board four hours after they start, so nobody has to tidy up after themselves.

## The review template

Only the star rating is required. Everything else is optional, so nobody feels homework-ed:

- Overall, out of 5 stars
- One-line verdict
- The full review
- What I loved / What I did not enjoy
- Favourite character
- Favourite quote
- Would you recommend it — Yes / Depends / No

The book's Reviews tab then shows the club average, a star breakdown, how many would recommend it, and everyone's write-ups in full.

## Making it yours

The colours and the type are all at the top of `src/styles.css`:

```css
--pink-500: #f26aa4;   /* main pink */
--lilac-400: #c4a7f0;  /* accent */
--ink: #4a2b3c;        /* text */
```

Three typefaces do the work:

- **Fraunces** for headings, with its `SOFT` and `WONK` axes turned up so the serifs wobble — that's where most of the character comes from.
- **Nunito** for body text, rounded and friendly.
- **Caveat**, handwritten, used sparingly for asides — the greeting on the homepage, empty-state hints, and the little labels inside reviews.

Swapping a face means changing the `<link>` in `index.html` and the matching `--font-*` variable.

Icons are hand-drawn inline SVG in `src/components/Icon.jsx` — no icon library, nothing to install. Emoji is deliberately reserved for things that are *content* rather than decoration: the mood scale on chapter updates, and the icon a member picks for a theory category. Everything structural uses the drawn set.

The emoji mood scale is in `src/lib/moods.js` — ten faces, add or rename freely. Genre suggestions are in `src/components/GenrePicker.jsx` (members can always type their own). The club name is in `index.html` and `src/pages/Auth.jsx`.

## If something breaks

| What you see | Fix |
|---|---|
| "Almost there 🌸" screen | `.env` is missing or misnamed. It must be exactly `.env` in the project root, and you must restart `npm run dev` after creating it. |
| Sign-up works but nothing loads | Re-run `schema.sql` — the profile trigger probably didn't get created. |
| "new row violates row-level security policy" | You're signed out, or the schema didn't finish running. Sign out and back in. |
| Chapter updates look empty | Working as intended if your bookmark is behind — check the 🔒 count. Tap **Change** to move it. |
| Profile picture won't upload | Check **Storage** for the `avatars` and `covers` buckets. Missing? Re-run the storage section of `schema.sql`. |
| Blank page after deploying | Environment variables weren't set on Vercel/Netlify. Add them, then redeploy. |
