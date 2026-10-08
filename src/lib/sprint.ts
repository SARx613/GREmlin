import type { Word, WordProgress, WordsData } from '../types';
import { levenshtein } from './match';

export const SPRINT_DEFAULT_SECONDS = 300; // 5 minutes par défaut
export const SPRINT_DURATIONS = [
  { seconds: 60, label: '1 min' },
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
];

export const SPRINT_COMBO_STEP = 5;

export type SprintState = {
  score: number;
  combo: number;
  correct: string[]; // wordIds trouvés
  missed: string[]; // wordIds passés ou manqués
};

export const newSprint = (): SprintState => ({
  score: 0,
  combo: 0,
  correct: [],
  missed: [],
});

export type SprintQuestion = {
  wordId: string;
  word: string;
  pos: string;
  promptFr: string;
  definitionEn: string;
  firstLetter: string;
  length: number;
};

/** Normalise une chaîne pour comparaison (sans espaces superflus, minuscules). */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/['’]/g, "'");
}

/** Vérifie si la saisie correspond au mot cible (exacte ou faute de frappe mineure d'une lettre). */
export function isSprintAnswerCorrect(input: string, target: string): { ok: boolean; typo?: boolean } {
  const normIn = normalizeAnswer(input);
  const normTarget = normalizeAnswer(target);
  if (!normIn) return { ok: false };
  if (normIn === normTarget) return { ok: true, typo: false };
  // Accepter distance de Levenshtein = 1 pour mots de 4+ lettres
  if (normTarget.length >= 4 && levenshtein(normIn, normTarget) === 1) {
    return { ok: true, typo: true };
  }
  return { ok: false };
}

/** Enregistre une réponse (bonne réponse ou mot passé). */
export function answerSprint(state: SprintState, ok: boolean, wordId: string): SprintState {
  if (ok) {
    const combo = state.combo + 1;
    const addScore = combo >= SPRINT_COMBO_STEP ? 2 : 1;
    return {
      ...state,
      combo,
      score: state.score + addScore,
      correct: state.correct.includes(wordId) ? state.correct : [...state.correct, wordId],
    };
  }
  return {
    ...state,
    combo: 0,
    missed: state.missed.includes(wordId) ? state.missed : [...state.missed, wordId],
  };
}

/** Génère un pool mélangé de mots pour le sprint. */
export function sprintPool(data: WordsData, _progressWords?: Record<string, WordProgress>): string[] {
  const all = Object.keys(data.words);
  // Mélange de Fisher-Yates
  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Construit la question pour un mot donné. */
export function makeSprintQuestion(word: Word): SprintQuestion {
  return {
    wordId: word.id,
    word: word.word,
    pos: word.pos,
    promptFr: word.definitionFr,
    definitionEn: word.definition,
    firstLetter: word.word.charAt(0).toUpperCase(),
    length: word.word.length,
  };
}
