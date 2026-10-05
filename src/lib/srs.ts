import type { Chapter, Streak, WordProgress } from '../types';

export const DAY = 24 * 60 * 60 * 1000;
export const MAX_BOX = 6;
export const MASTERED_BOX = 4;

const INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 35 };

export const intervalMs = (box: number) => (INTERVAL_DAYS[box] ?? 1) * DAY;

export const emptyProgress = (): WordProgress => ({ box: 0, dueAt: 0, seen: 0, misses: 0 });

export const getWP = (words: Record<string, WordProgress>, id: string): WordProgress => words[id] ?? emptyProgress();

export const isNew = (wp: WordProgress) => wp.box === 0;
export const isDue = (wp: WordProgress, now: number) => wp.box > 0 && wp.dueAt <= now;
export const isMastered = (wp: WordProgress) => wp.box >= MASTERED_BOX;

export type WordStatus = 'new' | 'learning' | 'mastered';
export const statusOf = (wp: WordProgress): WordStatus => (wp.box === 0 ? 'new' : isMastered(wp) ? 'mastered' : 'learning');

/** Mots dus, les plus en retard d'abord. */
export function dueIds(ids: string[], words: Record<string, WordProgress>, now: number): string[] {
  return ids
    .filter((id) => isDue(getWP(words, id), now))
    .sort((a, b) => getWP(words, a).dueAt - getWP(words, b).dueAt);
}

/** Mots nouveaux ; ceux marqués « je ne connais pas » passent en premier. */
export function newIds(ids: string[], words: Record<string, WordProgress>): string[] {
  const fresh = ids.filter((id) => isNew(getWP(words, id)));
  return [...fresh.filter((id) => getWP(words, id).known === false), ...fresh.filter((id) => getWP(words, id).known !== false)];
}

export const masteredCount = (ids: string[], words: Record<string, WordProgress>) =>
  ids.filter((id) => isMastered(getWP(words, id))).length;

export const chapterDueCount = (ch: Chapter, words: Record<string, WordProgress>, now: number) =>
  dueIds(ch.wordIds, words, now).length;

/**
 * Adapte l'intervalle à la difficulté personnelle du mot : un mot souvent raté revient plus tôt (jusqu'à ×0,6),
 * un mot presque toujours réussi plus tard (jusqu'à ×1,25). Neutre tant que le mot a été vu moins de 3 fois.
 */
export function difficultyFactor(wp: WordProgress): number {
  if (wp.seen < 3) return 1;
  return Math.min(1.25, Math.max(0.6, 1.25 - 0.5 * (wp.misses / wp.seen)));
}

/** Mot « difficile » : raté au moins aussi souvent que vu (après 4 rencontres). */
export const isLeech = (wp: WordProgress) => wp.seen >= 4 && wp.misses >= wp.seen;

/** Mise à jour d'un mot en fin de leçon. */
export function applyResult(wp: WordProgress, hadError: boolean, now: number): WordProgress {
  let box: number;
  if (!hadError) box = Math.min(MAX_BOX, wp.box + 1);
  else box = wp.box >= 3 ? 1 : Math.max(1, wp.box - 1);
  return { ...wp, box, dueAt: now + Math.round(intervalMs(box) * difficultyFactor(wp)), seen: wp.seen + 1 };
}

/** Tri initial. */
export function markKnown(wp: WordProgress, now: number): WordProgress {
  return { ...wp, box: MASTERED_BOX, known: true, dueAt: now + intervalMs(MASTERED_BOX) };
}
export function markUnknown(wp: WordProgress): WordProgress {
  return { ...wp, box: 0, known: false, dueAt: 0 };
}

// --- Série de jours -------------------------------------------------------

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Appelé quand une leçon est terminée. */
export function recordLesson(streak: Streak, now: number): Streak {
  const today = dayKey(now);
  if (streak.lastDay === today) return streak;
  const yesterday = dayKey(now - DAY);
  return { count: streak.lastDay === yesterday ? streak.count + 1 : 1, lastDay: today };
}

/** Valeur à afficher : retombe à 0 si un jour complet a été sauté. */
export function currentStreak(streak: Streak, now: number): number {
  if (!streak.lastDay) return 0;
  return streak.lastDay === dayKey(now) || streak.lastDay === dayKey(now - DAY) ? streak.count : 0;
}
