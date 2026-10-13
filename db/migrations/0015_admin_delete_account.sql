-- Suppression d'un compte par un administrateur : nettoyage des données de
-- l'app (le compte lui-même est supprimé côté Better Auth par le client, via
-- auth.admin.removeUser).
--
-- La RLS interdit à un admin d'écrire dans les lignes d'un autre compte :
-- fonction SECURITY DEFINER, réservée aux admins (42501 sinon), qui REFUSE de
-- viser son propre compte (un admin ne peut pas se supprimer). Renvoie les URL
-- de couvertures des lignes supprimées pour que l'appelant purge Object
-- Storage (jamais partagées par URL, voir copyCover). Idempotente : rejouable
-- si la suppression du compte a échoué ensuite.

create or replace function admin_delete_account_data(target_user_id text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  covers text[];
begin
  if not is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  if target_user_id = (select auth.user_id()) then
    raise exception 'un administrateur ne peut pas supprimer son propre compte' using errcode = '42501';
  end if;

  select coalesce(array_agg(c), '{}') into covers from (
    select cover_url as c from albums where owner_id = target_user_id and coalesce(cover_url, '') <> ''
    union
    select cover_url from wishlist_items where owner_id = target_user_id and coalesce(cover_url, '') <> ''
  ) s;

  delete from albums where owner_id = target_user_id;
  delete from wishlist_items where owner_id = target_user_id;
  delete from ideas where owner_id = target_user_id;
  delete from account_flags where user_id = target_user_id;

  return covers;
end;
$$;

revoke all on function admin_delete_account_data(text) from public;
revoke all on function admin_delete_account_data(text) from anonymous;
grant execute on function admin_delete_account_data(text) to authenticated;
