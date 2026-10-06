import { describe, expect, it } from 'vitest';
import {
  DAY,
  applyResult,
  chapterProgress,
  difficultyFactor,
  isLeech,
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

describe('difficulté personnelle', () => {
  const seen = (seenN: number, misses: number) => ({ ...emptyProgress(), box: 2, seen: seenN, misses });

  it('neutre tant que le mot a été vu moins de 3 fois', () => {
    expect(difficultyFactor(seen(2, 2))).toBe(1);
  });

  it('un mot souvent raté revient plus tôt, un mot toujours réussi plus tard (bornes 0,6 – 1,25)', () => {
    expect(difficultyFactor(seen(10, 0))).toBe(1.25);
    expect(difficultyFactor(seen(10, 5))).toBe(1);
    expect(difficultyFactor(seen(10, 30))).toBe(0.6);
  });

  it('s\'applique à la date de retour', () => {
    expect(applyResult(seen(10, 30), false, NOW).dueAt).toBe(NOW + Math.round(4 * DAY * 0.6)); // boîte 3
    expect(applyResult(seen(10, 0), false, NOW).dueAt).toBe(NOW + 4 * DAY * 1.25);
  });

  it('détecte les mots difficiles', () => {
    expect(isLeech(seen(4, 4))).toBe(true);
    expect(isLeech(seen(3, 5))).toBe(false);
    expect(isLeech(seen(10, 2))).toBe(false);
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

describe('avancement d\'un chapitre', () => {
  const ids = Array.from({ length: 23 }, (_, i) => `w${i}`);
  const learned = (n: number, box = 1) => Object.fromEntries(ids.slice(0, n).map((id) => [id, wp(box)]));

  it('chapitre neuf : 0 leçon sur ceil(23/4) = 6, 0 %', () => {
    expect(chapterProgress(ids, {})).toMatchObject({ discovered: 0, lessonsTotal: 6, lessonsDone: 0, percent: 0, mastered: 0 });
  });

  it('après une leçon de 4 mots nouveaux : 1 leçon sur 6, 17 % (et plus 0 %)', () => {
    expect(chapterProgress(ids, learned(4))).toMatchObject({ discovered: 4, lessonsDone: 1, lessonsTotal: 6, percent: 17, mastered: 0 });
  });

  it('une leçon ne compte que quand elle est complète : 5 mots = 1 leçon, 8 mots = 2 leçons', () => {
    expect(chapterProgress(ids, learned(5)).lessonsDone).toBe(1);
    expect(chapterProgress(ids, learned(8)).lessonsDone).toBe(2);
  });

  it('tous découverts : 6 leçons sur 6, 100 % ; les mots triés « je connais » (boîte 4) comptent comme découverts et maîtrisés', () => {
    expect(chapterProgress(ids, learned(23))).toMatchObject({ lessonsDone: 6, lessonsTotal: 6, percent: 100 });
    expect(chapterProgress(ids, learned(8, 4))).toMatchObject({ discovered: 8, mastered: 8, lessonsDone: 2 });
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
