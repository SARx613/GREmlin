import type { WordsData } from '../types';

export const SPEED_MATCH_SECONDS = 90;
export const SPEED_MATCH_COMBO_STEP = 5;
export const ACTIVE_PAIRS_COUNT = 5;

export type MatchItem = {
  id: string; // wordId
  text: string;
};

export type SpeedMatchState = {
  score: number;
  combo: number;
  correctCount: number;
  wrongCount: number;
  englishItems: MatchItem[]; // 5 mots anglais
  frenchItems: MatchItem[]; // 5 traductions françaises (mélangées)
};

export function shuffle<T>(arr: T[]): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export function newSpeedMatch(data: WordsData, pool: string[]): SpeedMatchState {
  const initialIds = pool.slice(0, ACTIVE_PAIRS_COUNT);
  const words = initialIds.map((id) => data.words[id]).filter(Boolean);

  const englishItems: MatchItem[] = shuffle(words.map((w) => ({ id: w.id, text: w.word })));
  const frenchItems: MatchItem[] = shuffle(words.map((w) => ({ id: w.id, text: w.definitionFr })));

  return {
    score: 0,
    combo: 0,
    correctCount: 0,
    wrongCount: 0,
    englishItems,
    frenchItems,
  };
}

/** Remplace une paire réussie par un nouveau mot issu du pool. */
export function replacePair(
  state: SpeedMatchState,
  matchedId: string,
  data: WordsData,
  nextWordId?: string,
): SpeedMatchState {
  const combo = state.combo + 1;
  const addScore = combo >= SPEED_MATCH_COMBO_STEP ? 2 : 1;

  let newEn = state.englishItems.filter((item) => item.id !== matchedId);
  let newFr = state.frenchItems.filter((item) => item.id !== matchedId);

  if (nextWordId && data.words[nextWordId]) {
    const nextWord = data.words[nextWordId];
    // Insérer à une position aléatoire
    const enIdx = Math.floor(Math.random() * (newEn.length + 1));
    const frIdx = Math.floor(Math.random() * (newFr.length + 1));
    newEn = [...newEn.slice(0, enIdx), { id: nextWord.id, text: nextWord.word }, ...newEn.slice(enIdx)];
    newFr = [...newFr.slice(0, frIdx), { id: nextWord.id, text: nextWord.definitionFr }, ...newFr.slice(frIdx)];
  }

  return {
    ...state,
    score: state.score + addScore,
    combo,
    correctCount: state.correctCount + 1,
    englishItems: newEn,
    frenchItems: newFr,
  };
}

export function recordSpeedMatchError(state: SpeedMatchState): SpeedMatchState {
  return {
    ...state,
    combo: 0,
    wrongCount: state.wrongCount + 1,
  };
}
