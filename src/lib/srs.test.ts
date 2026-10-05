import { describe, expect, it } from 'vitest';
import {
  DAY,
  applyResult,
  currentStreak,
  dueIds,
  emptyProgress,
  intervalMs,
  markKnown,
  markUnknown,
  newIds,
  recordLesson,
} from './srs';

const NOW = new Date(2026, 9, 6, 12).getTime();
const wp = (box: number, dueAt = 0) => ({ ...emptyProgress(), box, dueAt });

describe('applyResult', () => {
  it('monte d\'une boîte sans erreur (max 6)', () => {
    expect(applyResult(wp(0), false, NOW).box).toBe(1);
    expect(applyResult(wp(3), false, NOW).box).toBe(4);
    expect(applyResult(wp(6), false, NOW).box).toBe(6);
  });

  it('avec erreur : retombe en boîte 1 si ≥ 3, sinon descend d\'un cran (min 1)', () => {
    expect(applyResult(wp(5), true, NOW).box).toBe(1);
    expect(applyResult(wp(3), true, NOW).box).toBe(1);
    expect(applyResult(wp(2), true, NOW).box).toBe(1);
    expect(applyResult(wp(1), true, NOW).box).toBe(1);
    expect(applyResult(wp(0), true, NOW).box).toBe(1);
  });

  it('replanifie selon l\'intervalle de la nouvelle boîte et compte la rencontre', () => {
    const r = applyResult(wp(2), false, NOW); // → boîte 3 = 4 jours
    expect(r.dueAt).toBe(NOW + 4 * DAY);
    expect(r.seen).toBe(1);
  });

  it('intervalles : 1, 2, 4, 8, 16, 35 jours', () => {
    expect([1, 2, 3, 4, 5, 6].map((b) => intervalMs(b) / DAY)).toEqual([1, 2, 4, 8, 16, 35]);
  });
});

describe('mots dus / nouveaux', () => {
  const words = {
    a: wp(2, NOW - 3 * DAY),
    b: wp(2, NOW - 1 * DAY),
    c: wp(3, NOW + DAY),
    d: wp(0),
    e: { ...wp(0), known: false },
  };

  it('ne retient que les mots vus et échus, les plus en retard d\'abord', () => {
    expect(dueIds(['a', 'b', 'c', 'd', 'e', 'zzz'], words, NOW)).toEqual(['a', 'b']);
  });

  it('un mot nouveau (boîte 0) n\'est jamais « dû »', () => {
    expect(dueIds(['d'], words, NOW)).toEqual([]);
  });

  it('mots nouveaux : « je ne connais pas » en premier', () => {
    expect(newIds(['d', 'e', 'a'], words)).toEqual(['e', 'd']);
  });
});

describe('tri initial', () => {
  it('« je connais » → boîte 4, dû dans 8 jours', () => {
    const k = markKnown(emptyProgress(), NOW);
    expect(k).toMatchObject({ box: 4, known: true, dueAt: NOW + 8 * DAY });
  });
  it('« je ne connais pas » → reste en boîte 0, prioritaire', () => {
    expect(markUnknown(wp(0))).toMatchObject({ box: 0, known: false, dueAt: 0 });
  });
});

describe('série de jours', () => {
  it('démarre à 1, ne bouge pas le même jour, +1 le lendemain', () => {
    let s = recordLesson({ count: 0, lastDay: null }, NOW);
    expect(s.count).toBe(1);
    s = recordLesson(s, NOW + 3600_000);
    expect(s.count).toBe(1);
    s = recordLesson(s, NOW + DAY);
    expect(s.count).toBe(2);
  });

  it('retombe à 0 (affichage) puis repart à 1 après un jour complet sauté', () => {
    const s = recordLesson({ count: 0, lastDay: null }, NOW);
    expect(currentStreak(s, NOW + DAY)).toBe(1);
    expect(currentStreak(s, NOW + 2 * DAY)).toBe(0);
    expect(recordLesson(s, NOW + 3 * DAY).count).toBe(1);
  });
});
