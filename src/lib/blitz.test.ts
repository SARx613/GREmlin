import { describe, expect, it } from 'vitest';
import { data } from './data';
import { COMBO_STEP, answerBlitz, blitzPool, newBlitz, nextBlitzQuestion } from './blitz';

describe('blitz : score', () => {
  it('+1 par bonne réponse, double à partir du combo de 5', () => {
    let s = newBlitz();
    for (let i = 0; i < COMBO_STEP - 1; i++) s = answerBlitz(s, true, 'a');
    expect(s.score).toBe(COMBO_STEP - 1);
    s = answerBlitz(s, true, 'a'); // 5e d'affilée
    expect(s.score).toBe(COMBO_STEP - 1 + 2);
  });

  it('une erreur remet le combo à zéro et garde le mot à revoir (sans doublon)', () => {
    let s = newBlitz();
    for (let i = 0; i < 6; i++) s = answerBlitz(s, true, 'a');
    s = answerBlitz(s, false, 'abate');
    s = answerBlitz(s, false, 'abate');
    expect(s).toMatchObject({ combo: 0, wrong: 2, missed: ['abate'] });
    expect(answerBlitz(s, true, 'b').score - s.score).toBe(1); // le combo repart de zéro
  });
});

describe('blitz : questions', () => {
  const all = data.chapters.flatMap((c) => c.wordIds);

  it('mots travaillés s\'il y en a assez, sinon tout le vocabulaire', () => {
    expect(blitzPool(data, {})).toHaveLength(511);
    const seen = Object.fromEntries(all.slice(0, 15).map((id) => [id, { box: 2, dueAt: 0, seen: 1, misses: 0 }]));
    expect(blitzPool(data, seen)).toEqual(all.slice(0, 15));
  });

  it('QCM à 4 choix, une seule bonne réponse, jamais le même mot deux fois de suite', () => {
    let previous: string | null = null;
    for (let i = 0; i < 60; i++) {
      const q = nextBlitzQuestion(data, all.slice(0, 30), previous);
      expect(['wordToDef', 'defToWord', 'synonym']).toContain(q.type);
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.id === q.answerId)).toHaveLength(1);
      expect(q.wordId).not.toBe(previous);
      previous = q.wordId;
    }
  });
});
