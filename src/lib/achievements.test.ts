import { describe, expect, it } from 'vitest';
import { achievements } from './achievements';
import { emptyState } from './storage';

const ids = Array.from({ length: 511 }, (_, i) => `w${i}`);
const unlocked = (p = emptyState()) => achievements(p, ids).filter((a) => a.unlocked).map((a) => a.label);

describe('succès', () => {
  it('rien de débloqué au départ, avec une progression à 0', () => {
    expect(unlocked()).toEqual([]);
    expect(achievements(emptyState(), ids).every((a) => a.value === 0)).toBe(true);
  });

  it('leçons : cumul de toutes les journées', () => {
    const p = { ...emptyState(), days: { '2026-10-05': { lessons: 6, mastered: 0 }, '2026-10-06': { lessons: 5, mastered: 0 } } };
    expect(unlocked(p)).toEqual(['Première leçon', '10 leçons']);
  });

  it('série : le record compte, pas seulement la série en cours', () => {
    const p = { ...emptyState(), streak: { count: 1, lastDay: '2026-10-06', best: 9 } };
    expect(unlocked(p)).toEqual(['3 jours de suite', '7 jours de suite']);
  });

  it('maîtrise : mots en boîte 4 ou plus', () => {
    const words = Object.fromEntries(ids.slice(0, 100).map((id) => [id, { box: 4, dueAt: 0, seen: 1, misses: 0 }]));
    expect(unlocked({ ...emptyState(), words })).toEqual(['25 mots maîtrisés', '100 mots maîtrisés']);
  });

  it('Blitz : meilleur score, valeur plafonnée à l\'objectif', () => {
    const p = { ...emptyState(), blitz: { best: 99, plays: 4 } };
    expect(unlocked(p)).toEqual(['Blitz : 15 points', 'Blitz : 30 points', 'Blitz : 50 points']);
    expect(achievements(p, ids).find((a) => a.label === 'Blitz : 15 points')!.value).toBe(15);
  });
});
