-- TacTic Drama: database and video storage setup
-- Run this once in Supabase SQL Editor after creating your Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.dramas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  poster_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null default '',
  video_path text not null,
  created_at timestamptz not null default now(),
  unique (drama_id, episode_number)
);

alter table public.user_roles enable row level security;
alter table public.dramas enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read dramas" on public.dramas;
create policy "Public can read dramas"
on public.dramas for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert dramas" on public.dramas;
create policy "Admins can insert dramas"
on public.dramas for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update dramas" on public.dramas;
create policy "Admins can update dramas"
on public.dramas for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete dramas" on public.dramas;
create policy "Admins can delete dramas"
on public.dramas for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read episodes" on public.episodes;
create policy "Public can read episodes"
on public.episodes for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert episodes" on public.episodes;
create policy "Admins can insert episodes"
on public.episodes for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update episodes" on public.episodes;
create policy "Admins can update episodes"
on public.episodes for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete episodes" on public.episodes;
create policy "Admins can delete episodes"
on public.episodes for delete
to authenticated
using (public.is_admin());

-- Public bucket so viewers can stream videos without signing in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drama-videos', 'drama-videos', true, 524288000, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
set public = true,
    file_size_limit = 524288000,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view drama videos" on storage.objects;
create policy "Public can view drama videos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'drama-videos');

drop policy if exists "Admins can upload drama videos" on storage.objects;
create policy "Admins can upload drama videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'drama-videos' and public.is_admin());

drop policy if exists "Admins can update drama videos" on storage.objects;
create policy "Admins can update drama videos"
on storage.objects for update
to authenticated
using (bucket_id = 'drama-videos' and public.is_admin())
with check (bucket_id = 'drama-videos' and public.is_admin());

drop policy if exists "Admins can delete drama videos" on storage.objects;
create policy "Admins can delete drama videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'drama-videos' and public.is_admin());

-- Viewer comments. Public read; public can post with a display name.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_drama_created_idx
on public.comments (drama_id, created_at desc);
alter table public.comments enable row level security;
drop policy if exists "Public can read comments" on public.comments;
create policy "Public can read comments"
on public.comments for select to anon, authenticated using (true);
drop policy if exists "Visitors can post comments" on public.comments;
create policy "Visitors can post comments"
on public.comments for insert to anon, authenticated
with check (
  char_length(trim(display_name)) between 1 and 40
  and char_length(trim(body)) between 1 and 1000
);

