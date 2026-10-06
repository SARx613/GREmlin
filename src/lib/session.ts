import type {
  ExerciseType,
  LessonConfig,
  LessonState,
  QueueItem,
  SingleExercise,
  WordProgress,
  WordsData,
} from '../types';
import { makeExercise, makePairs, pickType, shuffle, type Rng } from './exercises';
import { NEW_PER_LESSON, applyResult, dueIds, getWP, newIds } from './srs';

export const MAX_WORDS = 8;
export const MAX_NEW = NEW_PER_LESSON;
export const MAX_SELECTION = 10;
const REINSERT_GAP = 3;

// --- Choix des mots -----------------------------------------------------------

/** Mots d'une leçon ; `applySrs` = false pour l'entraînement libre (pas de pénalité de boîte). */
export function pickWords(
  config: LessonConfig,
  data: WordsData,
  words: Record<string, WordProgress>,
  now: number,
  rng: Rng = Math.random,
): { ids: string[]; applySrs: boolean } {
  const chapterIds = data.chapters.find((c) => c.id === config.chapterId)?.wordIds ?? [];

  if (config.mode === 'selection') return { ids: (config.wordIds ?? []).slice(0, MAX_SELECTION), applySrs: true };

  if (config.mode === 'review') {
    const all = data.chapters.flatMap((c) => c.wordIds);
    return { ids: dueIds(all, words, now).slice(0, MAX_WORDS), applySrs: true };
  }

  if (config.mode === 'chapter') {
    const due = dueIds(chapterIds, words, now).slice(0, MAX_WORDS);
    const fresh = newIds(chapterIds, words).slice(0, Math.min(MAX_NEW, MAX_WORDS - due.length));
    const ids = [...due, ...fresh];
    if (ids.length) return { ids, applySrs: true };
  }

  // entraînement libre (ou chapitre sans rien de dû ni de nouveau)
  return { ids: shuffle(chapterIds, rng).slice(0, MAX_WORDS), applySrs: false };
}

// --- Construction de la file --------------------------------------------------

export function buildQueue(
  ids: string[],
  data: WordsData,
  words: Record<string, WordProgress>,
  rng: Rng = Math.random,
  listening = false,
): QueueItem[] {
  // 1 emplacement par exercice : mot nouveau = 2, mot dû = 1
  const slots = shuffle(
    ids.flatMap((id) => (getWP(words, id).box === 0 ? [id, id] : [id])),
    rng,
  );

  const used: Record<string, ExerciseType[]> = {};
  const items: QueueItem[] = [];
  let last: ExerciseType | undefined;
  for (const id of slots) {
    const type = pickType(getWP(words, id).box, last, used[id] ?? [], rng, listening);
    const exercise = makeExercise(data, id, type, rng);
    last = exercise.type;
    (used[id] ??= []).push(exercise.type);
    items.push({ kind: 'ex', exercise });
  }

  // chaque intro juste avant le premier exercice de son mot
  for (const id of ids) {
    if (getWP(words, id).box !== 0) continue;
    const at = items.findIndex((it) => it.kind === 'ex' && it.exercise.type !== 'pairs' && it.exercise.wordId === id);
    items.splice(at, 0, { kind: 'intro', wordId: id });
  }

  // paires : une fois par leçon, après les intros
  const pairs = ids.length >= 4 ? makePairs(data, ids, rng) : null;
  if (pairs) {
    const lastIntro = items.reduce((acc, it, i) => (it.kind === 'intro' ? i : acc), -1);
    items.splice(Math.max(lastIntro + 1, Math.round(items.length * 0.6)), 0, { kind: 'ex', exercise: pairs });
  }
  return items;
}

export function createLesson(ids: string[], queue: QueueItem[]): LessonState {
  return {
    queue,
    total: queue.filter((q) => q.kind === 'ex').length,
    done: 0,
    firstTry: 0,
    errors: {},
    wordIds: ids,
  };
}

// --- Boucle de leçon ----------------------------------------------------------

export const isFinished = (s: LessonState) => s.queue.length === 0;
export const progressRatio = (s: LessonState) => (s.total ? s.done / s.total : 1);
export const accuracy = (s: LessonState) => (s.total ? s.firstTry / s.total : 1);

export function advanceIntro(s: LessonState): LessonState {
  return { ...s, queue: s.queue.slice(1) };
}

/**
 * Résout l'exercice en tête de file.
 * Réponse fausse : l'exercice (`retry` si fourni, avec un autre type de préférence) revient 3 positions plus loin,
 * ou en fin de file s'il en reste moins de 3.
 */
export function resolveExercise(
  s: LessonState,
  correct: boolean,
  retry?: SingleExercise,
): LessonState {
  const head = s.queue[0];
  if (!head || head.kind !== 'ex' || head.exercise.kind === 'pairs') return s;
  const ex = head.exercise;
  const rest = s.queue.slice(1);

  if (correct) {
    return { ...s, queue: rest, done: s.done + 1, firstTry: s.firstTry + (ex.retry ? 0 : 1) };
  }
  const again: QueueItem = { kind: 'ex', exercise: retry ?? { ...ex, retry: true } };
  const at = Math.min(REINSERT_GAP, rest.length);
  return {
    ...s,
    queue: [...rest.slice(0, at), again, ...rest.slice(at)],
    errors: { ...s.errors, [ex.wordId]: (s.errors[ex.wordId] ?? 0) + 1 },
  };
}

/** Paires : les mots mal associés (un id par erreur) comptent une erreur chacun ; l'exercice n'est pas réinséré. */
export function resolvePairs(s: LessonState, wrongWordIds: string[]): LessonState {
  const head = s.queue[0];
  if (!head || head.kind !== 'ex' || head.exercise.kind !== 'pairs') return s;
  const errors = { ...s.errors };
  for (const id of wrongWordIds) errors[id] = (errors[id] ?? 0) + 1;
  return {
    ...s,
    queue: s.queue.slice(1),
    errors,
    done: s.done + 1,
    firstTry: s.firstTry + (wrongWordIds.length ? 0 : 1),
  };
}

// --- Fin de leçon ---------------------------------------------------------------

export type LessonResult = {
  words: Record<string, WordProgress>;
  ups: string[]; // mots qui ont monté de boîte
  rework: string[]; // mots avec au moins une erreur
  accuracy: number;
};

export function finishLesson(
  s: LessonState,
  words: Record<string, WordProgress>,
  now: number,
  applySrs: boolean,
): LessonResult {
  const next = { ...words };
  const ups: string[] = [];
  const rework: string[] = [];
  for (const id of s.wordIds) {
    const before = getWP(words, id);
    const errs = s.errors[id] ?? 0;
    if (errs) rework.push(id);
    if (applySrs) {
      const after = applyResult(before, errs > 0, now);
      if (after.box > before.box) ups.push(id);
      next[id] = { ...after, misses: before.misses + errs };
    } else {
      next[id] = { ...before, seen: before.seen + 1, misses: before.misses + errs };
    }
  }
  return { words: next, ups, rework, accuracy: accuracy(s) };
}
