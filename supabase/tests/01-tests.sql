\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Two members sign up.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ava@example.com',  '{"full_name":"Ava"}'),
  ('22222222-2222-2222-2222-222222222222', 'bree@example.com', '{"full_name":"Bree"}');

select 'TEST 1 profiles auto-created: ' ||
  case when (select count(*) from profiles) = 2 then 'PASS' else 'FAIL' end;

-- ---- Ava adds a book and starts reading ----
set role authenticated;
set session "test.uid" = '11111111-1111-1111-1111-111111111111';

insert into books (id, title, total_chapters, status, added_by, genres)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Fourth Wing', 47, 'current',
        '11111111-1111-1111-1111-111111111111',
        array['Romantasy','Fantasy','Dark academia']);

select 'TEST 1b genres saved as a list: ' ||
  case when (select array_length(genres,1) from books
              where id='aaaaaaaa-0000-0000-0000-000000000001') = 3
        and (select genres[1] from books
              where id='aaaaaaaa-0000-0000-0000-000000000001') = 'Romantasy'
       then 'PASS' else 'FAIL' end;

select 'TEST 2 board seeded with 3 categories: ' ||
  case when (select count(*) from theory_categories
              where book_id='aaaaaaaa-0000-0000-0000-000000000001') = 3
       then 'PASS' else 'FAIL' end;

-- Ava posts updates at chapter 5 and chapter 30.
insert into chapter_updates (book_id, user_id, chapter, mood, comment) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 5,  'sus',  'something is off'),
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 30, 'sob', 'I am destroyed');

-- the new tenth mood on the scale
insert into chapter_updates (book_id, user_id, chapter, mood, comment)
values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 3, 'calledit', 'told you');

select 'TEST 3b smirk mood stored: ' ||
  case when (select mood from chapter_updates where chapter = 3) = 'calledit'
       then 'PASS' else 'FAIL' end;

select 'TEST 3 posting bumps Ava to ch 30: ' ||
  case when (select current_chapter from reading_progress
              where user_id='11111111-1111-1111-1111-111111111111') = 30
       then 'PASS' else 'FAIL' end;

-- ---- Bree has not started. She should see NOTHING. ----
set session "test.uid" = '22222222-2222-2222-2222-222222222222';

select 'TEST 4 unstarted reader sees 0 updates: ' ||
  case when (select count(*) from chapter_updates) = 0 then 'PASS' else 'FAIL' end;

select 'TEST 5 hidden_updates reports 3 locked: ' ||
  case when hidden_updates('aaaaaaaa-0000-0000-0000-000000000001') = 3
       then 'PASS' else 'FAIL' end;

-- Bree moves her bookmark to chapter 10.
insert into reading_progress (book_id, user_id, current_chapter)
values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', 10);

select 'TEST 6 at ch 10 she sees only ch 3 and ch 5: ' ||
  case when (select count(*) from chapter_updates) = 2
        and (select max(chapter) from chapter_updates) = 5
       then 'PASS' else 'FAIL' end;

select 'TEST 7 the ch-30 post is still locked: ' ||
  case when hidden_updates('aaaaaaaa-0000-0000-0000-000000000001') = 1
       then 'PASS' else 'FAIL' end;

-- She finishes the book — everything unlocks.
update reading_progress set finished = true
 where user_id='22222222-2222-2222-2222-222222222222';

select 'TEST 8 finishing unlocks everything: ' ||
  case when (select count(*) from chapter_updates) = 3 then 'PASS' else 'FAIL' end;

-- ---- Bree cannot post as Ava ----
do $$
begin
  begin
    insert into chapter_updates (book_id, user_id, chapter)
    values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 40);
    raise notice 'TEST 9 cannot post as someone else: FAIL';
  exception when insufficient_privilege then
    raise notice 'TEST 9 cannot post as someone else: PASS';
  end;
end $$;

-- ---- Reviews ----
insert into ratings (book_id, user_id, rating, summary, review, liked, disliked,
                     fav_character, fav_quote, recommend)
values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
        5, 'Obsessed', 'Long thoughts here', 'the banter', 'slow middle',
        'Xaden', 'a quote', 'yes');

set session "test.uid" = '11111111-1111-1111-1111-111111111111';
insert into ratings (book_id, user_id, rating, recommend)
values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 4, 'maybe');

