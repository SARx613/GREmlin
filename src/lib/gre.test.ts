import { describe, expect, it } from 'vitest';
import { data } from './data';
import { related } from './exercises';
import { allWordIds, flashDeck, learnPile, sortCounts } from './flash';
import {
  COMPLETION_OPTIONS,
  EQUIVALENCE_OPTIONS,
  buildGreQueue,
  grePool,
  isGreCorrect,
  makeGreQuestion,
  newGreSession,
  resolveGre,
} from './gre';
import { lexiconOf, tokenize } from './lexicon';
import { pickWords } from './session';
import { DAY, markKnown, markUnknown } from './srs';
import type { WordProgress } from '../types';

const NOW = new Date(2026, 9, 6, 12).getTime();
const ids = allWordIds(data);
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe('tri express', () => {
  it('le paquet ne contient que les mots jamais triés, et tous une seule fois', () => {
    const words: Record<string, WordProgress> = {
      [ids[0]]: markKnown({ box: 0, dueAt: 0, seen: 0, misses: 0 }, NOW),
      [ids[1]]: markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 }),
      [ids[2]]: { box: 2, dueAt: NOW, seen: 3, misses: 0 },
    };
    const deck = flashDeck(data, words, 'sort', seeded(1));
    expect(deck).toHaveLength(ids.length - 3);
    expect(new Set(deck).size).toBe(deck.length);
    expect(deck).not.toContain(ids[0]);
    expect(deck).not.toContain(ids[1]);
    expect(deck).not.toContain(ids[2]);
  });

  it('compte connus, à apprendre et à trier ; la pile « à apprendre » exclut les mots maîtrisés', () => {
    const words: Record<string, WordProgress> = {
      [ids[0]]: markKnown({ box: 0, dueAt: 0, seen: 0, misses: 0 }, NOW),
      [ids[1]]: markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 }),
      [ids[2]]: { ...markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 }), box: 5 }, // trié puis appris
    };
    const c = sortCounts(data, words);
    expect(c).toMatchObject({ total: ids.length, known: 1, learn: 1, unsorted: ids.length - 3, check: 1 });
    expect(learnPile(data, words)).toEqual([ids[1]]);
  });

  it('le contrôle ne repropose que les « connus » jamais vérifiés', () => {
    const base = { box: 0, dueAt: 0, seen: 0, misses: 0 };
    const words: Record<string, WordProgress> = {
      [ids[0]]: markKnown(base, NOW),
      [ids[1]]: { ...markKnown(base, NOW), verified: true },
      [ids[2]]: { ...markKnown(base, NOW), seen: 2 },
    };
    expect(flashDeck(data, words, 'check')).toEqual([ids[0]]);
  });
});

describe('leçon « apprendre »', () => {
  it("prend d'abord les mots triés « à apprendre », tous chapitres confondus", () => {
    const words: Record<string, WordProgress> = {};
    const chosen = [ids[3], ids[400], ids[900]];
    for (const id of chosen) words[id] = markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 });
    words[ids[5]] = markKnown({ box: 0, dueAt: 0, seen: 0, misses: 0 }, NOW);
    const { ids: picked } = pickWords({ mode: 'learn' }, data, words, NOW);
    expect(picked).toEqual(chosen);
  });

  it('complète avec les mots dus, sans dépasser 10 mots', () => {
    const words: Record<string, WordProgress> = {};
    for (const id of ids.slice(0, 20)) words[id] = markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 });
    for (const id of ids.slice(100, 130)) words[id] = { box: 2, dueAt: NOW - DAY, seen: 2, misses: 0 };
    const { ids: picked } = pickWords({ mode: 'learn' }, data, words, NOW);
    expect(picked).toHaveLength(10);
    expect(picked.filter((id) => words[id].box === 0)).toHaveLength(8);
  });
});

describe('lexique', () => {
  it('reconnaît les formes fléchies des mots du vocabulaire', () => {
    const lex = lexiconOf(data);
    expect(lex.get('catholic')).toBe('catholic');
    const abate = data.words['abate'];
    if (abate) {
      expect(lex.get('abated')).toBe('abate');
      expect(lex.get('abating')).toBe('abate');
    }
  });

  it('souligne les mots du vocabulaire mais pas la réponse (skipId)', () => {
    const s = data.words['catholic'].sentences[0];
    const withAll = tokenize(s, data).filter((p) => p.wordId);
    expect(withAll.some((p) => p.wordId === 'catholic')).toBe(true);
    expect(tokenize(s, data, 'catholic').some((p) => p.wordId === 'catholic')).toBe(false);
    expect(tokenize(s, data).map((p) => p.text).join('')).toBe(s);
  });
});

