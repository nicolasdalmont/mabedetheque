# 4. Recherche ISBN / BnF

L'app s'appuie sur le catalogue SRU de la **BnF** (Bibliothèque nationale de France,
format UNIMARC) comme source primaire de métadonnées, sans clé d'API requise, complété
par **Google Books** et **Open Library** pour la couverture quand nécessaire.

Trois usages distincts, trois modules :

| Besoin | Module | Route API |
|---|---|---|
| Lookup d'un album par ISBN exact | `lib/isbn-providers.ts` | `GET /api/isbn/[isbn]` |
| Tous les tomes d'une série connue | `lib/bnf-series.ts` | `GET /api/series-search` |
| Recherche libre par titre/série | `lib/bnf-text-search.ts` | `GET /api/text-search` |

Les trois partagent le parsing UNIMARC bas niveau de `lib/unimarc.ts`.

## `lib/unimarc.ts` — parsing UNIMARC/SRU partagé

Utilise `fast-xml-parser` (`XMLParser`) avec **`parseTagValue: false`** — point important :
la valeur par défaut (`true`) convertit silencieusement un contenu numérique en `number`
JS, ce qui détruit le zéro initial d'un code de fonction UNIMARC comme `"070"` (devient
`70`), cassant toute comparaison de chaîne ultérieure. Tout est donc lu comme texte et
reconverti explicitement via `String(...)` là où nécessaire.

Fonctions exposées :
- `subfields(field)` — normalise les sous-champs d'un datafield UNIMARC en
  `{ code: value[] }`.
- `findDatafields(record, tag)` — récupère tous les champs d'un tag donné (ex. `"200"`).
- `datafieldInd2(field)` — lit l'indicateur 2 d'un champ (utile pour distinguer plusieurs
  occurrences du même tag).
- `parseSruRecords(xml)` — extrait chaque `<srw:record>` d'une réponse `searchRetrieve` en
  son nœud UNIMARC `<mxc:record>`.
- `sruNumberOfRecords(xml)` — nombre total de résultats côté serveur (pour détecter une
  liste tronquée).

## `lib/isbn-providers.ts` — lookup par ISBN exact

### BnF (source primaire)

Requête SRU : `bib.isbn all "<isbn>"`, `recordSchema=unimarcxchange`,
`maximumRecords=1`. Convertit aussi l'ISBN-13 (préfixe `978`) en ISBN-10 via
`isbn13to10()` et retente avec cette variante, car les notices BnF les plus anciennes ne
portent que l'ISBN-10 dans le champ `010$a`.

Champs UNIMARC exploités :
- **200** ($a) : titre
- **225** ($a série, $v numéro de tome) — le nom de série est nettoyé d'une éventuelle
  ponctuation finale (`.replace(/[.,]\s*$/, "")`)
- **210 / 214** (imprint : éditeur, dépôt légal) — voir `extractImprint()` ci-dessous
- **700/701/702/703** (contributeurs) — voir la logique auteur/dessinateur ci-dessous

#### `extractImprint()` — éditeur/dépôt légal, champ 210 vs 214

