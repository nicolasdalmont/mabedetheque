# 3. Authentification

L'authentification repose sur **Neon Managed Better Auth**, une instance hébergée de
[Better Auth](https://www.better-auth.com/) intégrée à Neon. Flux email/mot de passe
uniquement (pas d'OAuth), mono-utilisateur en pratique mais rien n'empêche plusieurs
comptes — chacun ne voit que ses propres données via RLS ([02](./02-donnees.md)).

## Côté serveur — `lib/auth/server.ts`

```ts
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
```

Instance singleton utilisée à trois endroits :
- `app/api/auth/[...path]/route.ts` : `export const { GET, POST } = auth.handler();` — expose
  tout le protocole Better Auth (connexion, déconnexion, session, token...) sous `/api/auth/*`.
- `proxy.ts` : `auth.middleware({ loginUrl: "/login" })` — protège toutes les routes.
- Toute route API serveur ayant besoin de vérifier une session
  (`app/api/covers/route.ts` via `auth.getSession()`).

## `proxy.ts` (ex-`middleware.ts`)

```ts
export default auth.middleware({ loginUrl: "/login" });
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
```

Toutes les routes sont protégées sauf les assets statiques Next, la favicon, le manifest
et les icônes — `/login` reste accessible (nécessaire pour se connecter) et redirige les
autres routes vers `/login` si aucune session valide.

Tourne obligatoirement en runtime Node.js (le middleware Better Auth utilise `jose`, qui a
besoin de `CompressionStream`/`process.cwd`, absents du runtime Edge) ; sur Next 16 l'option
`runtime` a été retirée de ce fichier et lèverait une erreur si définie.

## Côté client — `lib/neon-client.ts`

Deux clients distincts et une raison précise à cette séparation :

### `getNeonClient()` — client d'authentification

```ts
function createAuthClient() {
  return createClient<Database>({
    auth: { url: `${window.location.origin}/api/auth` },
    dataApi: { url: process.env.NEXT_PUBLIC_NEON_DATA_API_URL! },
  });
}
```

Pointé sur le mount local `/api/auth` (pas directement l'hôte Neon Auth) pour que le
cookie de session soit posé sur le domaine de l'app elle-même. Utilisé par `useSession()`
(`hooks/useSession.ts`) pour `auth.getSession()` et `auth.signOut()`, et par la page de
connexion pour `auth.signIn.email(...)`.

Créé **paresseusement** (pas au niveau module) car il a besoin de `window.location` —
Next.js évalue les modules "client component" pendant le pré-rendu serveur, où `window`
n'existe pas encore.

### `getDataClient()` — client Data API

```ts
async function getAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/token", { credentials: "same-origin" });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string };
  return data.token ?? null;
}

export function getDataClient() {
  if (!dataClient) {
    dataClient = new NeonPostgrestClient<Database>({
      dataApiUrl: process.env.NEXT_PUBLIC_NEON_DATA_API_URL!,
      options: { global: { fetch: fetchWithToken(getAccessToken) } },
    });
  }
  return dataClient;
}
```

**Pourquoi un client séparé plutôt que le cache de token intégré du SDK unifié** : le SDK
`@neondatabase/neon-js` est censé capturer automatiquement un JWT à la connexion via un
header de réponse `set-auth-jwt`, que cette instance de Managed Better Auth n'envoie pas
— son "session token" est un simple identifiant de session Better Auth, pas un JWT, et le
Data API le rejette ("not a valid JWT encoding"). L'endpoint dédié `/api/auth/token`, lui,
émet un vrai JWT à partir du cookie de session. `getDataClient()` va donc chercher ce
token lui-même à **chaque** requête Data API plutôt que de compter sur un cache interne.

## Pourquoi la connexion se fait côté client (pas en Server Action)

`app/login/page.tsx` appelle `getNeonClient().auth.signIn.email(...)` directement dans un
composant client, pas via une Server Action. Une connexion serveur poserait bien le cookie
de session, mais laisserait vide le cache de token du client Data API du navigateur
lui-même — c'est le navigateur qui doit effectuer la connexion pour que ce cache se
peuple correctement, faute de quoi tout appel Data API échoue avec `AuthRequiredError`.

## `safeAuthCall`

Le client d'auth du navigateur **lève une exception** en cas d'échec (ex. mauvais mot de
passe), contrairement au client serveur et aux appels Data API qui résolvent toujours vers
`{ data, error }`. `safeAuthCall()` normalise les deux formes pour que les appelants n'aient
jamais qu'à vérifier `.error`.

## Page de connexion (`app/login/page.tsx`)

- Formulaire **email + mot de passe** uniquement (le nom du compte n'y est pas demandé : il
  vient du compte, fixé à la création par l'admin puis éditable depuis « Mon compte »).
- Mémorise le dernier compte connecté dans `localStorage`
  (`mabedetheque:remembered-account`, helpers dans `lib/remembered-account.ts`) : l'écran
  affiche alors l'**identité** de ce compte (initiale + Prénom Nom) et ne redemande que le
  mot de passe. Trois modes d'affichage (`picker` / `password` / `full`) ; « Utiliser un
  autre compte » ouvre le formulaire complet email + mot de passe (aussi le cas à la
  première connexion sur un appareil). « Mon compte » met à jour le nom mémorisé.
- Flux « Mot de passe oublié ? » : voir [Mot de passe oublié](#mot-de-passe-oublié-et-resend).

## Gestion des comptes

Pas d'inscription publique : comme dans todolist-familiale, **un administrateur crée les
comptes** depuis l'application. Chaque compte a sa propre bédéthèque (RLS sur `owner_id`) :
un nouveau compte démarre avec une collection vide.

### Rôle administrateur

Neon Managed Better Auth embarque le plugin **admin** de Better Auth (colonne
`neon_auth."user".role`, `'admin'` ou `'user'`), appelé côté navigateur via
`getNeonClient().auth.admin.*`. Le rôle est exposé dans la session (`useSession().user.role`).
**Le tout premier admin ne peut pas être créé depuis l'app** : console Neon → Auth → Users →
menu « ⋯ » du compte → *Make admin* (puis se reconnecter pour que la session le voie).
La vérification qui compte est côté Better Auth / SQL ; `role === "admin"` côté client ne
sert qu'à afficher les écrans.

### Gestion des comptes (`components/AccountsManager.tsx`, admin uniquement)

Affichée **directement sur « Mon compte »** sous les blocs identité et mot de passe, pour les
admins seulement (`/comptes` ne fait plus que rediriger vers `/compte`). Liste des comptes
(`admin.listUsers`) avec :

- **Ajouter un compte** (`admin.createUser`) : Prénom Nom, email, rôle, **mot de passe
  temporaire** généré (`lib/temp-password.ts`, « mot-123 », `crypto.getRandomValues`),
  modifiable. Il est affiché une seule fois dans un encart (avec bouton Copier) pour que
  l'admin le transmette à la main.
- **Réinitialiser** (`admin.setUserPassword`) : nouveau mot de passe temporaire, même encart.
- **Promouvoir / Rétrograder** (`admin.setRole`), jamais sur son propre compte.
- **Stats** par compte : nombre d'albums et dernière connexion (voir plus bas).

Volontairement **absent** : la suppression de compte (elle laisserait les albums du compte
orphelins en base ; à concevoir avec leur nettoyage si besoin).

### Changement de mot de passe forcé

Un compte créé ou réinitialisé par un admin porte un mot de passe temporaire : il doit en
choisir un à sa première connexion.

- **Pourquoi une table à nous** : Better Auth géré par Neon n'accepte pas de champ
  personnalisé sur `neon_auth."user"`. Le drapeau vit dans `public.account_flags`
  (migration 0011, voir [02](./02-donnees.md)). **Pas de ligne = rien d'exigé**, donc les
  comptes antérieurs à la fonctionnalité ne sont pas touchés (un compte créé avant son
  déploiement ne déclenche pas le changement forcé : il faut le « Réinitialiser »).
- **Qui pose le drapeau** : l'admin, juste après `createUser` / `setUserPassword`, via
  `rpc('flag_password_change')` (`lib/password-flag.ts`), fonction `SECURITY DEFINER` qui
  relit le rôle dans `neon_auth."user"` — la RLS interdit à un admin d'écrire la ligne d'un
  autre compte. Si la pose échoue, le compte est quand même créé et l'admin en est averti
  par un toast.
- **Qui l'efface** : l'utilisateur, sur sa propre ligne (policy UPDATE), après
  `changePassword`.
- **Application** : `PasswordChangeGate` (monté dans le layout) redirige vers `/compte` tant
  que le drapeau est levé ; `/compte` passe alors en **mode forcé** (seul le formulaire de
  mot de passe, le mot de passe actuel étant le temporaire) puis renvoie vers l'accueil.
  Garde de confort côté client : ce qu'un utilisateur peut contourner ne lui ouvre de toute
  façon que ses propres données.

### « Mon compte » (`app/compte/page.tsx`)

Accessible à tous via l'icône utilisateur de l'en-tête (`AccountButton`).

- **Identité** : Prénom Nom (`auth.updateUser({ name })`). L'email est affiché en lecture
  seule : il sert à la connexion et à la récupération du mot de passe (le changer
  demanderait une vérification par email).
- **Mot de passe** : `auth.changePassword({ currentPassword, newPassword,
  revokeOtherSessions: true })`, 8 caractères minimum.
- Les blocs Identité et Mot de passe sont côte à côte (une colonne sur mobile) ; pour un
  admin, la gestion des comptes s'affiche en dessous.

### Stats de la gestion des comptes : dernière connexion et nombre d'albums

Migration 0012. Deux obstacles : la RLS interdit à un admin de lire les albums des autres
comptes, et Better Auth **supprime la session à la déconnexion** (la date de dernière
connexion s'y perdrait).

- `touch_last_seen()` (`SECURITY DEFINER`, appelée par `PasswordChangeGate` une fois par
  chargement de l'app) écrit `account_flags.last_seen_at` pour l'utilisateur courant.
- `admin_account_stats()` (`SECURITY DEFINER`, réservée aux admins) renvoie, par compte, le
  nombre d'albums (mêmes critères que `useAlbums()` : hors achats `is_wishlist` et hors
  vendus) et la plus récente entre `last_seen_at` et l'activité de session
  (`neon_auth.session."updatedAt"`).
- Sans la migration, la liste des comptes s'affiche simplement sans stats.

## Mot de passe oublié et Resend

« Mot de passe oublié ? » (écran de connexion) utilise le flux **code à 6 chiffres par
email** de Better Auth (`forgetPassword.emailOtp` puis `emailOtp.resetPassword`), l'email
étant envoyé par **Neon**, pas par l'app. Par défaut c'est le fournisseur partagé de Neon
(test uniquement). Pour envoyer depuis le domaine du projet via **Resend**, comme Woro :
console Neon → Auth → configuration de l'email → **fournisseur SMTP personnalisé** :

| Champ | Valeur |
|---|---|
| Hôte | `smtp.resend.com` |
| Port | `465` |
| Utilisateur | `resend` |
| Mot de passe | clé API Resend |
| Expéditeur | une adresse d'un domaine **vérifié dans Resend** |

Aucune clé Resend n'est lue par l'app (contrairement à Woro, qui appelle Resend en HTTP) :
c'est une configuration de la console Neon, à rejouer par branche. Le domaine et les
enregistrements DNS se gèrent comme décrit dans la doc de Woro (`docs/07-domaine-et-email.md`).
Après configuration, utiliser l'envoi de test de la console puis le flux réel sur un
compte de test.

## `useSession()` (`hooks/useSession.ts`)

Hook client exposant `{ user, loading, signOut }` ; `user` inclut `role` (plugin admin). Charge la session au montage via
`getNeonClient().auth.getSession()`. `signOut()` appelle `auth.signOut()` puis redirige
vers `/login`. Utilisé par `SignOutButton`, et par chaque page/composant ayant besoin de
`user.id` pour poser `owner_id` sur un insert (nouvel album, item wishlist, idée...).
