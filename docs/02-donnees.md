# 2. Modèle de données

Toutes les migrations sont dans `db/migrations/`, numérotées et exécutées manuellement
(pas de runner automatique) sur le projet Neon — via l'éditeur SQL du dashboard,
`psql "$NEON_DATABASE_URL" -f db/migrations/000X_xxx.sql`, ou (environnement sans `psql`,
ex. `node scripts/db/run-migration.mjs db/migrations/000X_xxx.sql`, qui exécute le fichier
tel quel via `pg`). Chacune est idempotente (`if not exists`, `drop policy if exists` puis
recréation, `update ... where ... and not déjà fait`) pour pouvoir être rejouée sans risque.

## Historique des migrations

| Fichier | Contenu |
|---|---|
| `0001_init.sql` | Table `albums` + RLS + grants |
| `0002_isbn_optional.sql` | `isbn` devient nullable (albums anciens/dons sans ISBN) |
| `0003_fix_rls_policy_syntax.sql` | Correction critique de la syntaxe RLS (voir plus bas) |
| `0004_ideas.sql` | Table `ideas` ("boîte à idées") |
| `0005_wishlist.sql` | Table `wishlist_items` (liste d'achats) |
| `0006_sale_status.sql` | Colonne `albums.sale_status` (onglet Ventes) |
| `0007_integrale.sql` | Colonne `albums.is_integrale` + backfill depuis les commentaires |

## Table `albums`

```sql
create table albums (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,

  isbn text,                    -- nullable depuis 0002
  title text not null,
  series_name text,
  issue_number integer,
  publisher text,
  writer text,
  illustrator text,
  legal_deposit text,           -- texte libre (ex. "DL 2024", "02/1993")
  purchase_date date,
  comment text,
  cover_url text not null,

  sale_status text not null default 'none'
    check (sale_status in ('none', 'a_vendre', 'vendu')),  -- ajouté en 0006

  is_integrale boolean not null default false,  -- ajouté en 0007

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Index : `owner_id`, `isbn`, `series_name`, `sale_status`.

`is_integrale` remplace `issue_number` comme indicateur de position dans la série pour un
album qui compile plusieurs tomes (les deux sont mutuellement exclusifs — cocher
« Intégrale » dans `AlbumForm` vide et désactive le numéro de tome). Affiché via
`tomeLabel()` ([07](./07-composants-et-hooks.md)) et exclu de l'anomalie Stats "en série
sans numéro de tome" ([06](./06-pages-et-fonctionnalites.md)).

0007 a aussi fait un **backfill en une fois** sur la collection existante : l'import
initial (`scripts/db/prepare-import.py`) avait recopié le champ "NumA" (référence
complémentaire) du logiciel d'origine dans `comment`, sous la forme
`"Réf. complémentaire : INT"` (parfois suivi d'un suffixe : `INT01`, `INTa1999`...) pour
les albums possédés en intégrale. 34 albums correspondaient à ce motif exact, tous déjà
`issue_number = null` — vérifiés un par un avant application (à ne pas confondre avec
`"Collection : Intégra"`, une collection éditoriale sans rapport, ou une série nommée
`"(Intégrale)"` dont les tomes ont chacun un vrai numéro). Une future intégrale ajoutée
via le formulaire n'a pas ce marqueur textuel — c'est un cas particulier de migration, pas
un mécanisme permanent de détection.

Trigger `set_updated_at()` (fonction plpgsql partagée par toutes les tables) maintient
`updated_at` à jour à chaque `UPDATE`.

`sale_status` distingue un album "actif" (`none`) d'un album mis en vente (`a_vendre`) ou
vendu (`vendu`). Un album `vendu` **n'est pas supprimé** : il disparaît des vues normales
(galerie, séries, stats — via `useAlbums()`, voir plus bas) mais reste consultable dans
l'onglet Ventes. C'est une distinction volontaire avec `wishlist_items`, qui liste des
tomes qu'on ne possède **pas encore**.

Le type TypeScript correspondant est `Album` (`types/album.ts`) ; `AlbumInput` (utilisé
par les formulaires) exclut délibérément `sale_status`, géré uniquement par des actions
dédiées (page d'édition, onglet Ventes) — jamais par le formulaire générique d'ajout/édition.

## Table `wishlist_items`

```sql
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,

  series_name text not null,
  issue_number integer,
  title text,
  publisher text,
  isbn text,
  cover_url text,

  status text not null default 'a_acheter'
    check (status in ('a_acheter', 'achete')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Index : `owner_id`, `status`, `series_name`.

Représente un tome que l'utilisateur veut se procurer (envoyé depuis l'onglet Séries — via
détection de trou local ou recherche BnF — ou ajouté manuellement/par recherche depuis
l'onglet Achats). Contrairement à `albums`, seul `series_name` est obligatoire : un tome
peut être ajouté avec très peu d'informations.

Le statut `"achete"` existe dans le schéma mais dans le flux normal un item passe
directement de la wishlist à la table `albums` puis est **supprimé** de
`wishlist_items` (voir `BuyWishlistModal`, [06](./06-pages-et-fonctionnalites.md)) — le
bouton de bascule manuelle `a_acheter ⇄ achete` reste néanmoins disponible pour un usage
sans passer par ce flux.

## Table `ideas`

```sql
create table ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  content text not null,
  status text not null default 'created'
    check (status in ('created', 'processed', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Index : `owner_id`, `status`. "Boîte à idées" pour les suggestions d'amélioration de l'app,
avec un statut de suivi simple (même principe que sur d'autres apps de l'utilisateur).

## Row Level Security

Chaque table a le même schéma de policies (select/insert/update/delete), toutes de la forme :

```sql
alter table <table> enable row level security;

create policy <table>_owner_select on <table> for select
  using ((select auth.user_id()) = owner_id);
create policy <table>_owner_insert on <table> for insert
  with check ((select auth.user_id()) = owner_id);
create policy <table>_owner_update on <table> for update
  using ((select auth.user_id()) = owner_id) with check ((select auth.user_id()) = owner_id);
create policy <table>_owner_delete on <table> for delete
  using ((select auth.user_id()) = owner_id);

grant select, insert, update, delete on <table> to authenticated;
revoke all on <table> from anonymous;
```

Le rôle `anonymous` (requête sans JWT valide) ne reçoit **aucun** droit ; le rôle
`authenticated` reçoit les droits au niveau table, RLS les restreint ensuite aux lignes
dont `owner_id` correspond à l'utilisateur courant.

### ⚠️ Piège de syntaxe RLS corrigé en 0003

La forme initiale (0001) comparait directement `auth.user_id() = owner_id`. Cette
fonction Neon (extension C `pg_session_jwt`) **échoue silencieusement** hors d'une
sous-requête scalaire : la comparaison directe rend toutes les lignes invisibles en
`SELECT` et rejette tout `INSERT`/`UPDATE` en `42501`, sans message d'erreur explicite —
alors même que le JWT et `owner_id` correspondent. Le correctif (0003, et appliqué
d'emblée dans 0004/0005) est d'entourer l'appel d'un `(select auth.user_id())`. Toute
nouvelle table/policy **doit** suivre cette forme.

Ce bug a été découvert en investiguant pourquoi une collection importée en masse
n'apparaissait pas dans l'app alors que les lignes étaient bien présentes en base.

## `owner_id`

`owner_id` est du type `text` (pas `uuid`) car il stocke l'identifiant utilisateur émis
par Better Auth (`sub` du JWT), pas un UUID Postgres généré localement.

## Accès en écriture directe (scripts one-off)

`NEON_DATABASE_URL` (connexion Postgres directe, non exposée à l'app) sert uniquement :
- à exécuter les migrations SQL,
- pour des scripts one-off ponctuels (ex. import initial de la collection depuis un CSV,
  voir `scripts/db/`, ou une correction de données en masse), généralement écrits comme un
  script Node.js utilisant le package `pg` directement, lisant `.env.local`.

L'application elle-même n'utilise jamais cette variable au runtime — uniquement le Data API.
