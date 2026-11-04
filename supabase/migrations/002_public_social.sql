-- Public social MVP. Raw tables are never directly writable by browser clients.
-- Moderator bootstrap is intentionally manual: a trusted database owner must insert
-- the first row into public.social_moderators outside the client. No moderator is seeded.

create table public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_profiles_handle_length check (char_length(handle) between 3 and 24),
  constraint social_profiles_handle_format check (handle ~ '^[A-Za-z0-9_]+$'),
  constraint social_profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 40),
  constraint social_profiles_bio_length check (char_length(bio) <= 280)
);
create unique index social_profiles_handle_lower_uidx on public.social_profiles (lower(handle));

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_body_length check (char_length(btrim(body)) between 1 and 2000)
);
create index social_posts_author_created_idx on public.social_posts (author_id, created_at desc);
create index social_posts_approved_created_idx on public.social_posts (created_at desc) where status = 'approved';

create table public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_comments_body_length check (char_length(btrim(body)) between 1 and 1000)
);
create index social_comments_post_created_idx on public.social_comments (post_id, created_at);
create index social_comments_author_created_idx on public.social_comments (author_id, created_at desc);

create table public.social_reactions (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index social_reactions_user_created_idx on public.social_reactions (user_id, created_at desc);

create table public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_post_id uuid references public.social_posts(id) on delete cascade,
  target_comment_id uuid references public.social_comments(id) on delete cascade,
  target_profile_user_id uuid references public.social_profiles(user_id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  constraint social_reports_single_target check (
    num_nonnulls(target_post_id, target_comment_id, target_profile_user_id) = 1
  ),
  constraint social_reports_reason_allowed check (reason in ('spam', 'abuse', 'unverified_religious_claim', 'privacy', 'other')),
  constraint social_reports_details_length check (char_length(details) <= 500)
);
create index social_reports_reporter_created_idx on public.social_reports (reporter_id, created_at desc);
create index social_reports_pending_created_idx on public.social_reports (created_at desc) where status = 'pending';

create table public.social_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.social_moderation_actions (
  id bigint generated always as identity primary key,
  moderator_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'report')),
  target_id uuid not null,
  old_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);
create index social_moderation_actions_target_idx on public.social_moderation_actions (target_type, target_id, created_at desc);

create or replace function public.is_social_moderator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.social_moderators m
    where m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_social_moderator() from public, anon, authenticated;
grant execute on function public.is_social_moderator() to authenticated;

alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_reactions enable row level security;
alter table public.social_reports enable row level security;
alter table public.social_moderators enable row level security;
alter table public.social_moderation_actions enable row level security;

-- Raw rows are visible only to their owner or a moderator; pending material is never public.
create policy social_profiles_owner_or_moderator_read on public.social_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_social_moderator());
create policy social_posts_owner_or_moderator_read on public.social_posts for select to authenticated
  using (author_id = (select auth.uid()) or public.is_social_moderator());
create policy social_comments_owner_or_moderator_read on public.social_comments for select to authenticated
  using (author_id = (select auth.uid()) or public.is_social_moderator());
create policy social_reactions_owner_read on public.social_reactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy social_reports_reporter_or_moderator_read on public.social_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_social_moderator());
-- No client policies on moderator or moderation-action tables.

revoke all on public.social_profiles, public.social_posts, public.social_comments,
  public.social_reactions, public.social_reports, public.social_moderators,
  public.social_moderation_actions from public, anon, authenticated;
grant select on public.social_profiles, public.social_posts, public.social_comments,
  public.social_reactions, public.social_reports to authenticated;

create view public.social_public_feed with (security_barrier = true) as
select p.id, p.body, p.created_at, prof.handle as author_handle,
       prof.display_name as author_name,
       (select count(*)::bigint from public.social_reactions r where r.post_id = p.id) as reaction_count,
       (select count(*)::bigint from public.social_comments c where c.post_id = p.id and c.status = 'approved') as comment_count
from public.social_posts p
join public.social_profiles prof on prof.user_id = p.author_id and prof.status = 'approved'
where p.status = 'approved';

create view public.social_public_comments with (security_barrier = true) as
select c.id, c.post_id, c.body, c.created_at,
       prof.handle as author_handle, prof.display_name as author_name
from public.social_comments c
join public.social_posts p on p.id = c.post_id and p.status = 'approved'
join public.social_profiles prof on prof.user_id = c.author_id and prof.status = 'approved'
where c.status = 'approved';

create view public.social_public_profiles with (security_barrier = true) as
select handle, display_name, bio, created_at
from public.social_profiles where status = 'approved';

