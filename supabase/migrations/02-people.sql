-- ============================================================
--  RELEASE 2 — People
--
--  Run this in Supabase → SQL Editor → New query → Run.
--
--  This is a MIGRATION, not a rebuild. It adds new columns and
--  removes one. It does NOT drop tables, so every book, review,
--  theory, meeting and member survives untouched.
--
--  Safe to run more than once.
-- ============================================================

-- ---------- new profile fields ----------
alter table public.profiles
  add column if not exists fav_book   text,
  add column if not exists fav_author text,
  add column if not exists fav_genre  text,
  add column if not exists birth_month int,
  add column if not exists birth_day   int;

-- Birthdays are month + day only — no year, so nobody's age is on show.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_birth_month_ck') then
    alter table public.profiles
      add constraint profiles_birth_month_ck check (birth_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_birth_day_ck') then
    alter table public.profiles
      add constraint profiles_birth_day_ck check (birth_day between 1 and 31);
  end if;
end $$;

-- ---------- email privacy ----------
--
-- Rather than hiding the email column, we remove it. Email addresses
-- already live in Supabase's own auth system, which this app's public
-- key cannot read — so the only copy anyone could have reached was the
-- one we were keeping here. Deleting it means there is nothing to leak,
-- no rule to get wrong, and no way for a future change to expose it.
--
-- You still see your own email on your profile: the app reads it from
-- your signed-in session, which only ever belongs to you.
alter table public.profiles drop column if exists email;

-- The sign-up trigger copied the email across. Stop it doing that.
create or replace function public.handle_new_user()
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

-- Anyone who signed up before this still gets a profile if theirs is missing.
insert into public.profiles (id, full_name, phone)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       u.raw_user_meta_data->>'phone'
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;

-- ---------- check it worked ----------
select full_name,
       phone,
       to_char(created_at, 'Mon YYYY') as member_since
  from public.profiles
 order by created_at;
