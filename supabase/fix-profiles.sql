-- ============================================================
--  FIX: give everyone their profile back
--
--  Run this on its own in Supabase → SQL Editor → New query → Run.
--  It does NOT drop or delete anything. It only fills in profile
--  rows that went missing when the schema was last rebuilt.
--
--  Safe to run as many times as you like — anyone who already has
--  a profile is skipped.
-- ============================================================

insert into public.profiles (id, full_name, email, phone)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       u.email,
       u.raw_user_meta_data->>'phone'
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;

-- Have a look at who's back:
select full_name, email, phone
  from public.profiles
 order by created_at;
