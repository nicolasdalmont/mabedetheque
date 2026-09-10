# 6. Pages et fonctionnalités

Toutes les pages applicatives partagent le même en-tête : logo (lien vers `/`) + barre
d'onglets `AppTabs` à gauche, bouton de déconnexion `SignOutButton` à droite (voir
[07](./07-composants-et-hooks.md)). Le bouton d'action principal de chaque onglet (ex.
"+ Ajouter un album") vit dans sa **propre ligne juste sous l'en-tête**, jamais dans
l'en-tête lui-même.

## Barre d'onglets

6 onglets, dans cet ordre : **Albums** (`/`) · **Séries** (`/series`) ·
**Achats** (`/wishlist`) · **Ventes** (`/vente`) · **Idées** (`/ideas`) ·
**Stats** (`/stats`).

## Onglet Albums (`app/page.tsx`)

Galerie (par défaut, `AlbumGrid`) ou vue liste (`AlbumTable`) de la collection active
(albums avec `sale_status !== "vendu"`, via `useAlbums()`).

- **État dans l'URL, pas en `useState`** : `q` (recherche texte), `series`, `publisher`,
  `author`, `sort`, `view` sont tous des search params, mis à jour via
  `router.replace(..., { scroll: false })`. Choix délibéré : naviguer vers un album est une
  navigation `push` normale, donc revenir en arrière restaure exactement cette URL — aucune
  plomberie supplémentaire n'est nécessaire pour préserver les filtres/tri/vue au retour
  d'une fiche album.
- **Recherche** (`SearchBar`) : filtre côté client sur titre, série, scénariste,
  dessinateur, ISBN (substring insensible à la casse).
- **Filtres** (`FilterSortBar`) : série (select), éditeur (select), **auteur** (select,
  fusion scénariste + dessinateur dédupliquée — sélectionner un nom matche l'un ou
  l'autre rôle), tri (alphabétique / série puis tome / date d'achat / dépôt légal),
  bascule galerie/liste.
- **Scroll-to-album au retour** : avant de naviguer vers une fiche, l'id de l'album est
  stocké dans `sessionStorage` (`LAST_ALBUM_KEY`) ; au retour sur la galerie, un effet
  scrolle jusqu'à cet album une fois la liste chargée, plutôt que de repartir en haut de
  page.
- Pied de page : compteur `X albums au total` (+ `Y affichés` si un filtre est actif).

## Onglet Séries (`app/series/page.tsx`)

Liste alphabétique des séries (albums sans `series_name` exclus), une carte par série
(`SeriesCard`) affichant la couverture du **premier tome ayant une couverture exploitable**
(numéro croissant, titre en repli pour les tomes non numérotés ; `KNOWN_DEAD_COVER_URL`
exclue — voir [05](./05-stockage-couvertures.md)) et le nombre d'albums possédés.

- **Filtres** : texte libre sur le nom de série (substring), et menu déroulant auteur
  (même liste fusionnée scénariste/dessinateur que sur Albums) — combinables. État en
  `useState` local (pas dans l'URL, contrairement à la page Albums — pattern préexistant
  de cette page, non harmonisé).
- **Badge "achat"** : une icône panier apparaît sur une carte série si au moins un item de
  la wishlist correspond à cette série — comparaison via `seriesTitlesMatch()` (pas une
  égalité stricte de chaîne, car un item wishlist peut venir d'une recherche BnF dont le
  libellé diffère de notre `series_name`).
