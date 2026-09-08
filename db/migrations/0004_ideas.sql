-- "Boîte à idées" : suggestions d'amélioration pour l'app, avec un statut de
-- suivi. Même principe que la fonctionnalité équivalente dans d'autres apps
-- de l'utilisateur, adapté au modèle mono-utilisateur de ce projet.

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  content text not null,
  status text not null default 'created'
    check (status in ('created', 'processed', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ideas_owner_id_idx on ideas (owner_id);
create index if not exists ideas_status_idx on ideas (status);

drop trigger if exists ideas_set_updated_at on ideas;
create trigger ideas_set_updated_at
  before update on ideas
  for each row
  execute function set_updated_at();

-- RLS : voir db/migrations/0003_fix_rls_policy_syntax.sql pour le pourquoi
-- de la forme "(select auth.user_id())" plutôt qu'un appel direct — la
-- forme directe échoue silencieusement avec pg_session_jwt (SELECT vide,
-- INSERT/UPDATE rejetés en 42501) malgré une correspondance correcte.
alter table ideas enable row level security;

drop policy if exists ideas_owner_select on ideas;
create policy ideas_owner_select on ideas for select
  using ((select auth.user_id()) = owner_id);

drop policy if exists ideas_owner_insert on ideas;
create policy ideas_owner_insert on ideas for insert
  with check ((select auth.user_id()) = owner_id);

drop policy if exists ideas_owner_update on ideas;
create policy ideas_owner_update on ideas for update
  using ((select auth.user_id()) = owner_id)
  with check ((select auth.user_id()) = owner_id);

drop policy if exists ideas_owner_delete on ideas;
create policy ideas_owner_delete on ideas for delete
  using ((select auth.user_id()) = owner_id);

grant select, insert, update, delete on ideas to authenticated;
revoke all on ideas from anonymous;
