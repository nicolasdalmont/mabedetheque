-- Stats de l'écran « Comptes » (réservé aux admins) : dernière connexion et
-- nombre d'albums par compte.
--
-- La RLS interdit à un admin de lire les albums des autres comptes, et les
-- sessions Better Auth sont supprimées à la déconnexion (la date de dernière
-- connexion s'y perdrait) : d'où
--   * account_flags.last_seen_at, posé par touch_last_seen() pour SOI-MÊME
--     (SECURITY DEFINER car les utilisateurs n'ont pas le droit d'INSERT dans
--     account_flags — voir 0011) ;
--   * admin_account_stats(), SECURITY DEFINER, qui agrège pour les admins.

alter table account_flags add column if not exists last_seen_at timestamptz;

create or replace function touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  insert into account_flags (user_id, last_seen_at)
  select (select auth.user_id()), now()
  where (select auth.user_id()) is not null
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

revoke all on function touch_last_seen() from public;
revoke all on function touch_last_seen() from anonymous;
grant execute on function touch_last_seen() to authenticated;

-- Albums « de la bédéthèque » : mêmes critères que useAlbums() (hors achats à
-- venir et hors albums vendus). Dernière connexion = la plus récente entre
-- touch_last_seen() et l'activité de session Better Auth.
create or replace function admin_account_stats()
returns table (user_id text, album_count integer, last_seen_at timestamptz)
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

  return query
  select
    u.id::text,
    coalesce((
      select count(*)::integer from albums a
      where a.owner_id = u.id::text and not a.is_wishlist and a.sale_status <> 'vendu'
    ), 0),
    greatest(
      (select f.last_seen_at from account_flags f where f.user_id = u.id::text),
      (select max(s."updatedAt") from neon_auth.session s where s."userId" = u.id)
    )
  from neon_auth."user" u;
end;
$$;

revoke all on function admin_account_stats() from public;
revoke all on function admin_account_stats() from anonymous;
grant execute on function admin_account_stats() to authenticated;
