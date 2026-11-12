-- P5: saved words/lines with spaced-repetition state, and review logs.
-- Per-user data: RLS restricts every row to auth.uid(). Touches only the song_teaching schema.

create table song_teaching.saved_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('word', 'line')),
  youtube_id       text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  source_lang      text not null check (source_lang in ('ja', 'en', 'ko')),
  segment_id       integer not null check (segment_id >= 0),
  -- Snapshot of what the card shows (the timeline may be re-annotated later).
  text             text not null check (char_length(text) between 1 and 300),
  reading          text check (char_length(reading) <= 300),
  romanization     text check (char_length(romanization) <= 300),
  meaning          text check (char_length(meaning) <= 300),   -- word: zh gloss; line: zh translation
  context          text check (char_length(context) <= 300),   -- word: the line it came from
  start_sec        numeric not null check (start_sec >= 0),    -- clip in the original video
  end_sec          numeric not null check (end_sec > start_sec),
  -- SM-2 style scheduling
  ease             numeric not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days    integer not null default 0 check (interval_days >= 0),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, kind, source_lang, youtube_id, text)
);

create index saved_items_due on song_teaching.saved_items (user_id, due_at);

create table song_teaching.review_logs (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id       uuid not null references song_teaching.saved_items (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 4),  -- 1 again, 2 hard, 3 good, 4 easy
  interval_days integer not null,
  reviewed_at   timestamptz not null default now()
);

create index review_logs_user_time on song_teaching.review_logs (user_id, reviewed_at);

alter table song_teaching.saved_items enable row level security;
alter table song_teaching.review_logs enable row level security;

create policy "own saved items" on song_teaching.saved_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own review logs" on song_teaching.review_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from song_teaching.saved_items i where i.id = item_id and i.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on song_teaching.saved_items to authenticated;
grant select, insert on song_teaching.review_logs to authenticated;
grant all on song_teaching.saved_items, song_teaching.review_logs to service_role;
