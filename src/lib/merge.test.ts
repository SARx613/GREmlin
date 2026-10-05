import { describe, expect, it } from 'vitest';
import type { Progress } from '../types';
import { mergeProgress } from './merge';

const p = (words: Progress['words'], lastDay: string | null = null, count = 0): Progress => ({ words, streak: { count, lastDay }, sound: true });
const w = (box: number, seen: number, extra = {}) => ({ box, dueAt: 0, seen, misses: 0, ...extra });

describe('mergeProgress', () => {
  it('garde l\'union des mots des deux côtés', () => {
    const m = mergeProgress(p({ a: w(1, 1) }), p({ b: w(2, 2) }));
    expect(Object.keys(m.words).sort()).toEqual(['a', 'b']);
  });

  it('pour un même mot, garde la version la plus travaillée', () => {
    expect(mergeProgress(p({ a: w(1, 5) }), p({ a: w(4, 2) })).words.a.seen).toBe(5);
    expect(mergeProgress(p({ a: w(1, 2) }), p({ a: w(4, 7) })).words.a.box).toBe(4);
  });

  it('à égalité de rencontres : boîte la plus haute (ex. mot trié « je connais »)', () => {
    expect(mergeProgress(p({ a: w(0, 0) }), p({ a: w(4, 0, { known: true }) })).words.a.known).toBe(true);
  });

  it('série : le jour le plus récent gagne', () => {
    expect(mergeProgress(p({}, '2026-10-05', 3), p({}, '2026-10-06', 1)).streak).toEqual({ count: 1, lastDay: '2026-10-06' });
    expect(mergeProgress(p({}, null, 0), p({}, '2026-10-06', 2)).streak.count).toBe(2);
  });

  it('est idempotente', () => {
    const a = p({ a: w(2, 3) }, '2026-10-06', 2);
    const b = p({ a: w(1, 1), b: w(3, 4) }, '2026-10-05', 1);
    const m = mergeProgress(a, b);
    expect(mergeProgress(m, b)).toEqual(m);
    expect(mergeProgress(m, a)).toEqual(m);
  });
});