La BnF a migré du champ UNIMARC historique **210** vers son successeur **214** pour les
notices cataloguées depuis environ les années 2010. Le code essaie 210 en premier, puis
214 en repli — et 214 pouvant se répéter (publication / fabrication / copyright,
distingués par l'indicateur 2), il préfère l'occurrence "Publication" (`ind2 === "0"`) et
ne retombe sur la première disponible qu'en dernier recours.

#### Attribution scénariste/dessinateur par fonction ($4), pas par position de tag

```ts
export const WRITER_FUNCTION = "070";       // Auteur du texte
export const ILLUSTRATOR_FUNCTION = "440";  // Illustrateur
```

`contributorsByFunction(marc, functionCode)` parcourt les tags 700/701/702/703 et ne
retient que ceux dont le sous-champ `$4` correspond au code de fonction demandé —
**jamais** en supposant que "700 = scénariste, 702 = illustrateur" par position. Cette
hypothèse de position casse sur les adaptations : un roman adapté en BD peut porter
l'auteur original du roman en 702 avec une fonction différente de l'illustrateur réel.

**Cas de l'auteur unique (BD "solo")** : quand l'artiste ne diffère pas du scénariste, la
BnF n'enregistre qu'une seule entrée "auteur du texte" (070) sans champ 440 du tout. Le
code mirror alors ce scénariste unique vers `illustrator` plutôt que de laisser le champ
vide :

```ts
const illustrator = illustratorNames.length
  ? illustratorNames.join(", ")
  : writerNames.length === 1
    ? writerNames[0]
    : undefined;
```

### Google Books / Open Library (couverture uniquement)

Appelées en parallèle de la BnF via `Promise.allSettled` (jamais bloquantes l'une pour
l'autre) :
- **Google Books** (`volumes?q=isbn:...`) — clé API optionnelle
  (`GOOGLE_BOOKS_API_KEY`) ; sans clé, Google applique un quota bas par IP, d'où le repli
  automatique.
- **Open Library** (`covers.openlibrary.org/b/isbn/<isbn>-L.jpg`) — un fichier de moins de
  1 Ko est traité comme "pas de couverture" (Open Library sert un placeholder minuscule
  quand elle n'a rien).

`lookupIsbn(isbn)` fusionne : les champs texte viennent de la BnF (`base`), la couverture
de Google Books en priorité puis Open Library. Retourne `null` seulement si ni l'un ni
l'autre n'a rien donné.

## `lib/bnf-series.ts` — tous les tomes d'une série connue

Utilisé par `SeriesDetailModal` pour "Rechercher sur la BnF pour aller plus loin" — trouver
des tomes au-delà de ceux déjà détectés localement (voir aussi `lib/series-gaps.ts`).

### Approche abandonnée : notice de collection + `col2bib`

Une première version recherchait la notice d'autorité "collection éditoriale" via
`bib.serialtitle`, puis listait ses membres via le lien `col2bib`. **Vérifié
empiriquement comme quasiment jamais peuplé** : sur deux séries testées (Astérix : 3
candidats sur 4 sans lien ; Lapinot : 4 sur 4 sans lien), cette approche ne retournait
presque aucun résultat.

### Approche retenue : recherche directe des notices individuelles

```
(bib.recordtype any "mon") and (bib.author all "<auteur>")
```

— ou, sans auteur connu, un repli moins précis :

```
(bib.recordtype any "mon") and (bib.anywhere all "<nom de série>")
```

Chaque notice monographie (`mon`) retournée est ensuite filtrée sur son propre champ 225
(titre de la collection/série qu'elle porte) comparé au nom cherché via
`seriesTitlesMatch()`. Restreindre par auteur est nettement plus précis et complet qu'une
recherche libre : pour Lapinot, une recherche non restreinte ne trouvait que 4 tomes sur
~9 réels, contre la totalité en restreignant par auteur. L'appelant (`SeriesDetailModal`)
passe donc le scénariste du premier album possédé de la série s'il est connu
(`authorHint`).

### `seriesTitlesMatch(a, b)` — comparaison tolérante des noms de série

Notre propre convention de nommage (`series_name`) trie les séries alphabétiquement en
déplaçant l'article/l'auteur entre parenthèses, ex. `"Lapinot (Les formidables aventures
de)"` — alors que le champ 225 de la BnF porte le libellé naturel, ex. `"Les formidables
aventures de Lapinot"`. Une comparaison de chaînes, même normalisée, ne matche jamais.

`seriesTitlesMatch()` compare plutôt des **ensembles de mots significatifs** :
`significantWords()` retire la ponctuation/accents, met en minuscules, **garde le contenu
des parenthèses comme des mots ordinaires** (ne le supprime pas — une version antérieure
qui le supprimait provoquait des faux positifs contre des séries dérivées non liées, ex.
"Les nouvelles aventures de Lapinot"), retire une liste de mots vides français
(`le, la, les, l, un, une, des, de, du, d, et, au, aux`). Deux titres matchent si le plus
petit ensemble de mots est inclus dans le plus grand — tolère l'ordre différent, mais
reste précis dans la pratique combiné à la restriction par auteur.

Cette même fonction sert aussi dans `app/series/page.tsx` (badge "tome en achat" sur une
série) et `WishlistAddForm` (exclusion des tomes déjà possédés).

### Résultat `FetchSeriesTomesResult`

```ts
type FetchSeriesTomesResult = {
  tomes: BnfTome[];        // { title, issueNumber, isbn?, publisher? }, dédupliqués par numéro
  totalRecords: number;    // total côté serveur BnF
  truncated: boolean;      // totalRecords > maximumRecords (300)
  usedAuthor: boolean;     // la recherche a-t-elle pu être restreinte par auteur
};
```

## `lib/bnf-text-search.ts` — recherche libre par titre/série

Utilisé quand l'ISBN n'est pas disponible (pas de code-barres, exemplaire d'occasion avec
ISBN manquant/erroné). Requête SRU combinant `bib.title` (mots présents, pas une phrase
exacte) et/ou `bib.anywhere` sur la série, limitée à 25 résultats. Contrairement à
`bnf-series.ts` (qui énumère systématiquement une série connue), cette recherche est
intrinsèquement bruyante par construction — la précision vient du choix humain dans la
liste de résultats (`BnfTextSearch`), pas de la requête elle-même.

## Robustesse réseau : toujours retourner du JSON

Les trois routes API (`/api/isbn/[isbn]`, `/api/series-search`, `/api/text-search`)
enveloppent systématiquement leur appel BnF dans un `try/catch` et renvoient du JSON même
en cas d'échec (timeout, erreur réseau) — en 502 pour les recherches série/texte. Sans
cela, un timeout retourne la page d'erreur HTML générique de Next, ce qui casse le
`res.json()` du client avec une erreur de parsing générique et trompeuse (Safari/WebKit :
`"The string did not match the expected pattern."`, qui ne mentionne rien du problème
réel). Le client parse aussi défensivement (`res.json().catch(() => null)`) en seconde
ligne de défense.

## Résumé des limites connues

- Éditeur/dépôt légal parfois absents pour des notices anciennes ou mal cataloguées (ex. :
  observé sur *La Route* de Manu Larcenet, ou *Fables* t.1 *Legends in Exile* sans aucune
  donnée BnF) — cohérent avec la variabilité du catalogage source, pas un bug de l'app.
  Aucune notion de "style" (franco-belge / comics / manga...) n'est disponible dans les
  données BnF — fonctionnalité écartée pour cette raison.
- Un tome publié au-delà du plus haut numéro déjà possédé dans une série ne peut pas être
  détecté par la détection de trous locale (`lib/series-gaps.ts`) — seule la recherche BnF
  élargie (`bnf-series.ts`) peut aller plus loin, et seulement si BnF le référence.