select 'TEST 10 club average is 4.5: ' ||
  case when (select round(avg(rating),1) from ratings
              where book_id='aaaaaaaa-0000-0000-0000-000000000001') = 4.5
       then 'PASS' else 'FAIL' end;

do $$
begin
  begin
    insert into ratings (book_id, user_id, rating)
    values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 3);
    raise notice 'TEST 11 one review per person per book: FAIL';
  exception when unique_violation then
    raise notice 'TEST 11 one review per person per book: PASS';
  end;
end $$;

do $$
begin
  begin
    insert into ratings (book_id, user_id, rating)
    values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', 9);
    raise notice 'TEST 12 rating must be 1-5: FAIL';
  exception when others then
    raise notice 'TEST 12 rating must be 1-5: PASS';
  end;
end $$;

-- ---- Theory board: custom category + thread + reply ----
insert into theory_categories (id, book_id, name, emoji, created_by)
values ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
        'Ending predictions','🔮','11111111-1111-1111-1111-111111111111');

insert into theory_threads (id, book_id, category_id, user_id, title, body, chapter_marker)
values ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
        'The brother did it','calling it now', 12);

insert into thread_replies (thread_id, user_id, body)
values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','agreed');

select 'TEST 13 category + thread + reply saved: ' ||
  case when (select count(*) from theory_categories where book_id='aaaaaaaa-0000-0000-0000-000000000001') = 4
        and (select count(*) from theory_threads) = 1
        and (select count(*) from thread_replies) = 1
       then 'PASS' else 'FAIL' end;

-- ---- A new current book retires the old one, archive intact ----
insert into books (id, title, total_chapters, status, added_by)
values ('aaaaaaaa-0000-0000-0000-000000000002','Iron Flame', 67, 'current',
        '11111111-1111-1111-1111-111111111111');

select 'TEST 14 only one current book: ' ||
  case when (select count(*) from books where status='current') = 1
        and (select status from books where id='aaaaaaaa-0000-0000-0000-000000000001') = 'finished'
       then 'PASS' else 'FAIL' end;

select 'TEST 14b a book with no genres gets an empty list: ' ||
  case when (select genres from books where id='aaaaaaaa-0000-0000-0000-000000000002') = '{}'
       then 'PASS' else 'FAIL' end;

select 'TEST 15 old book keeps its board and updates: ' ||
  case when (select count(*) from theory_threads where book_id='aaaaaaaa-0000-0000-0000-000000000001') = 1
        and (select count(*) from chapter_updates where book_id='aaaaaaaa-0000-0000-0000-000000000001') = 3
       then 'PASS' else 'FAIL' end;

-- ============================================================
--  POLL LIFECYCLE: collecting -> voting -> closed
-- ============================================================
set session "test.uid" = '11111111-1111-1111-1111-111111111111';

insert into polls (id, question, created_by, suggest_hours, suggest_until, vote_hours)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'What next?',
        '11111111-1111-1111-1111-111111111111', 24, now() + interval '24 hours', 24);

-- Ava suggests, then Bree suggests. One each.
insert into poll_options (id, poll_id, suggested_by, title, author, genres)
values ('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111','Babel','R. F. Kuang', array['Fantasy','Historical']);

set session "test.uid" = '22222222-2222-2222-2222-222222222222';
insert into poll_options (id, poll_id, suggested_by, title, author, genres)
values ('eeeeeeee-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222','Circe','Madeline Miller', array['Fantasy']);

select 'TEST 16 everyone adds their own suggestion: ' ||
  case when (select count(*) from poll_options
              where poll_id='bbbbbbbb-0000-0000-0000-000000000001') = 2
       then 'PASS' else 'FAIL' end;

do $$
begin
  begin
    insert into poll_options (poll_id, suggested_by, title)
    values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Sneaky second');
    raise notice 'TEST 17 one suggestion each: FAIL';
  exception when unique_violation then
    raise notice 'TEST 17 one suggestion each: PASS';
  end;
end $$;

-- Voting has not opened yet, so votes are refused.
do $$
begin
  begin
    insert into poll_votes (poll_id, option_id, user_id)
    values ('bbbbbbbb-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222');
    raise notice 'TEST 18 cannot vote while still collecting: FAIL';
  exception when insufficient_privilege then
    raise notice 'TEST 18 cannot vote while still collecting: PASS';
  end;
end $$;

