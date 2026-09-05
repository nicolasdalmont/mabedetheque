# Import en masse depuis un export BDGest-like

Utilisé pour importer une collection existante (export CSV `;`-séparé avec
sections ALBUM / REVUE / produits dérivés). Étapes :

```bash
python3 scripts/db/prepare-import.py <export.csv> /tmp/import_rows.json
node scripts/db/run-import.mjs /tmp/import_rows.json <owner_user_id>
```

- `prepare-import.py` ne garde que les lignes `ALBUM` (hors wishlist), mappe
  les colonnes vers le modèle de données, et regroupe les infos sans champ
  dédié (cote, prix, dédicace, lu...) dans `comment`.
- `run-import.mjs` récupère une couverture (Open Library, avec repli sur une
  image "indisponible"), l'upload sur Object Storage, et insère chaque ligne
  directement en base (`NEON_DATABASE_URL`, en tant que propriétaire de la
  table — contourne la Data API/RLS pour un import en masse).
- `<owner_user_id>` : id de l'utilisateur Neon Auth à qui rattacher les
  albums (table `neon_auth.user`).
