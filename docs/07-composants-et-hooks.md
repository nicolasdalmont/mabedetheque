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

### `AppHeader` (`components/AppHeader.tsx`)

En-tête partagé rendu par **chaque** page (6 onglets + Détail + Ajout + Édition) : logo
(`<Link href="/">`) + `AppTabs` à gauche, `RefreshButton` + `SignOutButton` à droite.
Extrait pour que les en-têtes ne divergent plus (avant : logo tantôt `<h1>` non
cliquable, tantôt `<Link>`).

### `RefreshButton` / `PullToRefresh` / `OfflineBanner`

- **`RefreshButton`** (dans `AppHeader`) : icône `RefreshCw`, `window.location.reload()`.
  Le pendant desktop / PWA installée (pas de rechargement navigateur) du pull-to-refresh.
- **`PullToRefresh`** (layout, `sm:hidden`) : glissement vers le bas en haut de page →
  recharge au-delà d'un seuil. Listeners `document` **passifs** (ne combat jamais le
  scroll natif), désactivé si `dialog[open]` (modale) ou déjà en cours.
- **`OfflineBanner`** (layout, `sticky top-0`) : `navigator.onLine` + events
  `online`/`offline`. Le SW garde l'app ouverte hors ligne mais les requêtes de données
  échouent alors en silence — le bandeau rend l'état explicite.

### `navTabs.ts` (`components/navTabs.ts`)

`NAV_TABS` — la liste des 6 onglets (href, label, icône lucide), source unique partagée
par `AppTabs` (desktop) et `BottomNav` (mobile).

### `AppTabs` (`components/AppTabs.tsx`)

Barre d'onglets **desktop uniquement** (`hidden sm:flex`), dans l'`AppHeader`. Largeur
fixe par onglet (`w-28`), `overflow-x-auto` sur le `<nav>` en cas de fenêtre étroite.

> **Historique** : une régression avait fait disparaître le logo sur desktop quand la
> fenêtre était plus étroite que le contenu du header — un `shrink-0` posé uniquement sur
> les onglets faisait retomber toute la compression sur le logo. Corrigé en faisant
> scroller la barre (`overflow-x-auto`) et en protégeant logo + déconnexion (`shrink-0`).
> Depuis le passage en `hidden sm:flex` + `BottomNav` sur mobile, le header mobile ne
> contient plus que le logo et la déconnexion, donc le problème ne peut plus se poser.

### `BottomNav` (`components/BottomNav.tsx`)

Barre de navigation **mobile uniquement** (`sm:hidden`), `fixed` en bas de l'écran (icône
+ petit libellé, `env(safe-area-inset-bottom)`). Rendue une seule fois par
`app/layout.tsx`, masquée si pas de session ou sur `/login`. Toujours visible, y compris
sur Ajout/Édition — indispensable en PWA installée. Le layout ajoute un `pb-16 sm:pb-0`
sous le contenu pour lui laisser la place.

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
- `AlbumTable` : vue liste — **deux rendus** : lignes empilées cliquables sous `sm`
  (titre + `série #tome · éditeur · date`), table complète à partir de `sm` (un tableau
  640px scrollant horizontalement était inutilisable sur téléphone). L'id
  `album-<id>` (scroll-to-album) est sur le `<tr>` desktop.
- `CardGridSkeleton` (`components/CardGridSkeleton.tsx`) : grille de cartes en
  `animate-pulse`, même gabarit que la vraie grille — affichée au chargement d'Albums et
  Séries à la place de « Chargement… ».

### `SeriesCard`

Même mécanique visuelle que `AlbumCard` (ratio, `object-contain`, `onError`), badge
`ShoppingCart` si `hasWishlistItem` est vrai. C'est un `<button>` (pas un lien) —
l'ouverture de la fiche série se fait par état local (`SeriesDetailModal`), pas par
navigation.

### `SeriesDetailModal`

Voir description fonctionnelle en [06](./06-pages-et-fonctionnalites.md). Techniquement :
`<dialog>` natif contrôlé par ref (`showModal()`/`close()`), fermeture au clic sur le
backdrop. Prop `wishlistTomes` (`{ issue_number, title }[]`) → grille combinée
possédés + vignettes fantômes, et dédup de la section « Tomes manquants » (numéros
dérivés + `addedKeys` de la session).

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

