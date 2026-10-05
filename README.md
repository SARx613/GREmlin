# GREmlin

Apprendre le vocabulaire du GRE par petites leçons façon Duolingo : 511 mots, répétition espacée, exercices variés, PWA installable et compte Google facultatif pour synchroniser la progression.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173 (sans compte Google : l'API n'est pas servie)
npm test           # tests unitaires (Vitest)
npm run e2e        # tests de bout en bout (Playwright, utilise Chrome)
npm run validate   # vérifie data/words.json
npm run build      # typage + build de production
```

Pour tester le compte Google en local, utiliser `vercel dev` (sert aussi `api/account.ts`) avec les variables ci-dessous dans `.env.local`.

## Données

`data/batches/*.json` (définitions, phrases, synonymes) + `data/mnemonics.json` + `data/families.json` (familles de sens des synonymes) → `npm run build-words` → `data/words.json` → `npm run validate`.

## Compte Google et synchronisation (facultatif)

Sans variables, l'app fonctionne exactement comme avant, sans bouton de connexion. Variables à définir dans Vercel (Settings → Environment Variables) :

| Variable | Rôle |
| --- | --- |
| `GOOGLE_CLIENT_ID` | ID client OAuth (type « Application Web ») |
| `SESSION_SECRET` | chaîne aléatoire d'au moins 32 caractères (`openssl rand -base64 48`) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | base Redis Upstash (intégration Vercel Marketplace). `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` fonctionnent aussi |

Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application. Dans « Origines JavaScript autorisées », ajouter l'URL du site Vercel (et `http://localhost:3000` pour `vercel dev`). Aucune URI de redirection n'est nécessaire.

Fonctionnement : le bouton Google renvoie un jeton vérifié côté serveur (`api/account.ts`), qui pose un cookie de session HttpOnly de 30 jours. La progression est sauvegardée dans Redis sous l'identifiant Google ; au premier login, la progression locale et celle du cloud sont fusionnées sans rien perdre.

Voir [DECISIONS.md](DECISIONS.md) pour les choix de conception.
