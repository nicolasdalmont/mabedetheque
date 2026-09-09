# 5. Stockage des couvertures

Les couvertures d'albums sont stockées sur **Neon Object Storage** (S3-compatible),
traitées côté serveur avant upload.

## `lib/storage.ts` — client S3

```ts
const s3 = new S3Client({
  endpoint: process.env.NEON_STORAGE_ENDPOINT!,
  region: process.env.NEON_STORAGE_REGION ?? "auto",
  credentials: {
    accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // https://endpoint/bucket/key, requis par l'endpoint Neon
});
```

- `uploadCover(bytes, contentType)` — écrit sous la clé `covers/<uuid>.webp` avec
  `CacheControl: public, max-age=31536000, immutable` (les fichiers sont immuables : un
  remplacement de couverture génère toujours une nouvelle clé, jamais un écrasement),
  retourne l'URL publique.
- `deleteCover(coverUrl)` — no-op silencieux si l'URL ne correspond pas au préfixe du
  bucket configuré (ex. couverture jamais remplacée, ou provenant d'ailleurs) ; sinon
  supprime l'objet.
- `publicUrl(key)` construit l'URL comme `${endpoint}/${bucket}/${key}` (bucket
  `public_read`, lecture publique, écriture réservée au credential serveur).

Le bucket est **scopé à la branche Neon** — ne pas confondre avec un bucket S3 global.

## `app/api/covers/route.ts` — route serveur d'upload/suppression

Jamais exposée directement au client sans passer par cette route : les credentials
Object Storage restent côté serveur.

### `POST` — upload

Accepte deux formats de requête :
1. **`multipart/form-data`** avec un champ `file` — upload d'une photo prise/choisie par
   l'utilisateur (galerie ou fichiers, voir `AlbumForm`) ou collée depuis le presse-papiers.
2. **JSON `{ sourceUrl }`** — rapatriement d'une couverture trouvée par la recherche ISBN
   (Google Books / Open Library / URL BnF), téléchargée serveur puis traitée normalement.

Traitement identique dans les deux cas (`processAndUpload`) :
```ts
const webp = await sharp(bytes)
  .resize({ width: 900, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toBuffer();
```
Redimensionnement à 900px de large max (sans agrandir une image plus petite), conversion
en WebP qualité 82 — objectif cahier des charges : chargement rapide des grilles d'albums.

Nécessite une session valide (`auth.getSession()` côté serveur) — 401 sinon. Toute erreur
de traitement retourne un JSON `{ error }` (jamais une page d'erreur HTML, voir
[04](./04-recherche-isbn-bnf.md) pour la raison — même principe appliqué ici).

### `DELETE` — suppression

Reçoit `{ coverUrl }`, appelle `deleteCover()`. Utilisée :
- lors de la suppression d'un album (purge la couverture avant de supprimer la ligne) ;
- lors du remplacement d'une couverture existante en édition (l'ancienne est purgée
  **après** que la mise à jour de la ligne a réussi, et seulement si l'URL a réellement
  changé) — best-effort (`.catch(() => {})`), un échec de purge ne bloque jamais la sauvegarde.

## Flux d'upload côté client

Commun à `app/albums/new/page.tsx`, `app/albums/[id]/edit/page.tsx` et
`components/BuyWishlistModal.tsx` : le composant maintient soit un `File` local
(`coverFile`, sélection galerie/fichiers ou collage presse-papiers), soit une
`remoteCoverUrl` (résultat d'une recherche ISBN) ; à la soumission, l'un des deux est
envoyé à `/api/covers` — jamais les deux en même temps (sélectionner un fichier local
efface la `remoteCoverUrl` et inversement, voir `handleCoverFileSelected`).

## Interaction cover dans `AlbumForm`

`components/AlbumForm.tsx` fournit :
- une zone de prévisualisation cliquable (`tabIndex`) qui capte `onPaste` pour coller une
  image du presse-papiers directement (`Ctrl/Cmd+V`) ;
- deux boutons de sélection de fichier — **"Galerie photo"** et **"Fichiers"**, tous deux
  `<input type="file" accept="image/*">` **sans** l'attribut `capture` : le choix a été
  fait explicitement de laisser l'utilisateur choisir dans sa photothèque ou son
  gestionnaire de fichiers, pas de déclencher directement l'appareil photo ;
- si `onSearchCover` est fourni par le parent, un bouton "Rechercher une couverture"
  (recherche cover-only à partir de l'ISBN déjà saisi dans le formulaire, sans relancer
  tout le lookup de métadonnées).

## `KNOWN_DEAD_COVER_URL` — une couverture cassée partagée par 423 albums

Constante définie dans `lib/constants.ts` :

```ts
export const KNOWN_DEAD_COVER_URL =
  "https://br-icy-forest-a5gmcjl7.storage.c-1.us-east-2.aws.neon.tech/mabedetheque-covers/covers/aee360a3-...webp";
```

Découverte en déboguant un affichage cassé sur la série "Capricorne" : cette URL unique
(qui retourne 404) a été écrite sur 423 des 875 albums de la collection — vraisemblablement
par un script de récupération de couvertures en masse qui écrivait un placeholder plutôt
que de laisser `cover_url` vide en cas d'échec de recherche. **Non corrigée au niveau des
données** (décision laissée à l'utilisateur, jamais tranchée depuis) — traitée uniquement
comme un cas d'affichage :
- exclue lors du choix de la couverture représentative d'une série (`app/series/page.tsx`,
  `buildSeriesList()`) ;
- comptée comme "sans couverture" dans le hint de l'onglet Stats
  (`albumsWithoutCover`) aux côtés des `cover_url` réellement vides.

Indépendamment de cette URL spécifique, `AlbumCard` et `SeriesCard` ont chacun un état
`broken` (`onError` sur l'`<img>`) qui bascule vers un placeholder texte "Pas de
couverture" pour **n'importe quelle** image cassée, quelle qu'en soit la cause — la
constante ci-dessus ne couvre que les deux endroits (choix de couverture de série, compteur
Stats) où une simple vérification "y a-t-il une URL" ne suffit pas.
