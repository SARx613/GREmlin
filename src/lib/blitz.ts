import type { ChoiceExercise, WordProgress, WordsData } from '../types';
import { makeExercise, pickType, type Rng } from './exercises';

export const BLITZ_SECONDS = 60;
export const WRONG_PENALTY_SECONDS = 2;
export const COMBO_STEP = 5; // tous les 5 bons d'affilée, les points comptent double

export type BlitzState = {
  score: number;
  combo: number;
  correct: number;
  wrong: number;
  missed: string[]; // mots ratés (sans doublon), pour les revoir ensuite
};

export const newBlitz = (): BlitzState => ({ score: 0, combo: 0, correct: 0, wrong: 0, missed: [] });

/** Bonne réponse : +1 point, +2 une fois le combo de 5 atteint. Mauvaise : combo remis à zéro. */
export function answerBlitz(s: BlitzState, ok: boolean, wordId: string): BlitzState {
  if (ok) {
    const combo = s.combo + 1;
    return { ...s, combo, correct: s.correct + 1, score: s.score + (combo >= COMBO_STEP ? 2 : 1) };
  }
  return { ...s, combo: 0, wrong: s.wrong + 1, missed: s.missed.includes(wordId) ? s.missed : [...s.missed, wordId] };
}

/** Mots du Blitz : ceux déjà travaillés, ou tout le vocabulaire si on en connaît trop peu. */
export function blitzPool(data: WordsData, words: Record<string, WordProgress>): string[] {
  const all = data.chapters.flatMap((c) => c.wordIds);
  const seen = all.filter((id) => (words[id]?.box ?? 0) > 0);
  return seen.length >= 12 ? seen : all;
}

const BLITZ_TYPES = new Set(['wordToDef', 'defToWord', 'synonym']);

/** Question suivante : un QCM à 4 choix, jamais deux fois le même mot de suite. */
export function nextBlitzQuestion(data: WordsData, pool: string[], previous: string | null, rng: Rng = Math.random): ChoiceExercise {
  const candidates = pool.filter((id) => id !== previous);
  const id = candidates[Math.floor(rng() * candidates.length)];
  // pickType(box 2) autorise wordToDef, defToWord, fillBlank, synonym : on ne garde que les formats rapides à lire
  for (let i = 0; i < 10; i++) {
    const type = pickType(2, undefined, [], rng);
    if (BLITZ_TYPES.has(type)) return makeExercise(data, id, type, rng) as ChoiceExercise;
  }
  return makeExercise(data, id, 'wordToDef', rng) as ChoiceExercise;
}
