import type { Progress } from '../types';
import { isMastered, getWP } from './srs';

export type Achievement = {
  id: string;
  group: 'Leçons' | 'Série' | 'Maîtrise' | 'Blitz';
  label: string;
  target: number;
  value: number;
  unlocked: boolean;
};

const lessonsTotal = (p: Progress) => Object.values(p.days ?? {}).reduce((n, d) => n + d.lessons, 0);

/** Succès calculés à partir de la progression : rien de plus à stocker. */
export function achievements(p: Progress, allIds: string[]): Achievement[] {
  const mastered = allIds.filter((id) => isMastered(getWP(p.words, id))).length;
  const bestStreak = Math.max(p.streak.best ?? 0, p.streak.count);
  const lessons = lessonsTotal(p);
  const blitz = p.blitz?.best ?? 0;

  const defs: [Achievement['group'], string, number, number][] = [
    ['Leçons', 'Première leçon', 1, lessons],
    ['Leçons', '10 leçons', 10, lessons],
    ['Leçons', '50 leçons', 50, lessons],
    ['Leçons', '100 leçons', 100, lessons],
    ['Série', '3 jours de suite', 3, bestStreak],
    ['Série', '7 jours de suite', 7, bestStreak],
    ['Série', '30 jours de suite', 30, bestStreak],
    ['Maîtrise', '25 mots maîtrisés', 25, mastered],
    ['Maîtrise', '100 mots maîtrisés', 100, mastered],
    ['Maîtrise', '250 mots maîtrisés', 250, mastered],
    ['Maîtrise', `Les ${allIds.length} mots maîtrisés`, allIds.length, mastered],
    ['Blitz', 'Blitz : 15 points', 15, blitz],
    ['Blitz', 'Blitz : 30 points', 30, blitz],
    ['Blitz', 'Blitz : 50 points', 50, blitz],
  ];
  return defs.map(([group, label, target, value]) => ({ id: label, group, label, target, value: Math.min(value, target), unlocked: value >= target }));
}
