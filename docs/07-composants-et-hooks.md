# 7. Composants et hooks

## Hooks

### `useAlbums()` (`hooks/useAlbums.ts`)

Hook central de récupération de la table `albums`. Retourne
`{ albums, loading, error, refetch }`.

- Exclut systématiquement `sale_status = 'vendu'` (`.neq("sale_status", "vendu")`) —
  c'est ce hook qui fait qu'un album vendu disparaît de la galerie, des séries et des
  stats sans être supprimé. L'onglet Ventes contourne délibérément ce hook (requête
  directe) pour voir aussi les albums vendus.
- Tri par titre croissant.
- Re-fetch automatique quand l'app PWA reprend le focus (`visibilitychange`/`focus`) — une
  PWA backgroundée reprend souvent sans rechargement complet, donc c'est la seule façon
  pour ses données de rattraper des changements faits ailleurs entre-temps. Ignoré tant
  que le premier chargement n'est pas terminé (`loaded` ref), pour ne jamais se déclencher
  avant d'avoir quoi que ce soit à comparer.
- `refetch()` est exposé via un `fetchRef` (ref, pas de dépendance d'effet) pour pouvoir
  être appelé à la demande (ex. `app/vente/page.tsx` après un changement de statut) sans
  réexécuter tout l'effet de montage.

### `useSession()` (`hooks/useSession.ts`)

Voir [03-authentification.md](./03-authentification.md). Retourne
`{ user, loading, signOut }`.

## Composants de navigation / layout

### `AppTabs` (`components/AppTabs.tsx`)

Barre des 6 onglets (voir [06](./06-pages-et-fonctionnalites.md) pour la liste). Point
d'attention layout : `overflow-x-auto` + `min-w-0` sur le `<nav>`, chaque lien
`shrink-0` — c'est la barre d'onglets qui absorbe un manque de largeur en **scrollant
horizontalement**, jamais en se compressant. Le logo et le bouton de déconnexion, dans le
header parent, portent chacun `shrink-0` pour ne jamais être écrasés par le flex
(voir l'historique du bug dans la note ci-dessous).

> **Historique** : une régression a fait disparaître le logo de l'app sur desktop (pas
> mobile) pour certains onglets, uniquement quand la fenêtre était plus étroite que le
> contenu total du header. Cause : un `shrink-0` posé uniquement sur les onglets faisait
> que toute compression manquante retombait à 100% sur le seul élément flex restant sans
> `shrink-0` — le logo — l'écrasant à une largeur quasi nulle. Fix définitif : la barre
> d'onglets elle-même scrolle (`overflow-x-auto`) au lieu de se faire comprimer, et logo +
> bouton de déconnexion sont protégés par `shrink-0`.

### `SignOutButton` (`components/SignOutButton.tsx`)

Icône seule (`LogOut` de lucide-react, pas de texte) — `useSession()` pour l'action et
pour ne rien rendre si aucun utilisateur n'est connecté.

### `ManifestThemeSwitcher` (`components/ManifestThemeSwitcher.tsx`)

Bascule best-effort du `<link rel="manifest">` vers `/manifest-dark.json` si
`prefers-color-scheme: dark` au montage — voir [08-pwa.md](./08-pwa.md) pour les limites.

### `AppUpdater` (`components/AppUpdater.tsx`)

Force une vérification de mise à jour du service worker à chaque reprise de focus de
l'app, et recharge la page une fois qu'un nouveau worker a pris le contrôle — voir
[08-pwa.md](./08-pwa.md).

## Composants liste/galerie d'albums

### `AlbumCard` / `AlbumGrid` / `AlbumTable`

- `AlbumCard` : vignette (ratio `2/3`, `object-contain` pour ne jamais rogner la
  couverture), titre, série+tome. Icône `Tag` en badge (coin haut-droit) si
  `sale_status === "a_vendre"`. État local `broken` : bascule vers "Pas de couverture" au
  premier `onError` de l'`<img>`, quelle que soit la cause (URL vide, 404, réseau...).
  Mémorise l'id de l'album dans `sessionStorage` (`LAST_ALBUM_KEY`) avant de naviguer vers
  sa fiche, pour le scroll-to-album au retour.
- `AlbumGrid` : grille responsive (3 colonnes en mobile → 6 en desktop large) de
  `AlbumCard`, message vide dédié.
- `AlbumTable` : vue liste compacte (titre, série, tome, éditeur, date d'achat), même
  mécanique `sessionStorage`/scroll-to-album.

### `SeriesCard`

Même mécanique visuelle que `AlbumCard` (ratio, `object-contain`, `onError`), badge
`ShoppingCart` si `hasWishlistItem` est vrai. C'est un `<button>` (pas un lien) —
l'ouverture de la fiche série se fait par état local (`SeriesDetailModal`), pas par
navigation.

### `SeriesDetailModal`

Voir description fonctionnelle en [06](./06-pages-et-fonctionnalites.md). Techniquement :
`<dialog>` natif contrôlé par ref (`showModal()`/`close()`), fermeture au clic sur le
backdrop (`e.target === dialogRef.current`).

## Composants de recherche

### `BnfTextSearch` (`components/BnfTextSearch.tsx`)

Recherche titre/série sur la BnF via `/api/text-search`. Prop `excludeCandidate` optionnelle
(prédicat) pour masquer certains résultats côté appelant — utilisée dans Achats pour cacher
les tomes déjà possédés, comptés et signalés ("N résultats masqués") plutôt que simplement
absents sans explication. Parsing défensif de la réponse (`res.json().catch(() => null)`,
voir [04](./04-recherche-isbn-bnf.md)).

### `LocalAlbumSearch` (`components/LocalAlbumSearch.tsx`)

Recherche dans la **propre collection** de l'utilisateur (titre/série, substring), pas la
BnF — utilisée dans l'onglet Ventes pour choisir un album à mettre en vente. Le pool
`albums` passé en prop doit déjà être filtré par l'appelant (ex. exclure ce qui est déjà en
vente).

### `IsbnScanner` (`components/IsbnScanner.tsx`)

`<dialog>` plein écran ouvrant la caméra (`facingMode: "environment"`) et décodant en
continu un code-barres **EAN-13 uniquement** (`BrowserMultiFormatReader` de
`@zxing/browser`, hints restreints à `BarcodeFormat.EAN_13` — le format utilisé par
l'ISBN-13 au dos de la quasi-totalité des albums). Appelle `onDetected(isbn)` une seule
fois puis laisse le parent fermer le scanner. Gère explicitement le refus de permission
caméra (message dédié).

## Formulaires

### `AlbumForm` (`components/AlbumForm.tsx`)

Formulaire générique d'ajout/édition d'un album, réutilisé tel quel par
`app/albums/new/page.tsx`, `app/albums/[id]/edit/page.tsx` et `BuyWishlistModal` — c'est
le composant qui garantit que ces trois flux restent en parité de champs.

- Champs : ISBN, titre (requis), série, numéro de tome, éditeur, dépôt légal, scénariste,
  dessinateur, date d'achat, commentaire.
- Chaque champ passe par le helper `field(key)` qui, en plus de `value`/`onChange`, pose
  l'attribut `autoCapitalize` semantique (`sentences` pour titre/commentaire, `words` pour
  série/éditeur/scénariste/dessinateur, `none` pour ISBN/dépôt légal) et coupe
  `autoCorrect`/`spellCheck` sur les noms propres — voir la note transverse en bas.
- Couverture : couche `contentEditable` invisible gérant le collage (clic desktop / appui
  long mobile via le menu natif « Coller » / Ctrl+V), deux boutons de sélection fichier
  ("Galerie photo" / "Fichiers", jamais de déclenchement caméra directe), et un bouton
  optionnel "Rechercher une couverture" (`onSearchCover`, recherche cover-only sur l'ISBN
  déjà saisi). Détail complet en [05](./05-stockage-couvertures.md).
- `initial` peut changer après le montage (ex. un lookup ISBN asynchrone résout après coup)
  — fusionné dans l'état via le pattern React documenté "ajuster l'état pendant le rendu"
  (comparaison `initial !== prevInitial` en render, pas un `useEffect`).
- `extraActions` : slot pour un bouton additionnel à droite du bouton de soumission (ex. le
  bouton "Supprimer" en page d'édition).

### `WishlistAddForm` (`components/WishlistAddForm.tsx`)

Ajout manuel/recherché à la wishlist. Recherche ISBN en préremplissage optionnel (jamais
bloquant), `BnfTextSearch` avec exclusion des tomes déjà possédés
(`isAlreadyOwned` — comparaison par ISBN normalisé ou par série+tome via
`seriesTitlesMatch()`). Seul `series_name` est obligatoire à la soumission.

### `BuyWishlistModal` (`components/BuyWishlistModal.tsx`)

Reproduit intégralement l'expérience de `app/albums/new/page.tsx` (scan/recherche ISBN,
recherche titre/série, `AlbumForm` complet) dans une fenêtre modale, préremplie depuis
l'item wishlist (`series_name`, `issue_number`, `title`, `publisher`, `cover_url`, `isbn`).
À la soumission : upload couverture → `insert` dans `albums` → `delete` de l'item
`wishlist_items` correspondant → `onDone()` (le parent retire l'item de sa liste locale).

## Autres composants

- **`SearchBar`** : simple `<input type="search">` contrôlé, pas de debounce (le filtrage
  est fait en mémoire côté client sur un dataset de quelques centaines d'albums).
- **`FilterSortBar`** : ensemble de `<select>` (série, éditeur, auteur, tri) + bascule
  galerie/liste, utilisé uniquement par l'onglet Albums.
- **`BarChart`** : mini bar-chart maison sans dépendance (`components/BarChart.tsx`),
  barres de largeur fixe qui scrollent horizontalement plutôt que de s'écraser sur une
  longue série de valeurs (ex. un an par décennie). Réservé aux séries valeur/catégorie ;
  les classements (Top 10 auteurs/éditeurs) utilisent un `RankingList` local à
  `app/stats/page.tsx` (barre horizontale proportionnelle au premier du classement).
- **`IdeaCard`** : carte d'idée avec sélecteur de statut coloré et suppression.

## Note transverse : `<dialog>` et couleur de texte

Tous les `<dialog>` natifs de l'app (`IsbnScanner`, `SeriesDetailModal`,
`BuyWishlistModal`, la boîte de confirmation de suppression en page d'édition) portent
explicitement `text-zinc-900 dark:text-zinc-50` dans leur `className`. Un `<dialog>` natif
**n'hérite pas** de la couleur de texte du `<body>` — l'agent utilisateur lui applique par
défaut `color: CanvasText`, qui l'emporte sur l'héritage — sans ce correctif, le texte
devient illisible (noir sur fond sombre) en mode sombre.

## Note transverse : `autoCapitalize` sur les champs texte (mobile)

Sans attribut `autocapitalize` explicite, iOS Safari relance son heuristique « majuscule
en début de phrase » **à chaque réassignation** de la valeur d'un `<input>` contrôlé React
(donc à chaque frappe), ce qui met en majuscule les **deux** premières lettres d'un mot au
lieu d'une. Tous les champs texte de l'app posent donc `autoCapitalize` explicitement :
`sentences` (titre, commentaire, idées), `words` (série, éditeur, scénariste, dessinateur),
`none` (ISBN, dépôt légal, tous les champs de recherche/filtre). `autoCorrect="off"` /
`spellCheck={false}` en complément sur les noms propres et identifiants.
