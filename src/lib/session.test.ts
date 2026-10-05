import { describe, expect, it } from 'vitest';
import type { ChoiceExercise, LessonState, MultiExercise, QueueItem, WordsData } from '../types';
import { MULTI_SEP, alternativeFor, grade, gradeTyped, makeExercise, typesForBox } from './exercises';
import { findForm } from './match';
import {
  MAX_NEW,
  MAX_WORDS,
  accuracy,
  advanceIntro,
  buildQueue,
  finishLesson,
  isFinished,
  pickWords,
  progressRatio,
  resolveExercise,
  resolvePairs,
  createLesson,
} from './session';
import { DAY, emptyProgress } from './srs';

const NOW = new Date(2026, 9, 6, 12).getTime();

/** 2 chapitres de 10 mots avec des définitions et des phrases distinctes. */
function fixture(): WordsData {
  const words: WordsData['words'] = {};
  const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'nova', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango'];
  const mk = (i: number) => {
    const id = names[i];
    words[id] = {
      id,
      word: id,
      pos: i % 2 ? 'v.' : 'adj.',
      definition: `definition number ${i}`,
      definitionFr: `définition ${i}`,
      sentences: [`First, the ${id} thing happened in a very strange way today.`, `Then ${id}s followed.`],
      synonyms: [`syn${i}a`, `syn${i}b`],
    };
    return id;
  };
  const ids = Array.from({ length: 20 }, (_, i) => mk(i));
  return {
    chapters: [
      { id: 'c1', title: 'C1', group: 'G', wordIds: ids.slice(0, 10) },
      { id: 'c2', title: 'C2', group: 'G', wordIds: ids.slice(10) },
    ],
    words,
  };
}

const data = fixture();
const c1 = data.chapters[0].wordIds;

const exItem = (wordId: string, type: ChoiceExercise['type'] = 'wordToDef'): QueueItem => ({
  kind: 'ex',
  exercise: makeExercise(data, wordId, type),
});

const lesson = (queue: QueueItem[]): LessonState => createLesson(c1.slice(0, 4), queue);

