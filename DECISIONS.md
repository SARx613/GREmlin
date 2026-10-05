# GREmlin — décisions (points ambigus du plan, option la plus simple retenue)

- **Chapitres** : le fichier source a 3 sections (Faux amis, Synonymes puissants, Mots isolés), pas de chapitres numérotés. Chaque section est découpée en chapitres d'environ 25 mots, dans l'ordre (21 chapitres, 511 mots). Voir `scripts/build-words.ts`.
- **Données** : `data/batches/*.json` (rédigés par lots) → `npm run build-words` → `data/words.json` (commité) → `npm run validate`. `data/work/` est du brouillon ignoré par git.
- **Maquettes MCP design** : non utilisées ; les valeurs du tableau « Design » du plan ont été reprises telles quelles dans `tailwind.config.js`.
- **Phrase à trous** : les choix sont les mots à l'infinitif/forme de base ; la phrase garde sa forme fléchie masquée par `_____`.
- **Distracteurs** : même chapitre, même nature, jamais un synonyme ; les ~6 mots voisins dans la liste (souvent la même famille de sens) ne passent qu'en dernier recours.
- **Paires** : les définitions de droite sont les traductions françaises courtes (plus lisibles sur mobile).
- **Seuil « maîtrisé »** : boîte ≥ 4 (barres de chapitre, pastille verte, compteur de l'accueil).
- **Réinsertion d'une erreur** : après 3 autres éléments de la file (ou en fin de file s'il en reste moins).
- **Tri** : ← « je ne connais pas », → « je connais ». Seuls les mots jamais triés sont proposés.
- **Leçon sur sélection** : 10 mots maximum.
- **Sauvegarde en cours de leçon** : la file complète est enregistrée après chaque réponse (`gre-lesson-v1`) ; au rechargement, l'accueil propose « Reprendre ma leçon ». La croix (avec confirmation) abandonne la leçon.
- **QCM + phrase à trous** partagent un seul composant (`MultipleChoice.tsx`) ; pas de `FillBlank.tsx`.
- **Confirmations** (réinitialiser, importer) : `window.confirm`, pas de modale dédiée.

## Ajouts après la première version

- **Compte Google** : une seule fonction `api/account.ts` (jeton Google vérifié avec `jose`, cookie de session HttpOnly signé, Redis Upstash via son API REST, sans SDK). Facultatif : sans variables d'environnement, l'app se comporte comme avant.
- **Synchronisation** : fusion locale/cloud côté client (`src/lib/merge.ts`) : par mot, la version la plus travaillée gagne (puis la boîte la plus haute) ; série et historique : le plus récent / le plus grand. « Réinitialiser » écrase aussi le cloud, sinon la fusion ramènerait les anciens mots.
- **SRS adaptatif** : l'intervalle est multiplié par 0,6 à 1,25 selon la proportion d'erreurs du mot (neutre avant 3 rencontres). Mot « difficile » = raté au moins autant que vu, après 4 rencontres.
- **Nouveaux exercices** : Sentence Equivalence (2 bonnes réponses sur 6, générée à partir du mot et d'un de ses synonymes à un seul mot) à partir de la boîte 3 ; écoute (le mot est prononcé, on choisit sa définition) à partir de la boîte 2, seulement si le son est actif et disponible.
- **Chapitres de synonymes** regroupés par famille de sens (`data/families.json`, vérifié contre l'ordre des mots à chaque build). Les noms de familles sont des étiquettes de regroupement, pas des titres du fichier source d'origine.
- **Mnémotechniques** : les 297 manquants ont été ajoutés (`data/mnemonics.json`). Relecture : définitions et traductions des 511 mots relues, phrases non relues une à une.
- **Voix** : classement des voix du navigateur (exclusion des voix de fantaisie type Zarvox/Fred, préférence aux voix naturelles en américain) + choix manuel, accent et vitesse dans les réglages. « minute » (adj.) a une prononciation forcée.
- **Mode sombre** (auto / clair / sombre) via variables CSS ; texte foncé sur les boutons vifs pour le contraste ; couleurs de texte dédiées (`*-ink`).
- **Rappels quotidiens (notifications push)** : non faits. Ils demandent des clés VAPID, un abonnement stocké côté serveur et une tâche planifiée : à ajouter si vous le souhaitez.
- **Découpage de `words.json`** : non fait. Le fichier (162 Ko compressé avec le reste du JS) est nécessaire dès l'accueil ; le charger à part n'accélère rien.