- **Clic sur une série** → ouvre `SeriesDetailModal` en fenêtre modale (état `openSeries`,
  aussi initialisable via le search param `?open=<nom>`, utilisé par le lien "Séries
  incomplètes" de l'onglet Achats).

## Fiche série — `SeriesDetailModal`

- Affiche la grille des albums déjà possédés de la série (réutilise `AlbumGrid`).
- **Trous locaux** : calculés par `findSeriesGaps()` — uniquement entre le plus petit et le
  plus grand numéro déjà possédé (impossible de détecter un tome au-delà du plus haut
  numéro sans source externe).
- **Recherche BnF étendue** ("Rechercher sur la BnF pour aller plus loin") : appelle
  `/api/series-search`, restreinte par le scénariste du premier album possédé ayant ce
  champ rempli (`authorHint`) si disponible — sinon avertit que la recherche sera moins
  précise. Chaque tome manquant retourné peut être envoyé individuellement vers la wishlist
  (bouton "Ajouter aux achats", état "Ajouté" une fois fait).
- Les trous locaux peuvent aussi être ajoutés directement à la wishlist sans passer par la
  recherche BnF (boutons `#N` en bas de section), pour les cas où on connaît juste le
  numéro manquant sans autre détail.

## Onglet Achats — `app/wishlist/page.tsx`

Liste des tomes que l'utilisateur veut se procurer (`wishlist_items`).

- **Filtres** (chips) : À acheter / Acheté / Toutes.
- **"+ Ajouter"** ouvre `WishlistAddForm` : recherche par ISBN (préremplissage uniquement,
  jamais obligatoire) ou recherche libre BnF (`BnfTextSearch`, avec exclusion des candidats
  déjà possédés via `ownedAlbums` — comparaison par ISBN ou par série+numéro via
  `seriesTitlesMatch()`), ou saisie 100% manuelle (seul `series_name` est requis).
- **Action "Acheté"** sur un item `a_acheter` → ouvre `BuyWishlistModal`, qui reproduit
  l'expérience complète d'ajout d'album (recherche ISBN/scan, recherche titre/série,
  tous les champs + couverture), préremplie avec ce que l'item wishlist connaît déjà. À la
  validation : insertion dans `albums` **puis** suppression de l'item wishlist
  correspondant.
- Les autres statuts affichent un bouton de bascule simple `a_acheter ⇄ achete`, plus un
  lien "Supprimer".
- **Section "Séries incomplètes"** (déplacée ici depuis l'onglet Stats, sur demande
  explicite) : liste `findSeriesGaps(albums)`, un bouton `+ #N` par tome manquant
  (`gap.missingNumbers`) plutôt qu'un simple texte de plage — chaque clic insère
  directement l'item dans `wishlist_items` (`handleAddGapTome`).

## Onglet Ventes — `app/vente/page.tsx`

Gère les albums de la collection déclarés à vendre ou vendus (`albums.sale_status`).

- **Recherche pour mettre en vente** : `LocalAlbumSearch` — recherche **dans la
  collection de l'utilisateur** (pas la BnF), pool restreint aux albums actifs et pas
  déjà en vente (`sale_status === "none"`). Sélectionner un résultat met à jour son
  statut à `a_vendre` (optimiste, puis confirmé côté serveur).
- **Filtres** (chips) : À vendre / Vendu / Toutes. Charge sa propre liste via
  `getDataClient().from("albums").neq("sale_status", "none")` — volontairement en dehors
  de `useAlbums()`, qui exclut les albums vendus.
- Actions par ligne : "Marquer vendu" / "Retirer" (retour à `none`) pour un album `a_vendre` ;
  badge "Vendu" + "Annuler" (retour à `a_vendre`) pour un album vendu.
- Après chaque changement de statut, `refetchActive()` (exposé par `useAlbums()`) est
  appelé pour que le pool de recherche `LocalAlbumSearch` reste synchronisé sans recharger
  la page.
- Un album peut aussi être déclaré à vendre / vendu / retiré directement depuis sa **fiche
  d'édition** (`app/albums/[id]/edit/page.tsx`), pas seulement depuis cet onglet.

## Onglet Idées — `app/ideas/page.tsx`

Boîte à idées : formulaire de saisie libre (`content`), liste triée par date de création
décroissante, filtrage par statut (Créée / Traitée / Terminée / Toutes via `IdeaCard`).
Suppression avec confirmation navigateur (`window.confirm`).

## Onglet Stats — `app/stats/page.tsx`

