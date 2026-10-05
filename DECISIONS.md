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