-- The suggestion window runs out.
set session "test.uid" = '11111111-1111-1111-1111-111111111111';
update polls set suggest_until = now() - interval '1 minute'
 where id='bbbbbbbb-0000-0000-0000-000000000001';
select settle_polls();

select 'TEST 19 suggestions close and voting opens: ' ||
  case when (select phase from polls where id='bbbbbbbb-0000-0000-0000-000000000001') = 'voting'
        and (select vote_until from polls where id='bbbbbbbb-0000-0000-0000-000000000001') > now()
       then 'PASS' else 'FAIL' end;

do $$
begin
  begin
    insert into poll_options (poll_id, suggested_by, title)
    values ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Too late');
    raise notice 'TEST 20 no suggestions once voting starts: FAIL';
  exception when insufficient_privilege then
    raise notice 'TEST 20 no suggestions once voting starts: PASS';
  end;
end $$;

-- Two votes for Circe, one for Babel.
insert into poll_votes (poll_id, option_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111');
set session "test.uid" = '22222222-2222-2222-2222-222222222222';
insert into poll_votes (poll_id, option_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222');

-- Changing your mind replaces your vote rather than adding one.
insert into poll_votes (poll_id, option_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222')
on conflict (poll_id, user_id) do update set option_id = excluded.option_id;

insert into poll_votes (poll_id, option_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222')
on conflict (poll_id, user_id) do update set option_id = excluded.option_id;

select 'TEST 21 one vote each, changeable: ' ||
  case when (select count(*) from poll_votes
              where poll_id='bbbbbbbb-0000-0000-0000-000000000001') = 2
       then 'PASS' else 'FAIL' end;

-- Voting runs out. Everything should settle by itself.
set session "test.uid" = '11111111-1111-1111-1111-111111111111';
update polls set vote_until = now() - interval '1 minute'
 where id='bbbbbbbb-0000-0000-0000-000000000001';
select settle_polls();

select 'TEST 22 poll closes on its own: ' ||
  case when (select phase from polls where id='bbbbbbbb-0000-0000-0000-000000000001') = 'closed'
        and (select winner_option_id from polls where id='bbbbbbbb-0000-0000-0000-000000000001')
            = 'eeeeeeee-0000-0000-0000-000000000002'
       then 'PASS' else 'FAIL' end;

select 'TEST 23 the winner becomes what we are reading: ' ||
  case when (select title from books where status='current') = 'Circe'
        and (select count(*) from books where status='current') = 1
       then 'PASS' else 'FAIL' end;

select 'TEST 24 the winner keeps its genres: ' ||
  case when (select genres from books where title='Circe' and status='current') = '{Fantasy}'
       then 'PASS' else 'FAIL' end;

select 'TEST 25 losing suggestions land on the TBR shelf: ' ||
  case when (select count(*) from books where status='tbr') = 1
        and (select title from books where status='tbr') = 'Babel'
       then 'PASS' else 'FAIL' end;

select 'TEST 26 the previous book was retired, not deleted: ' ||
  case when (select status from books where title='Iron Flame') = 'finished'
       then 'PASS' else 'FAIL' end;

-- ---- A TBR book gets suggested again and wins ----
insert into polls (id, created_by, suggest_until, vote_hours)
values ('bbbbbbbb-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
        now() + interval '24 hours', 24);

insert into poll_options (id, poll_id, suggested_by, book_id, title, author, genres)
select 'eeeeeeee-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002',
       '11111111-1111-1111-1111-111111111111', b.id, b.title, b.author, b.genres
  from books b where b.status='tbr';

update polls set suggest_until = now() - interval '1 minute'
 where id='bbbbbbbb-0000-0000-0000-000000000002';
select settle_polls();

insert into poll_votes (poll_id, option_id, user_id)
values ('bbbbbbbb-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000003',
        '11111111-1111-1111-1111-111111111111');

update polls set vote_until = now() - interval '1 minute'
 where id='bbbbbbbb-0000-0000-0000-000000000002';
select settle_polls();

select 'TEST 27 a TBR book is promoted, not duplicated: ' ||
  case when (select count(*) from books where title='Babel') = 1
        and (select status from books where title='Babel') = 'current'
       then 'PASS' else 'FAIL' end;

select 'TEST 28 nothing is left on the TBR shelf: ' ||
  case when (select count(*) from books where status='tbr') = 0
       then 'PASS' else 'FAIL' end;

reset role;
