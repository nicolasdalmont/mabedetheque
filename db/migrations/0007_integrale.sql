-- Certaines séries sont possédées sous forme d'intégrale (plusieurs tomes
-- compilés en un seul volume) : la notion de "numéro de tome" ne s'applique
-- pas dans ce cas. `is_integrale` remplace issue_number comme indicateur de
-- position dans la série pour ces albums (voir AlbumForm, anomalies Stats).
alter table albums add column if not exists is_integrale boolean not null default false;

-- Backfill : l'import initial (scripts/db/prepare-import.py) a copié le
-- champ "NumA" (référence complémentaire) du logiciel d'origine dans le
-- commentaire pour les intégrales, sous la forme "Réf. complémentaire : INT"
-- (parfois suivi d'un suffixe : INT01, INTa1999...). Ces albums avaient déjà
-- issue_number = null (anomalie "sans tome"). Vérifié manuellement sur les
-- 34 lignes concernées avant application — aucun faux positif (à distinguer
-- de "Collection : Intégra", une collection éditoriale sans rapport, ou
-- d'une série nommée "(Intégrale)" dont les tomes ont un vrai numéro).
update albums set is_integrale = true
  where comment ~ 'Réf\. complémentaire : INT' and not is_integrale;
