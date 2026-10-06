import { describe, expect, it } from 'vitest';
import { data } from './data';
import { toggleStar, wordOfTheDay } from './daily';
import { DAY } from './srs';

const NOW = new Date(2026, 9, 6, 8).getTime();

describe('mot du jour', () => {
  it('est stable dans la journée et existe dans les données', () => {
    const a = wordOfTheDay(data, NOW);
    expect(wordOfTheDay(data, NOW + 10 * 3600 * 1000)).toBe(a);
    expect(data.words[a]).toBeDefined();
  });

  it('change d\'un jour à l\'autre et parcourt des mots variés', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => wordOfTheDay(data, NOW + i * DAY)));
    expect(seen.size).toBeGreaterThan(24);
  });
});

describe('favoris', () => {
  it('ajoute puis retire sans doublon', () => {
    let s = toggleStar(undefined, 'abate');
    s = toggleStar(s, 'wane');
    expect(s).toEqual(['abate', 'wane']);
    expect(toggleStar(s, 'abate')).toEqual(['wane']);
  });
});
