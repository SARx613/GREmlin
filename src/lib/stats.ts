import type { DayStat, WordProgress } from '../types';
import { DAY, dayKey, getWP, isLeech } from './srs';

/** Les `n` derniers jours (le plus ancien d'abord), en clés AAAA-MM-JJ. */
export function lastDays(now: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(now - (n - 1 - i) * DAY));
}

/**
 * Mots maîtrisés par jour. Les jours sans leçon reprennent la dernière valeur connue ;
 * aujourd'hui vaut toujours la valeur actuelle.
 */
export function masteredSeries(days: Record<string, DayStat> | undefined, now: number, n: number, current: number): number[] {
  const keys = Object.keys(days ?? {}).sort();
  const window = lastDays(now, n);
  let last = 0;
  for (const k of keys) if (k < window[0]) last = days![k].mastered; // dernière valeur avant la fenêtre
  return window.map((k, i) => {
    if (i === n - 1) return current;
    if (days?.[k]) last = days[k].mastered;
    return last;
  });
}

export const lessonsSeries = (days: Record<string, DayStat> | undefined, now: number, n: number): number[] =>
  lastDays(now, n).map((k) => days?.[k]?.lessons ?? 0);

export const lessonsToday = (days: Record<string, DayStat> | undefined, now: number) => days?.[dayKey(now)]?.lessons ?? 0;

/** Mots difficiles, les plus ratés (en proportion) d'abord. */
export function leechIds(ids: string[], words: Record<string, WordProgress>, max = 10): string[] {
  return ids
    .filter((id) => isLeech(getWP(words, id)))
    .sort((a, b) => {
      const wa = getWP(words, a);
      const wb = getWP(words, b);
      return wb.misses / wb.seen - wa.misses / wa.seen || wb.misses - wa.misses;
    })
    .slice(0, max);
}
