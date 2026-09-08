-- Liste d'achats : tomes manquants qu'on veut se procurer, envoyés depuis
-- l'onglet Séries (détection de trous locale ou recherche BnF), visibles et
-- gérables dans l'onglet Achats.

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,

  series_name text not null,
  issue_number integer,
  title text,
  publisher text,
  isbn text,
  cover_url text,

  status text not null default 'a_acheter'
    check (status in ('a_acheter', 'achete')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wishlist_items_owner_id_idx on wishlist_items (owner_id);
create index if not exists wishlist_items_status_idx on wishlist_items (status);
create index if not exists wishlist_items_series_name_idx on wishlist_items (series_name);

drop trigger if exists wishlist_items_set_updated_at on wishlist_items;
create trigger wishlist_items_set_updated_at
  before update on wishlist_items
  for each row
  execute function set_updated_at();

-- RLS : voir db/migrations/0003_fix_rls_policy_syntax.sql pour le pourquoi
-- de la forme "(select auth.user_id())" plutôt qu'un appel direct.
alter table wishlist_items enable row level security;

drop policy if exists wishlist_items_owner_select on wishlist_items;
create policy wishlist_items_owner_select on wishlist_items for select
  using ((select auth.user_id()) = owner_id);

drop policy if exists wishlist_items_owner_insert on wishlist_items;
create policy wishlist_items_owner_insert on wishlist_items for insert
  with check ((select auth.user_id()) = owner_id);

drop policy if exists wishlist_items_owner_update on wishlist_items;
create policy wishlist_items_owner_update on wishlist_items for update
  using ((select auth.user_id()) = owner_id)
  with check ((select auth.user_id()) = owner_id);

drop policy if exists wishlist_items_owner_delete on wishlist_items;
create policy wishlist_items_owner_delete on wishlist_items for delete
  using ((select auth.user_id()) = owner_id);

grant select, insert, update, delete on wishlist_items to authenticated;
revoke all on wishlist_items from anonymous;
