-- ============================================================
--  RELEASE 3 — Browsing
--
--  Run this in Supabase → SQL Editor → New query → Run.
--
--  A MIGRATION, not a rebuild. It adds one column and updates one
--  function. Nothing is dropped, so all your data stays put.
--  (Supabase may still warn about "destructive operations" because
--  the file contains the words "drop trigger" — it doesn't.)
--
--  Safe to run more than once.
-- ============================================================

-- ---------- when did each poll close? ----------
-- Results stay on the homepage for 48 hours after a poll closes,
-- then move to the archive. That needs a closing timestamp.
alter table public.polls
  add column if not exists closed_at timestamptz;

-- Polls that closed before this migration existed: assume they closed
-- when voting was due to end, so they aren't stuck on the homepage.
update public.polls
   set closed_at = coalesce(vote_until, created_at)
 where phase = 'closed' and closed_at is null;

-- ---------- record the closing time from now on ----------
create or replace function public.settle_polls()
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

    insert into books (title, author, genres, cover_url, description, status, added_by)
    select o.title, o.author, o.genres, o.cover_url, o.blurb, 'tbr', o.suggested_by
      from poll_options o
     where o.poll_id = p.id
       and o.book_id is null
       and (win_id is null or o.id <> win_id);

    update polls
       set phase            = 'closed',
           winner_option_id = win_id,
           closed_at        = now()      -- ← new
     where id = p.id;
  end loop;
end;
$$;

grant execute on function public.settle_polls() to authenticated;

-- ---------- let people edit their own replies ----------
-- Replies could be posted and deleted but never edited, because there
-- was no update rule for them. Everything else people write already
-- had one.
drop policy if exists "own reply update" on public.thread_replies;
create policy "own reply update" on public.thread_replies
  for update to authenticated using (auth.uid() = user_id);

-- ---------- check it worked ----------

select question,
       phase,
       to_char(closed_at, 'DD Mon YYYY HH24:MI') as closed_at
  from public.polls
 order by created_at desc;