grant select on public.social_public_feed, public.social_public_comments, public.social_public_profiles to anon, authenticated;

create or replace function public.social_submit_profile(p_handle text, p_display_name text, p_bio text)
returns public.social_profiles
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_row public.social_profiles;
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then
    raise exception 'confirmed non-anonymous account required' using errcode = '42501';
  end if;
  if p_handle is null or p_handle !~ '^[A-Za-z0-9_]{3,24}$' or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 40 or coalesce(char_length(p_bio),0) > 280 then
    raise exception 'invalid profile fields' using errcode = '22023';
  end if;
  insert into public.social_profiles(user_id, handle, display_name, bio, status)
  values (v_user, p_handle, btrim(p_display_name), coalesce(p_bio,''), 'pending')
  on conflict (user_id) do update set handle = excluded.handle, display_name = excluded.display_name,
    bio = excluded.bio, status = 'pending', updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.social_submit_post(p_body text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then raise exception 'confirmed non-anonymous account required' using errcode = '42501'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'invalid post body' using errcode = '22023'; end if;
  if not exists (select 1 from public.social_profiles s where s.user_id = v_user and s.status = 'approved') then raise exception 'approved profile required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 72001));
  if (select count(*) from public.social_posts p where p.author_id = v_user and p.created_at >= now() - interval '1 hour') >= 5 then raise exception 'post rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.social_posts(author_id, body, status) values (v_user, btrim(p_body), 'pending') returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.social_submit_comment(p_post_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then raise exception 'confirmed non-anonymous account required' using errcode = '42501'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 1000 then raise exception 'invalid comment body' using errcode = '22023'; end if;
  if not exists (select 1 from public.social_profiles s where s.user_id = v_user and s.status = 'approved') then raise exception 'approved profile required' using errcode = '42501'; end if;
  if not exists (select 1 from public.social_posts p where p.id = p_post_id and p.status = 'approved') then raise exception 'approved post required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 72002));
  if (select count(*) from public.social_comments c where c.author_id = v_user and c.created_at >= now() - interval '1 hour') >= 20 then raise exception 'comment rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.social_comments(post_id, author_id, body, status) values (p_post_id, v_user, btrim(p_body), 'pending') returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.social_toggle_reaction(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then raise exception 'confirmed non-anonymous account required' using errcode = '42501'; end if;
  if not exists (select 1 from public.social_posts p join public.social_profiles s on s.user_id = p.author_id and s.status = 'approved' where p.id = p_post_id and p.status = 'approved') then raise exception 'approved post required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_post_id::text, 72003));
  delete from public.social_reactions r where r.post_id = p_post_id and r.user_id = v_user;
  if found then return false; end if;
  insert into public.social_reactions(post_id, user_id) values (p_post_id, v_user);
  return true;
end;
$$;

create or replace function public.social_submit_report(p_target_type text, p_target_id uuid, p_reason text, p_details text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_id uuid; v_post uuid; v_comment uuid; v_profile uuid;
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then raise exception 'confirmed non-anonymous account required' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('spam','abuse','unverified_religious_claim','privacy','other') or coalesce(char_length(p_details),0) > 500 then raise exception 'invalid report fields' using errcode = '22023'; end if;
  if p_target_type = 'post' and exists (
    select 1 from public.social_posts p join public.social_profiles s on s.user_id = p.author_id and s.status = 'approved'
    where p.id = p_target_id and p.status = 'approved' and p.author_id <> v_user
  ) then v_post := p_target_id;
  elsif p_target_type = 'comment' and exists (
    select 1 from public.social_comments c
    join public.social_posts p on p.id = c.post_id and p.status = 'approved'
    join public.social_profiles s on s.user_id = c.author_id and s.status = 'approved'
    where c.id = p_target_id and c.status = 'approved' and c.author_id <> v_user
  ) then v_comment := p_target_id;
  elsif p_target_type = 'profile' and exists (select 1 from public.social_profiles s where s.user_id = p_target_id and s.status = 'approved' and s.user_id <> v_user) then v_profile := p_target_id;
  else raise exception 'invalid report target' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 72004));
  if (select count(*) from public.social_reports r where r.reporter_id = v_user and r.created_at >= now() - interval '1 day') >= 10 then raise exception 'report rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.social_reports(reporter_id, target_post_id, target_comment_id, target_profile_user_id, reason, details)
  values (v_user, v_post, v_comment, v_profile, btrim(p_reason), coalesce(p_details,'')) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.social_submit_profile_report(p_handle text, p_reason text, p_details text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_target_user uuid;
begin
  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false) then raise exception 'confirmed non-anonymous account required' using errcode = '42501'; end if;
  if p_handle is null or char_length(btrim(p_handle)) not between 3 and 24 then raise exception 'invalid report target' using errcode = '22023'; end if;
  select s.user_id into v_target_user
  from public.social_profiles s
  where lower(s.handle) = lower(btrim(p_handle)) and s.status = 'approved' and s.user_id <> v_user;
  if v_target_user is null then raise exception 'invalid report target' using errcode = '22023'; end if;
  return public.social_submit_report('profile', v_target_user, p_reason, p_details);