describe('phrases GRE', () => {
  it('le pool met les mots « à apprendre » avant les autres et écarte les mots connus', () => {
    const words: Record<string, WordProgress> = {
      [ids[10]]: markUnknown({ box: 0, dueAt: 0, seen: 0, misses: 0 }),
      [ids[11]]: markKnown({ box: 0, dueAt: 0, seen: 0, misses: 0 }, NOW),
    };
    const pool = grePool(data, words, seeded(2));
    expect(pool[0]).toBe(ids[10]);
    expect(pool).not.toContain(ids[11]);
  });

  it('toutes les questions de tous les mots sont bien formées (trou, bonne réponse, options sans doublon, sans synonyme)', () => {
    const rng = seeded(7);
    let built = 0;
    for (const id of ids.filter((_, i) => i % 3 === 0)) {
      for (const format of ['completion', 'equivalence'] as const) {
        const q = makeGreQuestion(data, id, ids.slice(0, 300), rng, format);
        if (!q) continue;
        built++;
        const labels = q.options.map((o) => o.label.toLowerCase());
        expect(q.prompt).toContain('_____');
        expect(q.prompt).not.toBe(q.sentence);
        expect(new Set(labels).size).toBe(labels.length);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
        expect(q.answerIds.every((a) => q.options.some((o) => o.id === a))).toBe(true);
        if (q.format === 'completion') {
          expect(q.options).toHaveLength(COMPLETION_OPTIONS);
          expect(q.answerIds).toEqual([id]);
        } else {
          expect(q.options).toHaveLength(EQUIVALENCE_OPTIONS);
          expect(q.answerIds).toHaveLength(2);
        }
        // aucun distracteur n'est un synonyme du mot testé
        for (const o of q.options) {
          if (q.answerIds.includes(o.id) || !data.words[o.id]) continue;
          expect(related(data.words[id], data.words[o.id])).toBe(false);
          expect(data.words[id].synonyms.map((x) => x.toLowerCase())).not.toContain(o.label.toLowerCase());
        }
      }
    }
    expect(built).toBeGreaterThan(700);
  });

  it('une série compte 10 questions sur 10 mots différents', () => {
    const pool = grePool(data, {}, seeded(3));
    const queue = buildGreQueue(data, pool, 10, seeded(4));
    expect(queue).toHaveLength(10);
    expect(new Set(queue.map((q) => q.wordId)).size).toBe(10);
  });

  it('la correction exige exactement les bonnes réponses', () => {
    const q = makeGreQuestion(data, 'catholic', ids, seeded(5), 'equivalence')!;
    expect(isGreCorrect(q, q.answerIds)).toBe(true);
    expect(isGreCorrect(q, [q.answerIds[0]])).toBe(false);
    const wrong = q.options.find((o) => !q.answerIds.includes(o.id))!;
    expect(isGreCorrect(q, [q.answerIds[0], wrong.id])).toBe(false);
  });

  it("une erreur remet la question 3 rangs plus loin et note le mot ; le réessai ne compte pas « du premier coup »", () => {
    const pool = grePool(data, {}, seeded(6));
    const queue = buildGreQueue(data, pool, 6, seeded(8));
    let s = newGreSession(queue);
    const first = queue[0];
    s = resolveGre(s, false);
    expect(s.queue).toHaveLength(6);
    expect(s.queue[3].wordId).toBe(first.wordId);
    expect(s.queue[3].retry).toBe(true);
    expect(s.missed).toEqual([first.wordId]);
    // une 2e erreur sur le même mot ne le fait pas boucler
    const atRetry = { ...s, queue: s.queue.slice(3) }; // les 3 questions d'avant sont passées : le réessai est en tête
    expect(atRetry.queue[0].wordId).toBe(first.wordId);
    const after = resolveGre(atRetry, false);
    expect(after.queue).toHaveLength(atRetry.queue.length - 1);
    expect(after.missed).toEqual([first.wordId]);
    for (let i = 0; i < 20 && s.queue.length; i++) s = resolveGre(s, true);
    expect(s.queue).toHaveLength(0);
    expect(s.done).toBe(6);
    expect(s.firstTry).toBe(5);
  });
});