## Feedback : confirmations et toasts

- **`ConfirmDialog` (`components/ConfirmDialog.tsx`)** — LA boîte de confirmation de l'app,
  contrôlée par une prop `open` (montre/ferme le `<dialog>` via effet). Remplace le mélange
  antérieur (`<dialog>` ad-hoc ici, `window.confirm` là, rien ailleurs). Utilisée pour :
  suppression d'album (édition), suppression d'idée, retrait d'un tome des achats,
  « Marquer vendu » (édition + Ventes). Prop `tone` : `danger` (rouge) / `default` (jaune).
- **`Toast` (`components/Toast.tsx`)** — `ToastProvider` monté dans `app/layout.tsx`,
  `useToast()` expose `{ toast, success, error }`. Notifications éphémères (4 s, cliquables
  pour fermer), empilées en bas à droite (desktop) / bas centre (mobile), au-dessus de
  `BottomNav`. Sert d'accusé de réception (album ajouté/modifié/vendu…) et remonte les
  erreurs des mises à jour optimistes qui n'étaient auparavant qu'un texte inline souvent
  hors écran. `success`/`toast` acceptent une `action` optionnelle
  (`{ label, onClick }`) → deuxième bouton dans le toast, durée portée à 7 s — utilisé
  pour l'« Annuler » après « Marquer vendu ». `useToast()` renvoie un no-op hors provider.

## Autres composants

- **`SearchBar`** : simple `<input type="search">` contrôlé, pas de debounce (le filtrage
  est fait en mémoire côté client sur un dataset de quelques centaines d'albums).
- **`FilterSortBar`** : ensemble de `<select>` (série, éditeur, auteur, tri) + bascule
  galerie/liste, utilisé uniquement par l'onglet Albums. `aria-label` sur chaque select.
- **`BarChart`** : mini bar-chart maison sans dépendance (`components/BarChart.tsx`),
  barres de largeur fixe qui scrollent horizontalement plutôt que de s'écraser sur une
  longue série de valeurs (ex. un an par décennie). Réservé aux séries valeur/catégorie ;
  les classements (Top 10 auteurs/éditeurs) utilisent un `RankingList` local à
  `app/stats/page.tsx` (barre horizontale proportionnelle au premier du classement).
- **`IdeaCard`** : carte d'idée avec sélecteur de statut coloré et suppression.
- **`lib/format.ts`** — `formatDate` / `formatDateTime` (`Intl.DateTimeFormat("fr-FR")`) :
  formatage de date unifié, utilisé par `AlbumTable` et `IdeaCard` (la vue Liste affichait
  l'ISO brut avant).

## Note transverse : `<dialog>` et couleur de texte

Tous les `<dialog>` natifs de l'app (`IsbnScanner`, `SeriesDetailModal`,
`BuyWishlistModal`, `ConfirmDialog`) portent explicitement `text-zinc-900 dark:text-zinc-50`
dans leur `className`. Un `<dialog>` natif **n'hérite pas** de la couleur de texte du
`<body>` — l'agent utilisateur lui applique par défaut `color: CanvasText`, qui l'emporte
sur l'héritage — sans ce correctif, le texte devient illisible (noir sur fond sombre) en
mode sombre.

## Note transverse : `autoCapitalize` sur les champs texte (mobile)

Sans attribut `autocapitalize` explicite, iOS Safari relance son heuristique « majuscule
en début de phrase » **à chaque réassignation** de la valeur d'un `<input>` contrôlé React
(donc à chaque frappe), ce qui met en majuscule les **deux** premières lettres d'un mot au
lieu d'une. Tous les champs texte de l'app posent donc `autoCapitalize` explicitement :
`sentences` (titre, commentaire, idées), `words` (série, éditeur, scénariste, dessinateur),
`none` (ISBN, dépôt légal, tous les champs de recherche/filtre). `autoCorrect="off"` /
`spellCheck={false}` en complément sur les noms propres et identifiants.
