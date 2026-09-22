-- Certains albums sont des "hors série" : un volume qui ne suit pas la
-- numérotation normale d'une série (spécial, one-shot...) — comme pour une
-- intégrale, la notion de "numéro de tome" ne s'applique pas. `is_hors_serie`
-- remplace issue_number au même titre que `is_integrale` (voir AlbumForm,
-- anomalies Stats) — les trois (numéro de tome, intégrale, hors série) sont
-- mutuellement exclusifs.
alter table albums add column if not exists is_hors_serie boolean not null default false;
