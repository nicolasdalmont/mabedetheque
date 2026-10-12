-- Couverture déjà connue pour un ISBN dans la bédéthèque d'un AUTRE compte.
--
-- À l'ajout d'un album, l'app propose cette couverture en priorité
-- (« est-ce la bonne couverture ? ») avant de lancer la recherche externe.
-- La RLS interdit de lire les albums des autres comptes : fonction
-- SECURITY DEFINER qui ne renvoie QUE l'URL de couverture (jamais le
-- propriétaire ni aucune autre donnée de l'album). Les URL d'Object Storage
-- sont de toute façon publiques mais non devinables (clé UUID).
--
-- Exclut : ses propres albums, les achats sans intérêt n'étant pas filtrés
-- (une couverture est une couverture), les couvertures vides et l'URL morte
-- connue (voir KNOWN_DEAD_COVER_URL dans lib/constants.ts). Préfère la plus
-- récemment mise à jour. ISBN comparé sans tirets ni espaces.

create or replace function find_shared_cover(p_isbn text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.cover_url
  from albums a
  where (select auth.user_id()) is not null
    and a.owner_id <> (select auth.user_id())
    and a.isbn is not null
    and regexp_replace(a.isbn, '[^0-9Xx]', '', 'g') = regexp_replace(p_isbn, '[^0-9Xx]', '', 'g')
    and regexp_replace(p_isbn, '[^0-9Xx]', '', 'g') <> ''
    and a.cover_url <> ''
    and a.cover_url not like '%/aee360a3-442c-4dc9-a70f-3ce7c26d5c28.webp'
  order by a.updated_at desc
  limit 1;
$$;

revoke all on function find_shared_cover(text) from public;
revoke all on function find_shared_cover(text) from anonymous;
grant execute on function find_shared_cover(text) to authenticated;
