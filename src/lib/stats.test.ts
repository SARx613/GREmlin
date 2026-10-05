import { describe, expect, it } from 'vitest';
import { lastDays, leechIds, lessonsSeries, lessonsToday, masteredSeries } from './stats';
import { DAY, dayKey, emptyProgress, recordDay } from './srs';

const NOW = new Date(2026, 9, 6, 12).getTime();

describe('statistiques', () => {
  it('lastDays : n jours, le plus ancien d\'abord, finit aujourd\'hui', () => {
    const d = lastDays(NOW, 3);
    expect(d).toHaveLength(3);
    expect(d[2]).toBe(dayKey(NOW));
    expect(d[0]).toBe(dayKey(NOW - 2 * DAY));
  });

  it('recordDay cumule les leçons du jour et garde le dernier nombre de mots maîtrisés', () => {
    let days = recordDay(undefined, NOW, 10);
    days = recordDay(days, NOW + 1000, 12);
    expect(days[dayKey(NOW)]).toEqual({ lessons: 2, mastered: 12 });
    expect(lessonsToday(days, NOW)).toBe(2);
  });

  it('masteredSeries : reprend la dernière valeur connue les jours sans leçon, aujourd\'hui = valeur actuelle', () => {
    const days = {
      [dayKey(NOW - 10 * DAY)]: { lessons: 1, mastered: 5 },
      [dayKey(NOW - 2 * DAY)]: { lessons: 1, mastered: 9 },
    };
    const s = masteredSeries(days, NOW, 5, 14);
    expect(s).toEqual([5, 5, 9, 9, 14]); // 4 jours avant : valeur d'avant la fenêtre (5)
  });

  it('lessonsSeries : 0 les jours sans leçon', () => {
    const days = recordDay(undefined, NOW - DAY, 1);
    expect(lessonsSeries(days, NOW, 3)).toEqual([0, 1, 0]);
  });

  it('leechIds : tri par proportion d\'erreurs, ignore les mots peu vus', () => {
    const w = (seen: number, misses: number) => ({ ...emptyProgress(), box: 1, seen, misses });
    const words = { a: w(4, 4), b: w(5, 10), c: w(2, 9), d: w(20, 2) };
    expect(leechIds(['a', 'b', 'c', 'd'], words)).toEqual(['b', 'a']);
  });
});
