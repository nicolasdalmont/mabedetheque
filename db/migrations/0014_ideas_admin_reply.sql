-- Boîte à idées : visible par les administrateurs (toutes les idées de tous
-- les comptes) et réponse de l'admin à une idée.
--
-- is_admin() est SECURITY DEFINER : les politiques RLS s'exécutent avec les
-- droits de l'utilisateur, qui ne peut pas lire neon_auth."user" (même
-- raison que flag_password_change(), voir 0011).
--
-- Un admin peut LIRE et METTRE À JOUR (statut, réponse) toutes les idées,
-- mais pas les supprimer ni les créer au nom d'un autre. Le propriétaire garde
-- ses droits, sauf sur la réponse : le trigger ideas_guard_reply refuse qu'un
-- non-admin la modifie (la politique d'UPDATE du propriétaire porte sur toute
-- la ligne, pas sur une colonne).

alter table ideas add column if not exists reply text;
alter table ideas add column if not exists replied_at timestamptz;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from neon_auth."user"
    where id::text = (select auth.user_id()) and role = 'admin'
  );
$$;

revoke all on function is_admin() from public;
revoke all on function is_admin() from anonymous;
grant execute on function is_admin() to authenticated;

drop policy if exists ideas_admin_select on ideas;
create policy ideas_admin_select on ideas for select
  using ((select is_admin()));

drop policy if exists ideas_admin_update on ideas;
create policy ideas_admin_update on ideas for update
  using ((select is_admin()))
  with check ((select is_admin()));

create or replace function ideas_guard_reply()
returns trigger
language plpgsql
as $$
begin
  if (new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at)
     and not is_admin() then
    raise exception 'seul un administrateur peut répondre à une idée' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_guard_reply on ideas;
create trigger ideas_guard_reply
  before update on ideas
  for each row
  execute function ideas_guard_reply();
