-- ============================================================
--  ALL BOOKED UP — database schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to re-run: it drops and recreates everything.
-- ============================================================

-- ============================================================
--  ⚠️  READ THIS IF THE CLUB IS ALREADY USING THE APP
--
--  The block below DROPS every table, which wipes reviews,
--  theories, chapter updates and meetings. That is fine while
--  you're still setting up, and destructive once you're not.
--
--  Once real data exists, select from "drop table" down to
--  "drop table if exists profiles cascade;" and comment it out
--  (add -- to the front of each line) before running this file.
--
--  Sign-in accounts always survive — they live in Supabase's own
--  auth system, which this file never touches. Profile details
--  are restored automatically further down.
-- ============================================================

-- ---------- clean slate (comment this block out once you have real data!) ----------
drop table if exists meeting_rsvps cascade;
drop table if exists meetings cascade;
drop table if exists poll_votes cascade;
drop table if exists poll_options cascade;
drop table if exists polls cascade;
drop table if exists chapter_update_likes cascade;
drop table if exists chapter_updates cascade;
drop table if exists thread_likes cascade;
drop table if exists thread_replies cascade;
drop table if exists theory_threads cascade;
drop table if exists theory_categories cascade;
drop table if exists theory_likes cascade;
drop table if exists theory_comments cascade;
drop table if exists theories cascade;
drop table if exists ratings cascade;
drop table if exists reading_progress cascade;
drop table if exists books cascade;
drop table if exists profiles cascade;

-- ============================================================
--  PROFILES
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default 'New member',
  phone       text,
  avatar_url  text,
  bio         text,
  -- a few favourites, shown on your profile
  fav_book    text,
  fav_author  text,
  fav_genre   text,
  -- birthday is month + day only, so nobody's age is on show
  birth_month int check (birth_month between 1 and 12),
  birth_day   int check (birth_day between 1 and 31),
  created_at  timestamptz not null default now()   -- "member since"
);

-- NOTE: there is deliberately no email column. Email addresses live in
-- Supabase's own auth system, which this app's public key cannot read.
-- Keeping a second copy here would be the only way for one member to see
-- another's address, so we simply don't. You see your own on your profile
-- because the app reads it from your signed-in session.

-- Create a profile row automatically the moment someone signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Give a profile back to anyone who already had an account.
--
-- The trigger above only fires for brand-new sign-ups, so if this file
-- has been run before, everyone who signed up earlier would be left
-- without a profile row — signed in, but invisible to the app, and
-- unable to sign up again because their email is already taken.
-- This puts them back. It's safe to run any number of times.
insert into public.profiles (id, full_name, phone)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       u.raw_user_meta_data->>'phone'
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;

