-- Collection éditoriale (ex. "Signé Bamboo", "Poisson Pilote") : distincte de
-- la série, un même éditeur publie plusieurs collections et une même
-- collection peut regrouper plusieurs séries. Champ affiché dans AlbumForm
-- juste après Éditeur (voir AGENTS/docs 02, 07).
alter table albums add column if not exists collection text;

-- Backfill : l'import initial (scripts/db/prepare-import.py) avait déjà
-- recopié le champ "Collection" du logiciel d'origine dans le commentaire,
-- sous la forme d'une ligne "Collection : nom de la collection" (voir
-- build_comment() dans ce script). On l'extrait ici vers la nouvelle colonne
-- et on retire la ligne du commentaire — à ne pas confondre avec la ligne
-- "Réf. complémentaire : INT..." backfillée en 0007, motif différent.
update albums
set
  collection = substring(comment from 'Collection : ([^\n]+)'),
  comment = nullif(
    trim(both E'\n' from regexp_replace(comment, '(^|\n)Collection : [^\n]+', '', 'g')),
    ''
  )
where comment ~ 'Collection : ' and collection is null;
