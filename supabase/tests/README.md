# Schema tests

These prove the database rules actually work — especially the spoiler wall (a bug there
would be invisible until someone got spoiled) and the poll lifecycle (a bug there would
be invisible until a vote quietly failed to close).

You don't need to run these. They're here so the guarantees are checkable rather than
just claimed, and so you can re-run them if you ever change `schema.sql`.

## What's tested

| # | Check |
|---|---|
| 1 | Signing up auto-creates a profile |
| 1b | Genres save as a list |
| 2 | Every new book gets three starter theory categories |
| 3 | Posting a chapter update moves your bookmark forward |
| 3b | The smirk mood stores correctly |
| 4 | Someone who hasn't started sees **zero** updates |
| 5 | The locked-ahead counter is accurate |
| 6 | At chapter 10 you see the ch-3 and ch-5 posts and nothing else |
| 7 | The chapter-30 post stays locked |
| 8 | Ticking "finished" unlocks everything at once |
| 9 | You cannot post an update as another member |
| 10 | The club average comes out right |
| 11 | One review per person per book |
| 12 | Ratings outside 1–5 are rejected |
| 13 | Custom categories, threads and replies save |
| 14 | Only one book can be "reading now" |
| 14b | A book added with no genres gets an empty list, not null |
| 15 | Retiring a book leaves its board and updates untouched |
| 16 | Every member can add their own suggestion to a poll |
| 17 | One suggestion each — nobody can stuff the ballot |
| 18 | Votes are refused while suggestions are still open |
| 19 | When the suggestion window ends, voting opens on its own |
| 20 | No sneaking a suggestion in once voting has started |
| 21 | One vote each, and you can change your mind |
| 22 | The poll closes itself when voting time runs out |
| 23 | The winner becomes the book we're reading |
| 24 | The winner keeps the genres it was suggested with |
| 25 | Losing suggestions land on the TBR shelf |
| 26 | The previous book is retired, not deleted |
| 27 | A TBR book suggested again is promoted, not duplicated |
| 28 | A promoted TBR book leaves the TBR shelf |
| 29 | Anyone can post a meeting |
| 30 | Both "I'll be there" and "Can't make it" are recorded |
| 31 | Changing your answer replaces it rather than adding one |
| 32 | Only those two answers are accepted |
| 33 | Only the person who posted a meeting can edit it |
| 34 | You can't answer on someone else's behalf |
| 35 | Removing a meeting takes its answers with it |

## Running them

You need a local Postgres 16. `00-supabase-stub.sql` fakes the bits of Supabase the
schema leans on (the `auth` schema, `auth.uid()`, storage buckets, the realtime
publication) so the real `schema.sql` can run unmodified.

```bash
createdb booked
psql -d booked -v ON_ERROR_STOP=1 -f supabase/tests/00-supabase-stub.sql
psql -d booked -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -d booked -f supabase/tests/01-tests.sql | grep TEST
```

Every line should say PASS.

In the stub, `auth.uid()` reads a session setting instead of a JWT, so the tests can
switch between members with `set session "test.uid" = '…'`. That's the only difference
from how it behaves on Supabase.
