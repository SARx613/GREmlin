# GREmlin

Apprendre le vocabulaire du GRE par petites leçons façon Duolingo : 1 134 mots essentiels (issus du GRE Vocabulaire complet), répétition espacée, 46 chapitres en 5 séries, nouveaux modes de jeu (Sprint Traduction 5 min, Speed Match 90 s, Blitz 60 s), PWA installable et compte Google facultatif pour synchroniser la progression.

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

## Fonctionnalités

Leçons thématiques (QCM, phrases à trous, synonymes, Sentence Equivalence, paires, écriture, écoute, dictée) · répétition espacée adaptative · tri « je connais » · mot du jour · favoris ★ · Sprint Traduction (chrono 5 min avec combo et tolérance de frappe) · Speed Match (90 s de paires effrénées) · Blitz 60 s · 46 chapitres équilibrés en 5 séries thématiques · statistiques et succès · recherche et filtres · mode sombre · voix américaine réglable · rappels et mots surprise par notification · compte Google avec synchronisation · installable et utilisable hors ligne.

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

## Notifications (rappel quotidien + mots surprise)

Chaque appareil s'abonne dans Réglages → Rappels (compte Google requis) et choisit l'heure du rappel, le nombre de mots surprise par jour (0 à 4) et la plage horaire. Le serveur envoie ensuite :

- **un rappel** à l'heure choisie (avec le nombre de mots à réviser ; « garde ta série » si elle est en danger ; rien si la leçon du jour est déjà faite) ;
- **des mots surprise** : un mot pas encore maîtrisé avec sa définition en anglais et en français, à des heures un peu différentes chaque jour. Toucher la notification ouvre la fiche du mot.

Variables Vercel supplémentaires : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) et `CRON_SECRET` (`openssl rand -hex 32`).

L'envoi est déclenché toutes les 10 minutes par `.github/workflows/notify.yml` (GitHub Actions, gratuit) : ajouter dans le dépôt GitHub → Settings → Secrets and variables → Actions un secret `CRON_SECRET` avec **la même valeur** que dans Vercel. GitHub peut retarder une exécution de quelques minutes ; un créneau manqué de moins de 3 h est rattrapé. Alternative : cron-job.org (appel toutes les 5 min de `https://<site>/api/notify` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`).

Sur iPhone/iPad, les notifications ne fonctionnent que si l'app est installée sur l'écran d'accueil (iOS 16.4 ou plus).

Voir [DECISIONS.md](DECISIONS.md) pour les choix de conception.