**4 cartes chiffrées** (`StatCard`) : Albums, Séries, À acheter (requête dédiée sur
`wishlist_items` où `status = 'a_acheter'`), En vente (`sale_status === "a_vendre"`).

**Section « Anomalies »** — données incomplètes à compléter, une ligne par type avec un
compte (ambre si > 0, gris si 0) :
- *Sans couverture* — `cover_url` vide **ou** égale à `KNOWN_DEAD_COVER_URL` (voir
  [05](./05-stockage-couvertures.md)).
- *En série, sans numéro de tome* — `series_name` renseigné mais `issue_number` nul (un
  album hors série n'est pas une anomalie).
- *Sans date d'achat* — `purchase_date` nul.

**2 classements « Top 10 »** (`RankingList`, barres horizontales maison — `BarChart` est
réservé aux séries valeur/année) :
- **Top 10 des auteurs** — scénariste + dessinateur fusionnés (même notion « auteur » que
  les filtres Albums/Séries) ; un album compté une seule fois par auteur, y compris quand
  il en est à la fois scénariste et dessinateur (déduplication par id d'album).
- **Top 10 des éditeurs** — comptage simple par valeur de `publisher` (`topByValue()`).

**2 graphiques en barres** (`BarChart`, composant maison sans dépendance) :
- **Achats par année** — extrait de `purchase_date`, **exclut totalement** les albums sans
  date d'achat (pas de bucket "Inconnue" — retiré sur demande explicite, contrairement au
  graphique suivant qui en garde un).
- **Dépôt légal par année** — `legal_deposit` est du texte libre non structuré (ex.
  `"DL 2024"`, `"02/1993"`, selon que l'album vient du lookup BnF ou d'un import CSV
  historique) ; `extractYear()` en extrait la première séquence de 4 chiffres plausible
  (19xx/20xx) par regex ; les entrées sans année exploitable tombent dans un bucket
  "Inconnue" affiché en dernier.

## Ajout d'album (`app/albums/new/page.tsx`)

1. Saisie ou scan (`IsbnScanner`, caméra EAN-13) de l'ISBN → "Rechercher" appelle
   `/api/isbn/[isbn]`, préremplit tous les champs (`AlbumForm` via sa prop `initial`) et la
   couverture si trouvée.
2. Alternative : `BnfTextSearch` (titre/série) — si le candidat choisi a un ISBN, rebascule
   automatiquement sur le lookup ISBN complet (pour récupérer aussi la couverture) ; sinon
   préremplit seulement les champs texte disponibles.
3. `AlbumForm` reste éditable dans tous les cas, y compris en saisie 100% manuelle si rien
   n'est trouvé.
4. À la soumission : upload de la couverture (fichier local ou URL distante, voir
   [05](./05-stockage-couvertures.md)) → `insert` dans `albums` avec `owner_id` →
   `router.back()`.

## Édition d'album (`app/albums/[id]/edit/page.tsx`)

Même `AlbumForm`, préchargé depuis l'album existant. Particularités :
- **Bloc statut de vente** au-dessus du formulaire — boutons contextuels selon
  `album.sale_status` ("Déclarer à vendre" / "Marquer comme vendu" + "Retirer de la
  vente" / "Annuler la vente"), mise à jour optimiste avec rollback si l'update échoue.
- Remplacement de couverture : si une nouvelle couverture (fichier ou URL) est fournie, elle
  est uploadée, la ligne `albums` mise à jour, **puis** l'ancienne couverture purgée de
  l'Object Storage (seulement si elle a effectivement changé).
- Suppression : `<dialog>` de confirmation natif, supprime la ligne puis purge la
  couverture associée (best-effort).

## Résumé des routes applicatives

| Route | Page |
|---|---|
| `/` | Albums |
| `/series` | Séries |
| `/wishlist` | Achats |
| `/vente` | Ventes |
| `/ideas` | Idées |
| `/stats` | Stats |
| `/albums/new` | Ajout d'album |
| `/albums/[id]/edit` | Édition/suppression d'un album |
| `/login` | Connexion |
