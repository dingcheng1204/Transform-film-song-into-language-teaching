-- P2: song_teaching schema in the shared flight-price-notifier project.
-- Touches nothing outside the song_teaching schema.
--
-- Access model
--   anon / authenticated : SELECT jobs + timelines (RLS), EXECUTE enqueue_job only
--   service_role (worker): full access, EXECUTE claim_job
-- After applying: Dashboard → Project Settings → Data API → Exposed schemas → add song_teaching.

create schema if not exists song_teaching;

grant usage on schema song_teaching to anon, authenticated, service_role;

create type song_teaching.job_status as enum ('pending', 'processing', 'done', 'failed');

create table song_teaching.jobs (
  id            uuid primary key default gen_random_uuid(),
  youtube_id    text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  source_lang   text not null check (source_lang in ('ja', 'en', 'ko')),
  title         text,
  duration_sec  numeric check (duration_sec > 0 and duration_sec <= 360),
  status        song_teaching.job_status not null default 'pending',
  stage         text,
  progress      integer not null default 0 check (progress between 0 and 100),
  error         text,
  attempts      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- At most one queued/running job per (video, language).
create unique index jobs_one_active_per_video
  on song_teaching.jobs (youtube_id, source_lang)
  where status in ('pending', 'processing');

create index jobs_pending_fifo on song_teaching.jobs (created_at) where status = 'pending';

create table song_teaching.timelines (
  youtube_id      text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  source_lang     text not null check (source_lang in ('ja', 'en', 'ko')),
  job_id          uuid references song_teaching.jobs (id) on delete set null,
  schema_version  text not null,
  timeline        jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (youtube_id, source_lang)
);

create function song_teaching.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger jobs_touch before update on song_teaching.jobs
  for each row execute function song_teaching.touch_updated_at();
create trigger timelines_touch before update on song_teaching.timelines
  for each row execute function song_teaching.touch_updated_at();

-- RLS: public read, no direct writes for anon/authenticated.
alter table song_teaching.jobs enable row level security;
alter table song_teaching.timelines enable row level security;

create policy "public read jobs" on song_teaching.jobs
  for select to anon, authenticated using (true);
create policy "public read timelines" on song_teaching.timelines
  for select to anon, authenticated using (true);

grant select on song_teaching.jobs, song_teaching.timelines to anon, authenticated;
grant all on song_teaching.jobs, song_teaching.timelines to service_role;

-- Enqueue (called by web /api/jobs with the anon key).
-- Returns the existing active job if there is one; refuses when the queue is full.
create function song_teaching.enqueue_job(
  p_youtube_id text,
  p_source_lang text,
  p_title text default null,
  p_duration_sec numeric default null
) returns song_teaching.jobs
language plpgsql security definer set search_path = '' as $$
declare
  j song_teaching.jobs;
begin
  select * into j from song_teaching.jobs
   where youtube_id = p_youtube_id and source_lang = p_source_lang
     and status in ('pending', 'processing')
   limit 1;
  if found then
    return j;
  end if;

  if (select count(*) from song_teaching.jobs where status = 'pending') >= 20 then
    raise exception 'queue_full' using errcode = 'P0001';
  end if;

  insert into song_teaching.jobs (youtube_id, source_lang, title, duration_sec)
  values (p_youtube_id, p_source_lang, left(p_title, 300), p_duration_sec)
  returning * into j;
  return j;
end $$;

-- Claim the oldest pending job (worker, service_role only).
-- Jobs stuck in 'processing' for > 30 min (crashed worker) are re-queued first.
create function song_teaching.claim_job() returns setof song_teaching.jobs
language plpgsql security definer set search_path = '' as $$
begin
  update song_teaching.jobs
     set status = 'pending', stage = 'requeued'
   where status = 'processing' and updated_at < now() - interval '30 minutes' and attempts < 3;

  update song_teaching.jobs
     set status = 'failed', error = 'too_many_attempts', finished_at = now()
   where status = 'processing' and updated_at < now() - interval '30 minutes' and attempts >= 3;

  return query
  update song_teaching.jobs j
     set status = 'processing', stage = 'claimed', progress = 0, error = null,
         attempts = j.attempts + 1, started_at = now()
   where j.id = (
     select id from song_teaching.jobs
      where status = 'pending'
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
end $$;

revoke all on function song_teaching.enqueue_job(text, text, text, numeric) from public;
revoke all on function song_teaching.claim_job() from public;
revoke all on function song_teaching.touch_updated_at() from public;
grant execute on function song_teaching.enqueue_job(text, text, text, numeric) to anon, authenticated, service_role;
grant execute on function song_teaching.claim_job() to service_role;