end;
$$;

create or replace function public.moderate_social_profile(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_old text; v_actor uuid := auth.uid();
begin
  if not public.is_social_moderator() then raise exception 'moderator required' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'invalid status' using errcode = '22023'; end if;
  select status into v_old from public.social_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;
  update public.social_profiles set status = p_status, updated_at = now() where user_id = p_user_id;
  insert into public.social_moderation_actions(moderator_id,target_type,target_id,old_status,new_status) values (v_actor,'profile',p_user_id,v_old,p_status);
end;
$$;

create or replace function public.moderate_social_post(p_post_id uuid, p_status text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_old text; v_actor uuid := auth.uid();
begin
  if not public.is_social_moderator() then raise exception 'moderator required' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'invalid status' using errcode = '22023'; end if;
  select status into v_old from public.social_posts where id = p_post_id for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  update public.social_posts set status = p_status, updated_at = now() where id = p_post_id;
  insert into public.social_moderation_actions(moderator_id,target_type,target_id,old_status,new_status) values (v_actor,'post',p_post_id,v_old,p_status);
end;
$$;

create or replace function public.moderate_social_comment(p_comment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_old text; v_actor uuid := auth.uid();
begin
  if not public.is_social_moderator() then raise exception 'moderator required' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'invalid status' using errcode = '22023'; end if;
  select status into v_old from public.social_comments where id = p_comment_id for update;
  if not found then raise exception 'comment not found' using errcode = 'P0002'; end if;
  update public.social_comments set status = p_status, updated_at = now() where id = p_comment_id;
  insert into public.social_moderation_actions(moderator_id,target_type,target_id,old_status,new_status) values (v_actor,'comment',p_comment_id,v_old,p_status);
end;
$$;

create or replace function public.resolve_social_report(p_report_id uuid, p_status text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_old text; v_actor uuid := auth.uid();
begin
  if not public.is_social_moderator() then raise exception 'moderator required' using errcode = '42501'; end if;
  if p_status not in ('reviewed','dismissed','actioned') then raise exception 'invalid status' using errcode = '22023'; end if;
  select status into v_old from public.social_reports where id = p_report_id for update;
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
  update public.social_reports set status = p_status where id = p_report_id;
  insert into public.social_moderation_actions(moderator_id,target_type,target_id,old_status,new_status) values (v_actor,'report',p_report_id,v_old,p_status);
end;
$$;

-- Remove default PUBLIC execution and grant only authenticated callers. Each submission
-- RPC independently validates a confirmed, non-anonymous auth.users account.
revoke all on function public.social_submit_profile(text,text,text) from public, anon, authenticated;
revoke all on function public.social_submit_post(text) from public, anon, authenticated;
revoke all on function public.social_submit_comment(uuid,text) from public, anon, authenticated;
revoke all on function public.social_toggle_reaction(uuid) from public, anon, authenticated;
revoke all on function public.social_submit_report(text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.social_submit_profile_report(text,text,text) from public, anon, authenticated;
revoke all on function public.moderate_social_profile(uuid,text) from public, anon, authenticated;
revoke all on function public.moderate_social_post(uuid,text) from public, anon, authenticated;
revoke all on function public.moderate_social_comment(uuid,text) from public, anon, authenticated;
revoke all on function public.resolve_social_report(uuid,text) from public, anon, authenticated;
grant execute on function public.social_submit_profile(text,text,text) to authenticated;
grant execute on function public.social_submit_post(text) to authenticated;
grant execute on function public.social_submit_comment(uuid,text) to authenticated;
grant execute on function public.social_toggle_reaction(uuid) to authenticated;
grant execute on function public.social_submit_report(text,uuid,text,text) to authenticated;
grant execute on function public.social_submit_profile_report(text,text,text) to authenticated;
grant execute on function public.moderate_social_profile(uuid,text) to authenticated;
grant execute on function public.moderate_social_post(uuid,text) to authenticated;
grant execute on function public.moderate_social_comment(uuid,text) to authenticated;
grant execute on function public.resolve_social_report(uuid,text) to authenticated;
