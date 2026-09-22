# 6. Pages et fonctionnalités

Toutes les pages (y compris Détail / Ajout / Édition d'un album) partagent le même
en-tête, le composant `AppHeader` : logo cliquable vers `/` + barre d'onglets `AppTabs`
à gauche, bouton **Actualiser** + bouton de déconnexion à droite (voir
[07](./07-composants-et-hooks.md)). Le bouton d'action principal d'un onglet (ex.
"+ Ajouter un album") vit dans sa **propre ligne juste sous l'en-tête**, jamais dans
l'en-tête lui-même.

Un bandeau **« Hors ligne »** (`OfflineBanner`) et le **pull-to-refresh** (`PullToRefresh`,
mobile) sont rendus une fois par le layout racine, au-dessus de tout le contenu.

## Navigation

6 onglets, dans cet ordre : **Albums** (`/albums`) · **Séries** (`/series`) ·
**Achats** (`/wishlist`) · **Ventes** (`/vente`) · **Idées** (`/ideas`) ·
**Stats** (`/stats`).

- **Desktop** (`sm+`) : barre d'onglets `AppTabs` dans l'en-tête (icône + libellé).
- **Mobile** (`<sm`) : `AppTabs` est masquée ; la navigation passe par `BottomNav`, une
  barre fixe en bas de l'écran (icône + petit libellé), rendue une seule fois par le
  layout racine et **toujours visible**, y compris sur Ajout/Édition — indispensable en
  PWA installée où il n'y a pas de barre navigateur.
- Source unique des onglets : `components/navTabs.ts` (`NAV_TABS`), partagée par les deux.
- La racine `/` n'est **pas** un onglet : c'est la page d'Accueil (voir ci-dessous),
  atteignable uniquement via le logo de l'en-tête (`AppHeader`, `aria-label="Accueil"`) —
  aucun des deux jeux d'onglets ne la met en surbrillance.

## Accueil (`app/page.tsx`)

Page d'atterrissage après connexion : vue d'ensemble de la collection plutôt que la
liste complète des albums (qui a déménagé vers son propre onglet, voir plus bas).

- **4 compteurs cliquables** (mêmes valeurs que les 4 cartes de l'onglet Stats, voir plus
  bas, mais chacune est un lien plutôt qu'une carte statique) : **Albums** (`albums.length`,
  → `/albums`), **Séries** (nombre de `series_name` distincts, → `/series`), **Achats**
  (items `wishlist_items` où `status = 'a_acheter'`, requête dédiée comme sur Stats,
  → `/wishlist`), **Ventes** (`sale_status === "a_vendre"`, → `/vente`).
- **Section « Derniers achats »** : les 6 albums dont la `purchase_date` est la plus
  récente, rendus avec `AlbumGrid` — **même composant** que la vue galerie de l'onglet
  Albums (voir [07](./07-composants-et-hooks.md)). Tri décroissant sur `purchase_date`
  (chaîne ISO, comparaison directe) puis, à égalité (plusieurs achats le même jour,
  `purchase_date` n'a pas d'heure), sur `updated_at` décroissant pour départager. Les
  albums sans `purchase_date` sont exclus (message « Aucun achat enregistré. » si la liste
  est vide).
- Basée sur `useAlbums()` : exclut donc les albums `sale_status = 'vendu'`, comme partout
  ailleurs où ce hook est utilisé.

## Onglet Albums (`app/albums/page.tsx`)

Galerie (par défaut, `AlbumGrid`) ou vue liste (`AlbumTable`) de la collection active
(albums avec `sale_status !== "vendu"`, via `useAlbums()`).

- **État dans l'URL, pas en `useState`** : `q` (recherche texte), `series`, `publisher`,
  `author`, `integrale`, `hors_serie`, `sort`, `view` sont tous des search params, mis à jour via
  `router.replace(..., { scroll: false })`. Choix délibéré : naviguer vers un album est une
  navigation `push` normale, donc revenir en arrière restaure exactement cette URL — aucune
  plomberie supplémentaire n'est nécessaire pour préserver les filtres/tri/vue au retour
  d'une fiche album.
- **Recherche** (`SearchBar`) : filtre côté client sur titre, série, scénariste,
  dessinateur, ISBN (substring insensible à la casse et aux accents, via
  `normalizeForSearch` dans [`lib/search.ts`](../lib/search.ts) — « ecole » retrouve
  « École »). Le champ garde son propre état local et ne répercute la saisie vers l'URL
  (`onChange` → `router.replace`) qu'après 250 ms sans frappe (debounce géré dans le
  handler, pas dans un effet) : sans ça, chaque frappe déclenchait un re-rendu complet de
  la grille assez coûteux pour que taper vite fasse perdre des caractères.
