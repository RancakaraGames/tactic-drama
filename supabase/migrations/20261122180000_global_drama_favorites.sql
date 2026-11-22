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
