-- Les achats (anciennement table wishlist_items) deviennent des albums
-- portant le tag « achat » : albums.is_wishlist = true. Ils bénéficient ainsi
-- de toute la fiche album (ISBN/BnF, couverture, détail, édition) et restent
-- visibles dans le détail des séries ; la galerie les masque par défaut
-- (filtre collection / achats / tous).
alter table albums add column if not exists is_wishlist boolean not null default false;
create index if not exists albums_is_wishlist_idx on albums (is_wishlist);

-- Reprise des items « à acheter » existants : déplacés (insert + delete en une
-- seule instruction) donc rejouable sans doublon. Les items déjà « achetés »
-- restent dans wishlist_items (table plus utilisée par l'application, non
-- supprimée par prudence).
with moved as (
  delete from wishlist_items where status = 'a_acheter' returning *
)
insert into albums (owner_id, title, series_name, issue_number, publisher, isbn, cover_url, is_wishlist)
select
  owner_id,
  coalesce(
    nullif(trim(title), ''),
    series_name || case when issue_number is not null then ' #' || issue_number else '' end
  ),
  series_name,
  issue_number,
  publisher,
  isbn,
  coalesce(cover_url, ''),
  true
from moved;
