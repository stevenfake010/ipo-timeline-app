-- Remote migration: ipo_library_releases. No project plans or user data tables.
create table public.ipo_library_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (length(version) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','published')),
  schema_version integer not null default 1 check (schema_version=1),
  min_engine_version text not null,
  data jsonb not null check (jsonb_typeof(data)='object' and data ?& array['rules','calendars','agenda'] and jsonb_typeof(data->'rules')='object' and jsonb_typeof(data->'calendars')='object' and jsonb_typeof(data->'agenda')='array'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (status<>'published' or published_at is not null)
);
create table public.ipo_library_channels (
  name text primary key check (name in ('production','preview')),
  release_id uuid not null references public.ipo_library_releases(id),
  updated_at timestamptz not null default now()
);
create index ipo_library_channels_release_id_idx on public.ipo_library_channels(release_id);
alter table public.ipo_library_releases enable row level security;
alter table public.ipo_library_channels enable row level security;
revoke all on public.ipo_library_releases, public.ipo_library_channels from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.ipo_library_releases, public.ipo_library_channels to anon, authenticated;
create policy published_read on public.ipo_library_releases for select to anon, authenticated using (status='published');
create policy production_channel_read on public.ipo_library_channels for select to anon, authenticated using (name='production');

create function public.ipo_guard_published_release() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.status='published' then raise exception 'Published library releases are immutable; create a new release'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger immutable_published_release before update or delete on public.ipo_library_releases for each row execute function public.ipo_guard_published_release();
create function public.ipo_guard_channel_release() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.ipo_library_releases where id=new.release_id and status='published') then raise exception 'Only published releases can be activated'; end if;
  new.updated_at=now();return new;
end;
$$;
create trigger published_channel_only before insert or update on public.ipo_library_channels for each row execute function public.ipo_guard_channel_release();
revoke execute on function public.ipo_guard_published_release(), public.ipo_guard_channel_release() from public, anon, authenticated;
