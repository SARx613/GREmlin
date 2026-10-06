import type { WordsData } from '../types';
import { dayKey } from './srs';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Le mot du jour : le même toute la journée, différent chaque jour, sans état à stocker. */
export function wordOfTheDay(data: WordsData, now: number): string {
  const ids = data.chapters.flatMap((c) => c.wordIds);
  return ids[hash(dayKey(now)) % ids.length];
}

/** Ajoute ou retire un favori. */
export function toggleStar(starred: string[] | undefined, id: string): string[] {
  const list = starred ?? [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
