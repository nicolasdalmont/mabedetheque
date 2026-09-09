-- Onglet Vente : marquer un album de sa propre collection comme "à vendre"
-- ou "vendu" (par opposition à wishlist_items, qui liste des tomes qu'on ne
-- possède pas encore). Un album vendu disparaît des vues normales (galerie,
-- séries, stats) sans être supprimé — il reste consultable dans l'onglet
-- Vente sous le filtre "Vendu".

alter table albums add column if not exists sale_status text not null default 'none'
  check (sale_status in ('none', 'a_vendre', 'vendu'));

create index if not exists albums_sale_status_idx on albums (sale_status);