-- Optional poster images for drama cards.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('drama-posters','drama-posters',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public can view drama posters" on storage.objects;
create policy "Public can view drama posters" on storage.objects for select to anon,authenticated using (bucket_id='drama-posters');
drop policy if exists "Admins can upload drama posters" on storage.objects;
create policy "Admins can upload drama posters" on storage.objects for insert to authenticated with check (bucket_id='drama-posters' and public.is_admin());
drop policy if exists "Admins can update drama posters" on storage.objects;
create policy "Admins can update drama posters" on storage.objects for update to authenticated using (bucket_id='drama-posters' and public.is_admin()) with check (bucket_id='drama-posters' and public.is_admin());
drop policy if exists "Admins can delete drama posters" on storage.objects;
create policy "Admins can delete drama posters" on storage.objects for delete to authenticated using (bucket_id='drama-posters' and public.is_admin());


-- Community uploads: every registered user can submit content for moderation.
alter table public.dramas
  add column if not exists uploader_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'approved';
alter table public.episodes
  add column if not exists uploader_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'approved';
alter table public.dramas drop constraint if exists dramas_status_check;
alter table public.dramas add constraint dramas_status_check check (status in ('pending','approved','rejected'));
alter table public.episodes drop constraint if exists episodes_status_check;
alter table public.episodes add constraint episodes_status_check check (status in ('pending','approved','rejected'));

drop policy if exists "Public can read dramas" on public.dramas;
drop policy if exists "Public can read approved dramas" on public.dramas;
create policy "Public can read approved dramas" on public.dramas
for select to anon, authenticated using (status = 'approved' or uploader_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admins can insert dramas" on public.dramas;
drop policy if exists "Signed-in users can submit dramas" on public.dramas;
create policy "Signed-in users can submit dramas" on public.dramas
for insert to authenticated with check (uploader_id = (select auth.uid()) and status = 'pending');
drop policy if exists "Admins can update dramas" on public.dramas;
drop policy if exists "Admins can moderate dramas" on public.dramas;
create policy "Admins can moderate dramas" on public.dramas
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Owners can edit pending dramas" on public.dramas;
create policy "Owners can edit pending dramas" on public.dramas
for update to authenticated using (uploader_id = (select auth.uid()) and status = 'pending')
with check (uploader_id = (select auth.uid()) and status = 'pending');

drop policy if exists "Public can read episodes" on public.episodes;
drop policy if exists "Public can read approved episodes" on public.episodes;
create policy "Public can read approved episodes" on public.episodes
for select to anon, authenticated using (status = 'approved' or uploader_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admins can insert episodes" on public.episodes;
drop policy if exists "Owners can submit episodes" on public.episodes;
create policy "Owners can submit episodes" on public.episodes
for insert to authenticated with check (
 uploader_id = (select auth.uid()) and status = 'pending'
 and exists (select 1 from public.dramas d where d.id = drama_id and d.uploader_id = (select auth.uid()))
);
drop policy if exists "Admins can update episodes" on public.episodes;
drop policy if exists "Admins can moderate episodes" on public.episodes;
create policy "Admins can moderate episodes" on public.episodes
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can upload drama videos" on storage.objects;
drop policy if exists "Users can upload their own drama videos" on storage.objects;
create policy "Users can upload their own drama videos" on storage.objects
for insert to authenticated with check (bucket_id = 'drama-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Admins can upload drama posters" on storage.objects;
drop policy if exists "Users can upload their own drama posters" on storage.objects;
create policy "Users can upload their own drama posters" on storage.objects
for insert to authenticated with check (bucket_id = 'drama-posters' and (storage.foldername(name))[1] = (select auth.uid())::text);
grant select on public.dramas, public.episodes to anon, authenticated;
grant insert, update, delete on public.dramas, public.episodes to authenticated;

-- Publish community uploads immediately for signed-in users.
drop policy if exists "Signed-in users can submit dramas" on public.dramas;
create policy "Signed-in users can publish dramas" on public.dramas
for insert to authenticated
with check (uploader_id = (select auth.uid()) and status = 'approved');
drop policy if exists "Owners can edit pending dramas" on public.dramas;
create policy "Owners can update own dramas" on public.dramas
for update to authenticated
using (uploader_id = (select auth.uid()))
with check (uploader_id = (select auth.uid()));
drop policy if exists "Owners can submit episodes" on public.episodes;
create policy "Owners can publish episodes" on public.episodes
for insert to authenticated
with check (
 uploader_id = (select auth.uid()) and status = 'approved'
 and exists (select 1 from public.dramas d where d.id = drama_id and d.uploader_id = (select auth.uid()) and d.status = 'approved')
);


-- Post-publication reporting: reports never block the initial upload.
create table if not exists public.video_reports (
 id uuid primary key default gen_random_uuid(),
 drama_id uuid not null references public.dramas(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (char_length(reason) between 3 and 80),
 details text not null default '' check (char_length(details) <= 1000),
 status text not null default 'open' check (status in ('open','reviewed','actioned')),
 created_at timestamptz not null default now()
);
create index if not exists video_reports_status_created_at_idx on public.video_reports(status, created_at desc);
alter table public.video_reports enable row level security;
drop policy if exists "Signed-in users can report videos" on public.video_reports;
create policy "Signed-in users can report videos" on public.video_reports for insert to authenticated
 with check (reporter_id = (select auth.uid()) and exists (select 1 from public.dramas d where d.id = drama_id and d.status = 'approved'));
drop policy if exists "Admins can read video reports" on public.video_reports;
create policy "Admins can read video reports" on public.video_reports for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update video reports" on public.video_reports;
create policy "Admins can update video reports" on public.video_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert on public.video_reports to authenticated;
grant select, update on public.video_reports to authenticated;


-- Allow upload owners to remove only their own objects.
-- This is required for cleanup when a drama or episode insert fails after media upload.
drop policy if exists "Users can delete their own drama videos" on storage.objects;
create policy "Users can delete their own drama videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'drama-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own drama posters" on storage.objects;
create policy "Users can delete their own drama posters"
on storage.objects for delete to authenticated
using (
  bucket_id = 'drama-posters'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Pause public creator publishing until the viewer-first product phase is complete.
drop policy if exists "Signed-in users can publish dramas" on public.dramas;
drop policy if exists "Owners can publish episodes" on public.episodes;
drop policy if exists "Owners can update own dramas" on public.dramas;
drop policy if exists "Owners can update own episodes" on public.episodes;
drop policy if exists "Owners can delete own dramas" on public.dramas;
drop policy if exists "Owners can delete own episodes" on public.episodes;
drop policy if exists "Admins can insert dramas" on public.dramas;
create policy "Admins can insert dramas" on public.dramas for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can insert episodes" on public.episodes;
create policy "Admins can insert episodes" on public.episodes for insert to authenticated with check (public.is_admin());
drop policy if exists "Users can upload their own drama videos" on storage.objects;
drop policy if exists "Users can upload their own drama posters" on storage.objects;
drop policy if exists "Users can delete their own drama videos" on storage.objects;
drop policy if exists "Users can delete their own drama posters" on storage.objects;
drop policy if exists "Admins can upload drama videos" on storage.objects;
create policy "Admins can upload drama videos" on storage.objects for insert to authenticated with check (bucket_id='drama-videos' and public.is_admin());
drop policy if exists "Admins can upload drama posters" on storage.objects;
create policy "Admins can upload drama posters" on storage.objects for insert to authenticated with check (bucket_id='drama-posters' and public.is_admin());


-- VIP membership and transaction foundation.
-- Payment records are written only by trusted server-side payment handlers.
create table if not exists public.vip_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text check (plan_code in ('vip_1m','vip_3m','vip_12m')),
  status text not null default 'inactive'
    check (status in ('inactive','active','suspended','refunded')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  constraint vip_membership_period_check
    check (
      (current_period_start is null and current_period_end is null)
      or (current_period_start is not null and current_period_end is not null
          and current_period_end > current_period_start)
    )
);

create table if not exists public.vip_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null check (plan_code in ('vip_1m','vip_3m','vip_12m')),
  duration_days integer not null check (duration_days in (30,90,365)),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  provider_code text,
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending','paid','expired','failed','refunded')),
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  constraint vip_transactions_provider_reference_unique
    unique (provider_code, provider_reference)
);

create index if not exists vip_transactions_user_created_idx
  on public.vip_transactions(user_id, created_at desc);
create index if not exists vip_transactions_status_expiry_idx
  on public.vip_transactions(status, expires_at)
  where status = 'pending';

alter table public.vip_memberships enable row level security;
alter table public.vip_transactions enable row level security;

drop policy if exists "View own VIP membership" on public.vip_memberships;
create policy "View own VIP membership"
  on public.vip_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "View own VIP transactions" on public.vip_transactions;
create policy "View own VIP transactions"
  on public.vip_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.vip_memberships from anon, authenticated;
revoke all on public.vip_transactions from anon, authenticated;
grant select on public.vip_memberships to authenticated;
grant select on public.vip_transactions to authenticated;

comment on table public.vip_memberships is
  'VIP subscription state. Only trusted server-side payment verification may write membership status.';
comment on table public.vip_transactions is
  'VIP payment ledger. Client users can read only their own transactions; only trusted server-side payment handlers may write.';


-- Global per-account favorites with public aggregate counts.
create table if not exists public.drama_favorites (
 drama_id uuid not null references public.dramas(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (drama_id,user_id)
);
create index if not exists drama_favorites_user_created_idx on public.drama_favorites(user_id,created_at desc);
create table if not exists public.drama_favorite_counts (
 drama_id uuid primary key references public.dramas(id) on delete cascade,
 favorite_count bigint not null default 0 check (favorite_count>=0)
);
create or replace function public.maintain_drama_favorite_count()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  insert into public.drama_favorite_counts(drama_id,favorite_count) values(new.drama_id,1)
  on conflict(drama_id) do update set favorite_count=public.drama_favorite_counts.favorite_count+1;
  return new;
 elsif tg_op='DELETE' then
  update public.drama_favorite_counts set favorite_count=greatest(favorite_count-1,0) where drama_id=old.drama_id;
  return old;
 end if;
 return null;
end; $$;
drop trigger if exists drama_favorites_count_trigger on public.drama_favorites;
create trigger drama_favorites_count_trigger after insert or delete on public.drama_favorites for each row execute function public.maintain_drama_favorite_count();
alter table public.drama_favorites enable row level security;
alter table public.drama_favorite_counts enable row level security;
drop policy if exists "Users can read their own favorites" on public.drama_favorites;
create policy "Users can read their own favorites" on public.drama_favorites for select to authenticated using((select auth.uid())=user_id);
drop policy if exists "Users can favorite approved dramas" on public.drama_favorites;
create policy "Users can favorite approved dramas" on public.drama_favorites for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.dramas d where d.id=drama_favorites.drama_id and d.status='approved'));
drop policy if exists "Users can remove their own favorites" on public.drama_favorites;
create policy "Users can remove their own favorites" on public.drama_favorites for delete to authenticated using((select auth.uid())=user_id);
drop policy if exists "Public can read drama favorite counts" on public.drama_favorite_counts;
create policy "Public can read drama favorite counts" on public.drama_favorite_counts for select to anon,authenticated using(true);
revoke all on public.drama_favorites from anon,authenticated;
revoke all on public.drama_favorite_counts from anon,authenticated;
grant select,insert,delete on public.drama_favorites to authenticated;
grant select on public.drama_favorite_counts to anon,authenticated;
revoke all on function public.maintain_drama_favorite_count() from public,anon,authenticated;
comment on table public.drama_favorites is 'Per-user favorites for approved dramas. Counts are maintained by a database trigger.';
comment on table public.drama_favorite_counts is 'Public aggregate favorite counts per drama; client roles have read-only access.';
