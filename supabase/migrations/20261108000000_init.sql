-- Gator Sub Board v2 schema. Game/loads docs stored as JSONB to keep the original shapes 1:1.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  created_at timestamptz not null default now()
);

-- Emails listed here become editors on first login (see trigger).
create table if not exists public.editor_allowlist (email text primary key);

create table if not exists public.games (
  id text primary key,
  date date not null,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists games_date_idx on public.games(date);

create table if not exists public.loads (
  game_id text primary key,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.roster (
  id text primary key default 'roster',
  players jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.weather_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and role = 'editor');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, email, role)
  values (new.id, new.email,
    case when exists(select 1 from public.editor_allowlist a where lower(a.email) = lower(new.email)) then 'editor' else 'viewer' end)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.editor_allowlist enable row level security;
alter table public.games enable row level security;
alter table public.loads enable row level security;
alter table public.roster enable row level security;
alter table public.weather_cache enable row level security;

create policy "own profile" on public.profiles for select to authenticated using (user_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['games','loads','roster'] loop
    execute format('create policy "read %1$s" on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "edit %1$s" on public.%1$s for all to authenticated using (public.is_editor()) with check (public.is_editor())', t);
  end loop;
end $$;
-- weather_cache: server-only (service role bypasses RLS); authenticated may read.
create policy "read weather" on public.weather_cache for select to authenticated using (true);

alter publication supabase_realtime add table public.games, public.loads, public.roster;
