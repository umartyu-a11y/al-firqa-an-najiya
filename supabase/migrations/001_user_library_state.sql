create table if not exists public.user_library_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorites text[] not null default '{}',
  history text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_library_state_updated_at_idx
  on public.user_library_state (updated_at desc);

alter table public.user_library_state enable row level security;

create policy "Users can read their own library state"
  on public.user_library_state
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own library state"
  on public.user_library_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own library state"
  on public.user_library_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_library_state from anon;
grant select, insert, update on public.user_library_state to authenticated;


create table if not exists public.user_lecture_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id text not null,
  current_time double precision not null default 0,
  duration double precision not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, lecture_id)
);

create index if not exists user_lecture_progress_updated_at_idx
  on public.user_lecture_progress (updated_at desc);

alter table public.user_lecture_progress enable row level security;

create policy "Users can read their own lecture progress"
  on public.user_lecture_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own lecture progress"
  on public.user_lecture_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own lecture progress"
  on public.user_lecture_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_lecture_progress from anon;
grant select, insert, update on public.user_lecture_progress to authenticated;
