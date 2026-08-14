do $$
begin
  create type "UserRole" as enum ('USER', 'MODERATOR', 'ADMIN');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "GameStatus" as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "GameFileKind" as enum ('GAME_BUILD', 'COVER_IMAGE', 'SCREENSHOT', 'TRAILER', 'OTHER');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "ClaimStatus" as enum ('CLAIMED', 'REVIEWED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key,
  username text not null unique,
  email text not null unique,
  role "UserRole" not null default 'USER',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

do $$
begin
  alter table public.users
    add constraint users_username_format_check
    check (username ~ '^[A-Za-z0-9_]{3,24}$');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade on update cascade,
  title text not null,
  slug text not null unique,
  description text not null,
  genre text,
  status "GameStatus" not null default 'DRAFT',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

create table if not exists public.game_files (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade on update cascade,
  kind "GameFileKind" not null,
  file_name text not null,
  url text not null,
  size_bytes integer,
  created_at timestamp(3) not null default current_timestamp
);

create table if not exists public.game_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade on update cascade,
  game_id uuid not null references public.games(id) on delete cascade on update cascade,
  status "ClaimStatus" not null default 'CLAIMED',
  created_at timestamp(3) not null default current_timestamp,
  reviewed_at timestamp(3),
  unique (user_id, game_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade on update cascade,
  game_id uuid not null references public.games(id) on delete cascade on update cascade,
  claim_id uuid not null unique references public.game_claims(id) on delete cascade on update cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  unique (user_id, game_id)
);

create index if not exists games_creator_id_idx on public.games(creator_id);
create index if not exists games_status_idx on public.games(status);
create index if not exists game_files_game_id_idx on public.game_files(game_id);
create index if not exists game_claims_game_id_idx on public.game_claims(game_id);
create index if not exists reviews_game_id_idx on public.reviews(game_id);

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_files enable row level security;
alter table public.game_claims enable row level security;
alter table public.reviews enable row level security;


-- Secure upload lifecycle fields. Files remain in quarantine until scan_status becomes APPROVED.
alter table public.game_files add column if not exists storage_path text;
alter table public.game_files add column if not exists quarantine_path text;
alter table public.game_files add column if not exists scan_status text not null default 'PENDING';
alter table public.game_files add column if not exists sha256 text;
alter table public.game_files add column if not exists scanner_output text;
alter table public.game_files add column if not exists scanned_at timestamp(3);
alter table public.game_files add column if not exists review_note text;

create index if not exists game_files_scan_status_idx on public.game_files(scan_status);
-- Admin-controlled upload scanning settings.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb,
  updated_by uuid,
  updated_at timestamp(3) not null default current_timestamp
);

insert into public.app_settings (key, value)
values ('cloudmersive_scanning_enabled', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
