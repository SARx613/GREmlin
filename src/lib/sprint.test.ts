import { describe, expect, it } from 'vitest';
import {
  answerSprint,
  isSprintAnswerCorrect,
  newSprint,
  normalizeAnswer,
} from './sprint';

describe('sprint logic', () => {
  it('normalise la saisie correctement', () => {
    expect(normalizeAnswer('  Abate ')).toBe('abate');
    expect(normalizeAnswer("s’abstenir")).toBe("s'abstenir");
  });

  it('valide réponse exacte et tolère 1 faute de frappe', () => {
    expect(isSprintAnswerCorrect('abate', 'abate')).toEqual({ ok: true, typo: false });
    expect(isSprintAnswerCorrect('ABATE', 'abate')).toEqual({ ok: true, typo: false });
    // Faute d'1 lettre sur mot >= 4 lettres
    expect(isSprintAnswerCorrect('abtte', 'abate')).toEqual({ ok: true, typo: true });
    // Trop de fautes
    expect(isSprintAnswerCorrect('abzzz', 'abate')).toEqual({ ok: false });
    // Mot vide
    expect(isSprintAnswerCorrect('', 'abate')).toEqual({ ok: false });
  });

  it('gère le score et le combo de bonnes réponses', () => {
    let s = newSprint();
    expect(s.score).toBe(0);

    // 4 bonnes réponses normales : +1 chacune
    for (let i = 0; i < 4; i++) {
      s = answerSprint(s, true, `word-${i}`);
    }
    expect(s.score).toBe(4);
    expect(s.combo).toBe(4);

    // 5ème bonne réponse : combo >= 5 -> +2 points
    s = answerSprint(s, true, 'word-4');
    expect(s.score).toBe(6);
    expect(s.combo).toBe(5);

    // Erreur ou mot passé : combo retombe à 0, mot ajouté aux manqués
    s = answerSprint(s, false, 'word-miss');
    expect(s.combo).toBe(0);
    expect(s.score).toBe(6);
    expect(s.missed).toContain('word-miss');
  });
});
