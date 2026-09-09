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

- Formulaire email/mot de passe uniquement.
- Mémorise le dernier compte connecté dans `localStorage`
  (`mabedetheque:remembered-account`, clé `REMEMBERED_KEY`) pour proposer un sélecteur de
  compte ("picker") plutôt que de redemander l'email à chaque connexion — trois modes
  d'affichage (`picker` / `password` / `full`).
- Comprend aussi un flux de réinitialisation de mot de passe (`onForgotPassword`).

## `useSession()` (`hooks/useSession.ts`)

Hook client exposant `{ user, loading, signOut }`. Charge la session au montage via
`getNeonClient().auth.getSession()`. `signOut()` appelle `auth.signOut()` puis redirige
vers `/login`. Utilisé par `SignOutButton`, et par chaque page/composant ayant besoin de
`user.id` pour poser `owner_id` sur un insert (nouvel album, item wishlist, idée...).