- **Filtres** (`FilterSortBar`) : série (select), éditeur (select), **auteur** (select,
  fusion scénariste + dessinateur dédupliquée — sélectionner un nom matche l'un ou
  l'autre rôle), **Intégrales** (case à cocher, `?integrale=1` — ne garde que
  `is_integrale = true`), **Hors séries** (case à cocher, `?hors_serie=1` — ne garde que
  `is_hors_serie = true`), tri (alphabétique / série puis tome / date d'achat / dépôt
  légal — comparateur `compareAlbums` dans [`lib/sort.ts`](../lib/sort.ts), réutilisé par
  l'onglet Ventes), bascule galerie/liste.
- **Scroll-to-album au retour** : avant de naviguer vers une fiche, l'id de l'album est
  stocké dans `sessionStorage` (`LAST_ALBUM_KEY`) ; au retour sur la galerie, un effet
  scrolle jusqu'à cet album une fois la liste chargée, plutôt que de repartir en haut de
  page.
- **Compteur + reset** sous la barre de filtres : `X albums` ou `Y sur Z albums` quand un
  filtre est actif, avec un bouton **« Effacer les filtres »** (efface `q`/`series`/
  `publisher`/`author`, pas le tri ni la vue).
- **États vides distincts** : collection vraiment vide → « Votre bédéthèque est vide » +
  CTA « Ajouter votre premier album » (et le bouton d'ajout de la barre est masqué) ;
  filtre sans résultat → « Aucun album ne correspond à ce filtre » + bouton reset.

## Onglet Séries (`app/series/page.tsx`)

Liste alphabétique des séries (albums sans `series_name` exclus), une carte par série
(`SeriesCard`) affichant la couverture du **premier tome ayant une couverture exploitable**
(numéro croissant, titre en repli pour les tomes non numérotés ; `KNOWN_DEAD_COVER_URL`
exclue — voir [05](./05-stockage-couvertures.md)) et le nombre d'albums possédés.

- **Filtres** : texte libre sur le nom de série (`?q`, insensible à la casse et aux
  accents comme sur Albums — `normalizeForSearch`, debounce 250 ms géré dans
  `SeriesFilterInput`, même logique que `SearchBar`), menu déroulant auteur
  (`?author`, même liste fusionnée scénariste/dessinateur que sur Albums), case
  **« Avec une intégrale »** (`?integrale=1` — ne garde que les séries ayant au moins un
  album `is_integrale = true`) et case **« Avec un hors série »** (`?hors_serie=1`, même
  principe sur `is_hors_serie`) — combinables, **dans l'URL** comme la page Albums
  (partageables, restaurés au retour d'un album). Compteur `X sur Y séries` + bouton
  **« Effacer les filtres »** sous la barre.
- **Badge "achat"** : une icône panier apparaît sur une carte série si au moins un item de
  la wishlist correspond à cette série — comparaison via `seriesTitlesMatch()` (pas une
  égalité stricte de chaîne, car un item wishlist peut venir d'une recherche BnF dont le
  libellé diffère de notre `series_name`).
- **Clic sur une série** → ouvre `SeriesDetailModal` (état `openSeries`, aussi initialisable
  via le search param `?open=<nom>`, utilisé par le lien "Séries incomplètes" de l'onglet
  Achats). Modale centrée sur `sm+`, **feuille plein écran sous `sm`** (`h-dvh`, en-tête
  figé, corps scrollable) — comme `BuyWishlistModal`.

## Fiche série — `SeriesDetailModal`

- Affiche une grille combinée : les albums possédés (`AlbumCard`) **plus** une vignette
  fantôme (bordure pointillée jaune, icône panier, « #N · Dans les achats ») pour chaque
  tome de la série présent sur la liste d'achats — ou ajouté pendant la session de la
  modale — intercalée à sa place dans l'ordre des tomes. Prop `wishlistTomes`
  (`{ issue_number, title }[]`) fournie par la page Séries via `seriesTitlesMatch()`.
  En-tête : `(N · M souhaités)`.
- **Trous locaux** : calculés par `findSeriesGaps()` — uniquement entre le plus petit et le
  plus grand numéro déjà possédé (impossible de détecter un tome au-delà du plus haut
  numéro sans source externe).
- **Recherche BnF étendue** ("Rechercher sur la BnF pour aller plus loin") : appelle
  `/api/series-search`, restreinte par le scénariste du premier album possédé ayant ce
  champ rempli (`authorHint`) si disponible — sinon avertit que la recherche sera moins
  précise. Chaque tome manquant retourné peut être envoyé individuellement vers la wishlist
  (bouton "Ajouter aux achats" ; un tome déjà dans les achats affiche « Dans les achats »
  désactivé — dédup via `wishlistTomes`).
- Les trous locaux peuvent aussi être ajoutés directement à la wishlist sans passer par la
  recherche BnF (boutons `#N` en bas de section), pour les cas où on connaît juste le
  numéro manquant sans autre détail.

## Onglet Achats — `app/wishlist/page.tsx`

Liste des tomes que l'utilisateur veut se procurer (`wishlist_items`).

- **Filtres** (chips) : À acheter / Acheté / Toutes. **Tri** (select, `compareWishlistItems` dans
  [`lib/sort.ts`](../lib/sort.ts)) : alphabétique (par défaut — `title`, ou `series_name` en repli
  pour les entrées manuelles sans titre) / série puis tome.
- **"+ Ajouter"** ouvre `WishlistAddForm` : recherche par ISBN (préremplissage uniquement,
  jamais obligatoire) ou recherche libre BnF (`BnfTextSearch`, avec exclusion des candidats
  déjà possédés via `ownedAlbums` — comparaison par ISBN ou par série+numéro via
  `seriesTitlesMatch()`), ou saisie 100% manuelle (seul `series_name` est requis). Le champ
  Série propose, en cours de saisie, les séries déjà présentes dans la collection (même
  mécanisme `SuggestInput` que sur `AlbumForm`, voir [07](./07-composants-et-hooks.md)).
- **Bouton "Acheté"** (jaune plein) sur un item `a_acheter` → ouvre `BuyWishlistModal`, qui
  reproduit l'expérience complète d'ajout d'album (recherche ISBN/scan, recherche
  titre/série, tous les champs + couverture), préremplie avec ce que l'item wishlist
  connaît déjà. À la validation : insertion dans `albums` **puis** suppression de l'item
  wishlist correspondant. `BuyWishlistModal` est une **feuille plein écran sous `sm`**.
- Les autres statuts affichent un bouton de bascule simple `a_acheter ⇄ achete`.
- Lien **"Retirer"** (rouge) sur chaque ligne → `ConfirmDialog` → suppression de l'item.
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
- **Filtres** (chips) : À vendre / Vendu / Toutes. **Tri** (select, `compareAlbums` dans
  [`lib/sort.ts`](../lib/sort.ts), partagé avec l'onglet Albums) : alphabétique (par défaut) /
  série puis tome. Charge sa propre liste via
  `getDataClient().from("albums").neq("sale_status", "none")` — volontairement en dehors
  de `useAlbums()`, qui exclut les albums vendus.
- Actions par ligne, pour un album `a_vendre` : bouton **"Vendu"** (jaune plein, comme
  "Acheté" sur Achats) → `ConfirmDialog` ; lien **"Retirer"** (rouge, retour à `none`,
  immédiat). Pour un album vendu : badge grisé "Vendu" + lien "Annuler". Chaque changement
  émet un toast ("Marquer vendu" avec action **« Annuler »**).
- Après chaque changement de statut, `refetchActive()` (exposé par `useAlbums()`) est
  appelé pour que le pool de recherche `LocalAlbumSearch` reste synchronisé sans recharger
  la page.
- Un album peut aussi être déclaré à vendre / vendu / retiré directement depuis sa **fiche
  d'édition** (`app/albums/[id]/edit/page.tsx`), pas seulement depuis cet onglet.

## Onglet Idées — `app/ideas/page.tsx`

Boîte à idées : formulaire de saisie libre (`content`), liste triée par date de création
décroissante, filtrage par statut (Créée / Traitée / Terminée / Toutes via `IdeaCard`).
Suppression via `ConfirmDialog` ; erreurs remontées en toast.

## Onglet Stats — `app/stats/page.tsx`

**4 cartes chiffrées** (`StatCard`) : Albums, Séries, À acheter (requête dédiée sur
`wishlist_items` où `status = 'a_acheter'`), En vente (`sale_status === "a_vendre"`).

**Section « Anomalies »** — données incomplètes à compléter, une ligne par type avec un
compte (ambre si > 0, gris si 0). Chaque ligne non nulle est un lien vers l'onglet
Albums filtré (`/albums?missing=cover|tome|achat`) qui affiche un chip ambre récapitulatif :
- *Sans couverture* — `cover_url` vide **ou** égale à `KNOWN_DEAD_COVER_URL` (voir
  [05](./05-stockage-couvertures.md)).
- *En série, sans numéro de tome* — `series_name` renseigné, `issue_number` nul,
  `is_integrale = false` **et** `is_hors_serie = false` (un album sans série n'est pas une
  anomalie, et une intégrale ou un hors série n'a légitimement pas de numéro — voir
  `tomeLabel()` dans [07](./07-composants-et-hooks.md)).
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
   préremplit seulement les champs texte disponibles. Une fois un ISBN trouvé, ce bloc se
   replie dans un `<details>` (« Pas le bon album ? »).
3. `AlbumForm` reste éditable dans tous les cas, y compris en saisie 100% manuelle si rien
   n'est trouvé.
4. Cases **« Intégrale »** et **« Hors série »** sous le champ numéro de tome — les trois
   sont mutuellement exclusifs (`is_integrale` / `is_hors_serie`, voir [02](./02-donnees.md)) :
   cocher l'une désactive et vide le numéro de tome et décoche l'autre, remplacé partout à
   l'affichage par le libellé « Intégrale » ou « Hors série » (`tomeLabel()`,
   [07](./07-composants-et-hooks.md)).
5. Champs **Série**/**Scénariste**/**Dessinateur** : suggestions en cours de saisie, tirées
   des valeurs déjà utilisées (scénariste + dessinateur fusionnés) ailleurs dans la
   collection — voir `SuggestField`/`SuggestInput` dans [07](./07-composants-et-hooks.md).
6. À la soumission : upload de la couverture (fichier local ou URL distante, voir
   [05](./05-stockage-couvertures.md)) → `insert` dans `albums` avec `owner_id` → toast de
   succès → `router.back()`. Si le champ « Date d'achat » (`purchase_date`) est resté vide,
   la date du jour est forcée avant l'insertion (jamais de `null` sur un album créé via ce
   formulaire — voir l'anomalie « Sans date d'achat » plus haut, qui ne peut donc concerner
   que des albums plus anciens ou importés). La couverture, elle, reste optionnelle :
   si ni la recherche ISBN ni une photo n'ont abouti, l'album est créé avec
   `cover_url: ""` (traité comme « Sans couverture » partout dans l'app, voir
   [05](./05-stockage-couvertures.md)) — elle peut être ajoutée après coup depuis
   l'édition.

## Détail d'album (`app/albums/[id]/page.tsx`)

**Vue lecture seule** — c'est là qu'atterrissent toutes les vignettes/lignes d'album
(galerie, vue liste, fiche série, onglet Ventes), au lieu d'ouvrir directement le
formulaire d'édition : moins d'édits accidentels en parcourant la collection. Grande
couverture (+ badge `SALE_STATUS_LABEL` en haut à droite si concerné, badge « Intégrale »
ou « Hors série » en haut à gauche selon `is_integrale`/`is_hors_serie` — mutuellement
exclusifs, coin opposé au badge de vente donc les deux peuvent coexister) + le sous-titre
série reprend aussi « — intégrale » ou « — hors série » (au lieu de « — tome N ») + toutes
les métadonnées (dates via `formatDate`) + bouton **« Modifier »** → `/albums/[id]/edit`.
Re-fetch au retour de focus.

## Édition d'album (`app/albums/[id]/edit/page.tsx`)

Même `AlbumForm`, préchargé depuis l'album existant. Particularités :
- **Bloc statut de vente** au-dessus du formulaire — boutons contextuels selon
  `album.sale_status` ("Déclarer à vendre" / "Vendu" + "Retirer de la vente" /
  "Annuler la vente"), mise à jour optimiste avec rollback + toast si l'update échoue.
  "Vendu" passe par un `ConfirmDialog`.
- Remplacement de couverture : si une nouvelle couverture (fichier ou URL) est fournie, elle
  est uploadée, la ligne `albums` mise à jour, **puis** l'ancienne couverture purgée de
  l'Object Storage (seulement si elle a effectivement changé).
- Suppression : `ConfirmDialog`, supprime la ligne puis purge la couverture associée
  (best-effort), toast de confirmation, `router.back()`.
- Toast « Modifications enregistrées » à la sauvegarde.

## Résumé des routes applicatives

| Route | Page |
|---|---|
| `/` | Accueil |
| `/albums` | Albums |
| `/series` | Séries |
| `/wishlist` | Achats |
| `/vente` | Ventes |
| `/ideas` | Idées |
| `/stats` | Stats |
| `/albums/new` | Ajout d'album |
| `/albums/[id]` | Détail d'un album (lecture seule) |
| `/albums/[id]/edit` | Édition/suppression d'un album |
| `/login` | Connexion |