describe('boucle de leçon', () => {
  it('une erreur réinsère l\'exercice 3 positions plus loin (autre type)', () => {
    const queue = ['a', 'b', 'c', 'd', 'e'].map((_, i) => exItem(c1[i]));
    let s = lesson(queue);
    const failed = (s.queue[0] as { exercise: ChoiceExercise }).exercise;
    const alt = alternativeFor(data, failed, 0);
    s = resolveExercise(s, false, alt);

    expect(s.queue).toHaveLength(5); // rien de perdu
    const at = s.queue.findIndex((q) => q.kind === 'ex' && q.exercise.kind === 'choice' && q.exercise.retry);
    expect(at).toBe(3);
    expect(alt.type).not.toBe(failed.type);
    expect(s.errors[c1[0]]).toBe(1);
    expect(s.done).toBe(0);
  });

  it('s\'il reste moins de 3 exercices, l\'erreur passe en fin de file', () => {
    let s = lesson([exItem(c1[0]), exItem(c1[1]), exItem(c1[2])]);
    s = resolveExercise(s, false);
    expect(s.queue).toHaveLength(3);
    const last = s.queue[2];
    expect(last.kind === 'ex' && last.exercise.kind === 'choice' && last.exercise.retry).toBe(true);
  });

  it('la leçon se termine quand la file est vide : le mot raté doit être réussi', () => {
    let s = lesson([exItem(c1[0]), exItem(c1[1])]);
    s = resolveExercise(s, false); // raté → revient
    s = resolveExercise(s, true);
    expect(isFinished(s)).toBe(false);
    s = resolveExercise(s, true);
    s = resolveExercise(s, true);
    expect(isFinished(s)).toBe(true);
    expect(s.done).toBe(2);
  });

  it('la barre de progression ne recule jamais', () => {
    let s = lesson([exItem(c1[0]), exItem(c1[1]), exItem(c1[2])]);
    const seen: number[] = [];
    for (const ok of [true, false, true, true, false, true, true]) {
      if (isFinished(s)) break;
      s = resolveExercise(s, ok);
      seen.push(progressRatio(s));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(progressRatio(s)).toBe(1);
  });

  it('précision = réussites du premier coup / total initial', () => {
    let s = lesson([exItem(c1[0]), exItem(c1[1]), exItem(c1[2]), exItem(c1[3])]);
    s = resolveExercise(s, true);
    s = resolveExercise(s, false); // raté
    s = resolveExercise(s, true);
    s = resolveExercise(s, true);
    s = resolveExercise(s, true); // l'exercice réinséré
    expect(isFinished(s)).toBe(true);
    expect(accuracy(s)).toBeCloseTo(3 / 4);
  });

  it('une intro ne compte pas dans le total et se passe sans erreur', () => {
    const s0 = lesson([{ kind: 'intro', wordId: c1[0] }, exItem(c1[0])]);
    expect(s0.total).toBe(1);
    expect(advanceIntro(s0).queue).toHaveLength(1);
  });

  it('paires : erreurs comptées par mot, jamais réinséré', () => {
    const pairs = buildQueue(c1.slice(0, 5), data, {}, () => 0.5).find((q) => q.kind === 'ex' && q.exercise.kind === 'pairs')!;
    let s = lesson([pairs]);
    s = resolvePairs(s, [c1[0], c1[1]]);
    expect(isFinished(s)).toBe(true);
    expect(s.errors).toEqual({ [c1[0]]: 1, [c1[1]]: 1 });
    expect(s.firstTry).toBe(0);
  });
});

describe('fin de leçon', () => {
  const s: LessonState = { ...lesson([]), wordIds: [c1[0], c1[1], c1[2]], errors: { [c1[1]]: 2, [c1[2]]: 1 } };
  const words = {
    [c1[0]]: { ...emptyProgress(), box: 2, dueAt: NOW - DAY },
    [c1[1]]: { ...emptyProgress(), box: 4, dueAt: NOW - DAY },
    [c1[2]]: { ...emptyProgress(), box: 0 },
  };

  it('met à jour les boîtes et replanifie', () => {
    const r = finishLesson(s, words, NOW, true);
    expect(r.words[c1[0]]).toMatchObject({ box: 3, dueAt: NOW + 4 * DAY, seen: 1 });
    expect(r.words[c1[1]]).toMatchObject({ box: 1, misses: 2, dueAt: NOW + DAY });
    expect(r.words[c1[2]]).toMatchObject({ box: 1, misses: 1 });
    expect(r.ups).toEqual([c1[0], c1[2]]); // 2→3 et 0→1
    expect(r.rework).toEqual([c1[1], c1[2]]);
  });

  it('entraînement libre : aucune pénalité de boîte', () => {
    const r = finishLesson(s, words, NOW, false);
    expect(r.words[c1[1]].box).toBe(4);
    expect(r.words[c1[1]].seen).toBe(1);
  });
});

describe('choix des mots et file', () => {
  it('chapitre : mots dus d\'abord, puis ≤ 4 nouveaux, ≤ 8 au total', () => {
    const due = Object.fromEntries(c1.slice(0, 3).map((id) => [id, { ...emptyProgress(), box: 2, dueAt: NOW - DAY }]));
    const { ids, applySrs } = pickWords({ mode: 'chapter', chapterId: 'c1' }, data, due, NOW);
    expect(ids.slice(0, 3)).toEqual(c1.slice(0, 3));
    expect(ids.length).toBe(3 + MAX_NEW);
    expect(applySrs).toBe(true);
    expect(pickWords({ mode: 'chapter', chapterId: 'c1' }, data, {}, NOW).ids.length).toBe(MAX_NEW);
  });

  it('chapitre sans rien de dû ni de nouveau : entraînement libre', () => {
    const all = Object.fromEntries(c1.map((id) => [id, { ...emptyProgress(), box: 5, dueAt: NOW + 5 * DAY }]));
    const r = pickWords({ mode: 'chapter', chapterId: 'c1' }, data, all, NOW);
    expect(r.applySrs).toBe(false);
    expect(r.ids.length).toBe(MAX_WORDS);
  });

  it('révision : mots dus de tous les chapitres, les plus en retard d\'abord, sans nouveaux', () => {
    const words = {
      [data.chapters[1].wordIds[0]]: { ...emptyProgress(), box: 2, dueAt: NOW - 5 * DAY },
      [c1[0]]: { ...emptyProgress(), box: 2, dueAt: NOW - DAY },
    };
    expect(pickWords({ mode: 'review' }, data, words, NOW).ids).toEqual([data.chapters[1].wordIds[0], c1[0]]);
  });

  it('chaque intro précède les exercices de son mot ; 2 exercices par mot nouveau', () => {
    const ids = c1.slice(0, 4);
    const q = buildQueue(ids, data, {}, Math.random);
    for (const id of ids) {
      const intro = q.findIndex((x) => x.kind === 'intro' && x.wordId === id);
      const firstEx = q.findIndex((x) => x.kind === 'ex' && x.exercise.kind !== 'pairs' && x.exercise.wordId === id);
      expect(intro).toBeGreaterThanOrEqual(0);
      expect(intro).toBeLessThan(firstEx);
      expect(q.filter((x) => x.kind === 'ex' && x.exercise.kind !== 'pairs' && x.exercise.wordId === id)).toHaveLength(2);
    }
    expect(q.filter((x) => x.kind === 'ex' && x.exercise.kind === 'pairs')).toHaveLength(1);
  });

  it('les 2 exercices d\'un même mot nouveau sont de types différents', () => {
    for (let n = 0; n < 20; n++) {
      const q = buildQueue(c1.slice(0, 4), data, {}, Math.random);
      for (const id of c1.slice(0, 4)) {
        const types = q.flatMap((x) => (x.kind === 'ex' && x.exercise.kind !== 'pairs' && x.exercise.wordId === id ? [x.exercise.type] : []));
        expect(new Set(types).size).toBe(2);
      }
    }
  });
});

describe('exercices', () => {
  it('QCM : 4 options distinctes, bonne réponse présente une seule fois', () => {
    for (const id of data.chapters[0].wordIds) {
      for (const type of typesForBox(3, true).concat('wordToDef') as ChoiceExercise['type'][]) {
        if ((type as string) === 'typeWord' || (type as string) === 'equivalence') continue; // formats à part
        const ex = makeExercise(data, id, type) as ChoiceExercise;
        expect(ex.options).toHaveLength(4);
        expect(new Set(ex.options.map((o) => o.label.toLowerCase())).size).toBe(4);
        expect(ex.options.filter((o) => o.id === ex.answerId)).toHaveLength(1);
      }
    }
  });

  it('synonyme : aucun distracteur n\'est un synonyme du mot', () => {
    for (let n = 0; n < 30; n++) {
      const w = data.words[c1[n % 10]];
      const ex = makeExercise(data, w.id, 'synonym') as ChoiceExercise;
      const wrong = ex.options.filter((o) => o.id !== ex.answerId).map((o) => o.label);
      expect(wrong.some((l) => w.synonyms.includes(l))).toBe(false);
    }
  });

  it('phrase à trous : le mot (même fléchi) est remplacé par un blanc', () => {
    const ex = makeExercise(data, c1[0], 'fillBlank') as ChoiceExercise;
    expect(ex.prompt).toContain('_____');
    expect(ex.prompt.toLowerCase()).not.toContain(c1[0]);
    expect(findForm('The senator advocated reform.', 'advocate')).toBe('advocated');
  });

  it('Sentence Equivalence : 6 options distinctes, 2 réponses (le mot + un synonyme), aucun distracteur synonyme', () => {
    for (let n = 0; n < 20; n++) {
      const w = data.words[c1[n % 10]];
      const ex = makeExercise(data, w.id, 'equivalence') as MultiExercise;
      expect(ex.kind).toBe('multi');
      expect(ex.options).toHaveLength(6);
      expect(new Set(ex.options.map((o) => o.label.toLowerCase())).size).toBe(6);
      expect(ex.answerIds).toHaveLength(2);
      expect(ex.answerIds).toContain(w.id);
      const wrong = ex.options.filter((o) => !ex.answerIds.includes(o.id)).map((o) => o.label);
      expect(wrong.some((l) => w.synonyms.includes(l))).toBe(false);
      expect(ex.prompt).toContain('_____');
    }
  });

  it('Sentence Equivalence : correct seulement si les deux bonnes réponses sont cochées', () => {
    const ex = makeExercise(data, c1[0], 'equivalence') as MultiExercise;
    const [a, b] = ex.answerIds;
    const wrong = ex.options.find((o) => !ex.answerIds.includes(o.id))!.id;
    expect(grade(ex, data, [b, a].join(MULTI_SEP))).toBe('correct');
    expect(grade(ex, data, [a, wrong].join(MULTI_SEP))).toBe('wrong');
    expect(grade(ex, data, a)).toBe('wrong');
  });

  it('écoute : seulement quand le son est disponible, jamais pour un mot tout neuf', () => {
    expect(typesForBox(3, false)).not.toContain('listen');
    expect(typesForBox(3, true)).toContain('listen');
    expect(typesForBox(0, true)).not.toContain('listen');
    const ex = makeExercise(data, c1[0], 'listen') as ChoiceExercise;
    expect(ex.type).toBe('listen');
    expect(ex.options).toHaveLength(4);
  });

  it('écrire le mot : faute de frappe tolérée (« Presque ! »)', () => {
    expect(gradeTyped('abate', ' Abate ')).toBe('correct');
    expect(gradeTyped('abate', 'abbate')).toBe('almost');
    expect(gradeTyped('abate', 'abbbate')).toBe('wrong');
    expect(gradeTyped('din', 'dim')).toBe('wrong');
  });
});
