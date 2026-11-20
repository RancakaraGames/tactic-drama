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