-- ============================================================
--  BOOKS
--  status: 'current' (reading now) | 'finished' | 'upcoming'
-- ============================================================
create table books (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  author         text,
  cover_url      text,
  description    text,
  genres         text[] not null default '{}',
  total_chapters int  not null default 1,
  -- 'tbr' = suggested in a poll but not picked; waiting for a future vote
  status         text not null default 'upcoming'
                 check (status in ('current', 'finished', 'upcoming', 'tbr')),
  started_on     date,
  finished_on    date,
  added_by       uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Only ONE book can be 'current' at a time. Promoting a new one
-- automatically retires whatever was current before — its theory board
-- and chapter updates stay put and stay browsable from the Library.
create or replace function enforce_single_current_book()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'current' then
    update books
       set status      = 'finished',
           finished_on = coalesce(finished_on, current_date)
     where status = 'current'
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger single_current_book
  after insert or update of status on books
  for each row when (new.status = 'current')
  execute function enforce_single_current_book();

-- ============================================================
--  WHERE EACH PERSON IS  (drives all spoiler protection)
--  One row per person per book. Posting a chapter update bumps
--  this automatically; you can also nudge it by hand in the app.
-- ============================================================
create table reading_progress (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references books(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  current_chapter int  not null default 0,
  finished        boolean not null default false,
  updated_at      timestamptz not null default now(),
  unique (book_id, user_id)
);

-- "What chapter am I on for this book?"  Finished = everything is visible.
-- SECURITY DEFINER so it can be used inside row-level security policies.
create or replace function my_chapter(p_book uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select case when finished then 2147483647 else current_chapter end
       from reading_progress
      where book_id = p_book and user_id = auth.uid()),
    0);
$$;

grant execute on function my_chapter(uuid) to authenticated;

-- ============================================================
--  CHAPTER UPDATES
--  Post as often or as rarely as you like — one row per post.
--  `mood` is a key from the emoji scale in src/lib/moods.js.
-- ============================================================
create table chapter_updates (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  chapter    int  not null check (chapter >= 0),
  mood       text,
  comment    text,
  created_at timestamptz not null default now()
);

create index chapter_updates_book_idx on chapter_updates (book_id, chapter);

create table chapter_update_likes (
  update_id uuid not null references chapter_updates(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  primary key (update_id, user_id)
);

-- Posting an update means you've read that far — keep progress in sync.
create or replace function bump_progress_from_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into reading_progress (book_id, user_id, current_chapter, updated_at)
  values (new.book_id, new.user_id, new.chapter, now())
  on conflict (book_id, user_id) do update
    set current_chapter = greatest(reading_progress.current_chapter, excluded.current_chapter),
        updated_at      = now();
  return new;
end;
$$;

create trigger update_bumps_progress
  after insert on chapter_updates
  for each row execute function bump_progress_from_update();

-- How many updates are still locked ahead of me? Lets the app say
-- "4 updates waiting past chapter 12" without leaking a word of them.
create or replace function hidden_updates(p_book uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
    from chapter_updates u
   where u.book_id = p_book
     and u.user_id <> auth.uid()
     and u.chapter > my_chapter(p_book);
$$;

grant execute on function hidden_updates(uuid) to authenticated;

-- ============================================================
--  REVIEWS  (the finish-a-book template)
--  Only `rating` is required — every other field is optional.
-- ============================================================
create table ratings (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references books(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  rating        int  not null check (rating between 1 and 5),
  summary       text,                      -- one-line verdict
  review        text,                      -- the long thoughts
  liked         text,                      -- what worked
  disliked      text,                      -- what didn't
  fav_character text,
  fav_quote     text,
  recommend     text check (recommend in ('yes', 'maybe', 'no')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (book_id, user_id)
);

-- ============================================================
--  THEORY BOARDS
--  Each book gets its own board → categories → threads → replies.
-- ============================================================
create table theory_categories (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books(id) on delete cascade,
  name       text not null,
  emoji      text not null default '💭',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table theory_threads (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid not null references books(id) on delete cascade,
  category_id    uuid references theory_categories(id) on delete set null,
  user_id        uuid not null references profiles(id) on delete cascade,
  title          text not null,
  body           text not null,
  -- "safe to read once you're past chapter N" — powers the spoiler blur
  chapter_marker int not null default 0,
  created_at     timestamptz not null default now()
);

create table thread_replies (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references theory_threads(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table thread_likes (
  thread_id uuid not null references theory_threads(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  primary key (thread_id, user_id)
);

-- Every new book starts with three categories so the board is never empty.
-- Anyone can add more from inside the app.
create or replace function seed_theory_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into theory_categories (book_id, name, emoji, created_by) values
    (new.id, 'Predictions',       '🔮', new.added_by),
    (new.id, 'Characters',        '👥', new.added_by),
    (new.id, 'General chat',      '💬', new.added_by);
  return new;
end;
$$;

create trigger book_gets_categories
  after insert on books
  for each row execute function seed_theory_categories();

-- ============================================================
--  POLLS — picking the next book, in two phases
--
--  1. COLLECTING  Anyone starts a poll. For the next 24 hours every
--                 member can add one suggestion of their own.
--  2. VOTING      Suggestions lock, everyone votes, for 24 or 48 hours.
--  3. CLOSED      Handled automatically: the winner becomes the book
--                 we're reading, and every other suggestion lands on
--                 the TBR shelf for a future poll.
-- ============================================================
create table polls (
  id            uuid primary key default gen_random_uuid(),
  question      text not null default 'What should we read next?',
  created_by    uuid references profiles(id) on delete set null,
  phase         text not null default 'collecting'
                check (phase in ('collecting', 'voting', 'closed')),
  suggest_hours int not null default 24 check (suggest_hours between 1 and 168),
  suggest_until timestamptz not null default now() + interval '24 hours',
  vote_hours    int not null default 48 check (vote_hours in (24, 48)),
  vote_until    timestamptz,
  winner_option_id uuid,
  closed_at     timestamptz,   -- results sit on the homepage for 48h after this
  created_at    timestamptz not null default now()
);

create table poll_options (
  id           uuid primary key default gen_random_uuid(),
  poll_id      uuid not null references polls(id) on delete cascade,
  -- set when someone suggests a book already sitting on the TBR shelf
  book_id      uuid references books(id) on delete set null,
  suggested_by uuid references profiles(id) on delete cascade,
  title        text not null,
  author       text,
  genres       text[] not null default '{}',
  cover_url    text,
  blurb        text,
  created_at   timestamptz not null default now(),
  -- one suggestion each, so nobody can stuff the ballot
  unique (poll_id, suggested_by)
);

alter table polls
  add constraint polls_winner_fk
  foreign key (winner_option_id) references poll_options(id) on delete set null;

create table poll_votes (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  voted_at  timestamptz not null default now(),
  unique (poll_id, user_id)   -- one vote per person per poll
);

-- ------------------------------------------------------------
--  The clock. Moves polls along and closes them out.
--  The app calls this on load, so it happens without anyone
--  having to press anything.
-- ------------------------------------------------------------
create or replace function settle_polls()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  p      record;
  win_id uuid;
  win    record;
begin
  -- Suggestions are in. Open voting.
  update polls
     set phase      = 'voting',
         vote_until = now() + make_interval(hours => vote_hours)
   where phase = 'collecting'
     and now() >= suggest_until;

  -- Voting is over. Crown a winner and file the rest under TBR.
  for p in
    select * from polls
     where phase = 'voting' and vote_until is not null and now() >= vote_until
  loop
    -- Most votes wins; an exact tie goes to whoever suggested it first.
    -- A poll that nobody voted in has no winner, and everything goes to TBR.
    select o.id into win_id
      from poll_options o
      left join poll_votes v on v.option_id = o.id
     where o.poll_id = p.id
     group by o.id
    having count(v.id) > 0
     order by count(v.id) desc, min(o.created_at) asc
     limit 1;

    if win_id is not null then
      select * into win from poll_options where id = win_id;

      if win.book_id is not null then
        -- it was already on the TBR shelf — just promote it
        update books
           set status = 'current', started_on = current_date
         where id = win.book_id;
      else
        insert into books (title, author, genres, cover_url, description,
                           status, started_on, added_by, total_chapters)
        values (win.title, win.author, win.genres, win.cover_url, win.blurb,
                'current', current_date, p.created_by, 30);
      end if;
    end if;

    -- Everything that didn't win goes to TBR (unless it was already there).
    insert into books (title, author, genres, cover_url, description, status, added_by)
    select o.title, o.author, o.genres, o.cover_url, o.blurb, 'tbr', o.suggested_by
      from poll_options o
     where o.poll_id = p.id
       and o.book_id is null
       and (win_id is null or o.id <> win_id);

    update polls
       set phase            = 'closed',
           winner_option_id = win_id,
           closed_at        = now()
     where id = p.id;
  end loop;
end;
$$;

grant execute on function settle_polls() to authenticated;

-- ============================================================
--  MEETINGS  (the board on the homepage)
--  When we're meeting, where, and what we're doing — plus who's
--  coming. Anyone can post one; anyone can RSVP.
-- ============================================================
create table meetings (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Book club',
  agenda     text,                       -- what we'll be doing
  location   text,
  starts_at  timestamptz not null,
  book_id    uuid references books(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index meetings_when_idx on meetings (starts_at);

create table meeting_rsvps (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  response   text not null check (response in ('going', 'cant')),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (meeting_id, user_id)      -- one answer each, changeable
);

-- ============================================================
--  ROW LEVEL SECURITY
--  Rule of thumb: signed-in members can READ everything and only
--  EDIT their own stuff. The one exception is chapter updates,
--  which are hidden from anyone reading behind that chapter.
-- ============================================================
alter table profiles             enable row level security;
alter table books                enable row level security;
alter table reading_progress     enable row level security;
alter table chapter_updates      enable row level security;
alter table chapter_update_likes enable row level security;
alter table ratings              enable row level security;
alter table theory_categories    enable row level security;
alter table theory_threads       enable row level security;
alter table thread_replies       enable row level security;
alter table thread_likes         enable row level security;
alter table meetings             enable row level security;
alter table meeting_rsvps        enable row level security;
alter table polls                enable row level security;
alter table poll_options         enable row level security;
alter table poll_votes           enable row level security;

-- PROFILES
create policy "members read profiles" on profiles for select to authenticated using (true);
create policy "own profile insert"    on profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update"    on profiles for update to authenticated using (auth.uid() = id);

-- BOOKS
create policy "members read books"   on books for select to authenticated using (true);
create policy "members add books"    on books for insert to authenticated with check (auth.uid() = added_by);
create policy "members update books" on books for update to authenticated using (true);
create policy "adder deletes book"   on books for delete to authenticated using (auth.uid() = added_by);

-- READING PROGRESS
create policy "members read progress" on reading_progress for select to authenticated using (true);
create policy "own progress insert"   on reading_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "own progress update"   on reading_progress for update to authenticated using (auth.uid() = user_id);
create policy "own progress delete"   on reading_progress for delete to authenticated using (auth.uid() = user_id);

-- ⭐ CHAPTER UPDATES — the spoiler wall.
-- You only ever see updates for chapters you have already reached.
-- This is enforced by the database, not just hidden in the app.
create policy "no spoilers ahead" on chapter_updates for select to authenticated
  using (user_id = auth.uid() or chapter <= my_chapter(book_id));
create policy "own update insert"  on chapter_updates for insert to authenticated with check (auth.uid() = user_id);
create policy "own update update"  on chapter_updates for update to authenticated using (auth.uid() = user_id);
create policy "own update delete"  on chapter_updates for delete to authenticated using (auth.uid() = user_id);

-- Likes follow whatever update you're allowed to see.
create policy "read visible likes" on chapter_update_likes for select to authenticated
  using (exists (select 1 from chapter_updates u where u.id = update_id));
create policy "own ch like insert" on chapter_update_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "own ch like delete" on chapter_update_likes for delete to authenticated using (auth.uid() = user_id);

-- REVIEWS
create policy "members read reviews" on ratings for select to authenticated using (true);
create policy "own review insert"    on ratings for insert to authenticated with check (auth.uid() = user_id);
create policy "own review update"    on ratings for update to authenticated using (auth.uid() = user_id);
create policy "own review delete"    on ratings for delete to authenticated using (auth.uid() = user_id);

-- THEORY BOARDS — anyone can add a category or start a thread
create policy "members read categories" on theory_categories for select to authenticated using (true);
create policy "members add categories"  on theory_categories for insert to authenticated with check (auth.uid() = created_by);
create policy "own category update"     on theory_categories for update to authenticated using (auth.uid() = created_by);
create policy "own category delete"     on theory_categories for delete to authenticated using (auth.uid() = created_by);

create policy "members read threads" on theory_threads for select to authenticated using (true);
create policy "own thread insert"    on theory_threads for insert to authenticated with check (auth.uid() = user_id);
create policy "own thread update"    on theory_threads for update to authenticated using (auth.uid() = user_id);
create policy "own thread delete"    on theory_threads for delete to authenticated using (auth.uid() = user_id);

create policy "members read replies" on thread_replies for select to authenticated using (true);
create policy "own reply insert"     on thread_replies for insert to authenticated with check (auth.uid() = user_id);
create policy "own reply update"     on thread_replies for update to authenticated using (auth.uid() = user_id);
create policy "own reply delete"     on thread_replies for delete to authenticated using (auth.uid() = user_id);

create policy "members read thread likes" on thread_likes for select to authenticated using (true);
create policy "own thread like insert"    on thread_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "own thread like delete"    on thread_likes for delete to authenticated using (auth.uid() = user_id);

-- MEETINGS — anyone can post one, anyone can RSVP, only the poster edits it
create policy "members read meetings"   on meetings for select to authenticated using (true);
create policy "members post meetings"   on meetings for insert to authenticated with check (auth.uid() = created_by);
create policy "poster edits meeting"    on meetings for update to authenticated using (auth.uid() = created_by);
create policy "poster deletes meeting"  on meetings for delete to authenticated using (auth.uid() = created_by);

create policy "members read rsvps" on meeting_rsvps for select to authenticated using (true);
create policy "own rsvp insert"    on meeting_rsvps for insert to authenticated with check (auth.uid() = user_id);
create policy "own rsvp update"    on meeting_rsvps for update to authenticated using (auth.uid() = user_id);
create policy "own rsvp delete"    on meeting_rsvps for delete to authenticated using (auth.uid() = user_id);

-- POLLS — every member can create one
create policy "members read polls"   on polls for select to authenticated using (true);
create policy "members make polls"   on polls for insert to authenticated with check (auth.uid() = created_by);
create policy "creator updates poll" on polls for update to authenticated using (auth.uid() = created_by);
create policy "creator deletes poll" on polls for delete to authenticated using (auth.uid() = created_by);

-- Anyone can add ONE suggestion, but only while the poll is collecting.
create policy "members read options" on poll_options for select to authenticated using (true);
create policy "members suggest while collecting" on poll_options for insert to authenticated
  with check (
    auth.uid() = suggested_by
    and exists (
      select 1 from polls p
       where p.id = poll_id and p.phase = 'collecting' and now() < p.suggest_until
    )
  );
create policy "edit own suggestion while collecting" on poll_options for update to authenticated
  using (
    auth.uid() = suggested_by
    and exists (select 1 from polls p where p.id = poll_id and p.phase = 'collecting')
  );
create policy "withdraw own suggestion while collecting" on poll_options for delete to authenticated
  using (
    auth.uid() = suggested_by
    and exists (select 1 from polls p where p.id = poll_id and p.phase = 'collecting')
  );

-- Votes only count during the voting phase.
create policy "members read votes" on poll_votes for select to authenticated using (true);
create policy "vote while voting" on poll_votes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from polls p where p.id = poll_id and p.phase = 'voting')
  );
create policy "change vote while voting" on poll_votes for update to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from polls p where p.id = poll_id and p.phase = 'voting')
  );
create policy "take back vote while voting" on poll_votes for delete to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from polls p where p.id = poll_id and p.phase = 'voting')
  );

-- ============================================================
--  STORAGE  (profile pictures + book covers)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "public read images"    on storage.objects;
drop policy if exists "members upload images" on storage.objects;
drop policy if exists "members update images" on storage.objects;
drop policy if exists "members delete images" on storage.objects;

create policy "public read images" on storage.objects for select
  using (bucket_id in ('avatars', 'covers'));
create policy "members upload images" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'covers'));
create policy "members update images" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'covers'));
create policy "members delete images" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'covers'));

-- ============================================================
--  REALTIME (live polls, updates and threads)
-- ============================================================
alter publication supabase_realtime add table poll_votes;
alter publication supabase_realtime add table poll_options;
alter publication supabase_realtime add table meetings;
alter publication supabase_realtime add table meeting_rsvps;
alter publication supabase_realtime add table chapter_updates;
alter publication supabase_realtime add table theory_threads;
alter publication supabase_realtime add table thread_replies;

-- ============================================================
--  Done! Next: open the app, go to Library → Add a book,
--  and set it as "Reading now".
-- ============================================================
