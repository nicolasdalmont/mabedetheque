-- Schema for the "albums" table (Gestionnaire de Bibliotheque de BD).
-- Run once in the Neon SQL editor (or via psql) on the branch used by the app.

create extension if not exists pgcrypto;

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,

  isbn text not null,
  title text not null,
  series_name text,
  issue_number integer,
  publisher text,
  writer text,
  illustrator text,
  legal_deposit text,
  purchase_date date,
  comment text,
  cover_url text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists albums_owner_id_idx on albums (owner_id);
create index if not exists albums_isbn_idx on albums (isbn);
create index if not exists albums_series_name_idx on albums (series_name);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists albums_set_updated_at on albums;
create trigger albums_set_updated_at
  before update on albums
  for each row
  execute function set_updated_at();

-- Row Level Security: each row is only visible/writable by its owner.
-- owner_id is matched against auth.user_id(), which Neon's Data API derives
-- from the `sub` claim of the request's JWT (issued by Managed Better Auth).
alter table albums enable row level security;

drop policy if exists albums_owner_select on albums;
create policy albums_owner_select on albums for select
  using (auth.user_id() = owner_id);

drop policy if exists albums_owner_insert on albums;
create policy albums_owner_insert on albums for insert
  with check (auth.user_id() = owner_id);

drop policy if exists albums_owner_update on albums;
create policy albums_owner_update on albums for update
  using (auth.user_id() = owner_id)
  with check (auth.user_id() = owner_id);

drop policy if exists albums_owner_delete on albums;
create policy albums_owner_delete on albums for delete
  using (auth.user_id() = owner_id);

-- The Data API switches to the `authenticated` role for any request carrying
-- a valid JWT, and to `anonymous` otherwise. This app is private/mono-user:
-- authenticated users get table-level rights (RLS narrows it to their own
-- rows above); anonymous gets nothing.
grant select, insert, update, delete on albums to authenticated;
revoke all on albums from anonymous;
