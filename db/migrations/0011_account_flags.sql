-- Changement de mot de passe forcé à la première connexion (compte créé ou
-- réinitialisé par un administrateur avec un mot de passe temporaire).
--
-- Better Auth géré par Neon ne permet pas d'ajouter un champ à son schéma
-- neon_auth : le drapeau vit donc dans une table à nous. Pas de ligne = pas
-- de changement exigé (comptes existants, comptes créés avant cette migration).
--
-- Un utilisateur ne peut que LIRE et METTRE À JOUR sa propre ligne (pour
-- l'effacer une fois son mot de passe changé) ; il ne peut ni la créer ni
-- se l'imposer. Seul un administrateur la pose, via flag_password_change()
-- — SECURITY DEFINER car la RLS (owner = auth.user_id()) lui interdit
-- d'écrire la ligne d'un autre compte.

create table if not exists account_flags (
  user_id text primary key,
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists account_flags_set_updated_at on account_flags;
create trigger account_flags_set_updated_at
  before update on account_flags
  for each row
  execute function set_updated_at();

-- Voir 0003 pour le pourquoi de "(select auth.user_id())".
alter table account_flags enable row level security;

drop policy if exists account_flags_owner_select on account_flags;
create policy account_flags_owner_select on account_flags for select
  using ((select auth.user_id()) = user_id);

drop policy if exists account_flags_owner_update on account_flags;
create policy account_flags_owner_update on account_flags for update
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);

grant select, update on account_flags to authenticated;
revoke all on account_flags from anonymous;

create or replace function flag_password_change(target_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from neon_auth."user"
    where id::text = (select auth.user_id()) and role = 'admin'
  ) then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;

  insert into account_flags (user_id, must_change_password)
  values (target_user_id, true)
  on conflict (user_id) do update set must_change_password = true;
end;
$$;

revoke all on function flag_password_change(text) from public;
revoke all on function flag_password_change(text) from anonymous;
grant execute on function flag_password_change(text) to authenticated;
