import type {
  Chapter,
  Choice,
  ChoiceExercise,
  ChoiceType,
  ExerciseType,
  MultiExercise,
  PairsExercise,
  SingleExercise,
  TypeExercise,
  Word,
  WordsData,
} from '../types';
import { blankOut, levenshtein } from './match';

export type Rng = () => number;
type SingleType = Exclude<ExerciseType, 'pairs'>;

/** Boîtes (min, max) dans lesquelles chaque type d'exercice est autorisé. */
const BOX_RANGE: Record<SingleType, [number, number]> = {
  wordToDef: [0, 2],
  defToWord: [0, 3],
  fillBlank: [2, 6],
  synonym: [2, 6],
  listen: [2, 6],
  equivalence: [3, 6],
  typeWord: [3, 6],
};

/** `listening` = false si le son est coupé ou indisponible : pas d'exercice d'écoute. */
export const typesForBox = (box: number, listening = false): SingleType[] =>
  (Object.keys(BOX_RANGE) as SingleType[]).filter(
    (t) => box >= BOX_RANGE[t][0] && box <= BOX_RANGE[t][1] && (listening || t !== 'listen'),
  );

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

// --- Index chapitre / position (pour choisir de bons distracteurs) -----------

type Index = { chapterOf: Record<string, Chapter>; pos: Record<string, number> };
const cache = new WeakMap<WordsData, Index>();

function indexOf(data: WordsData): Index {
  let idx = cache.get(data);
  if (!idx) {
    idx = { chapterOf: {}, pos: {} };
    for (const ch of data.chapters) ch.wordIds.forEach((id, i) => ((idx!.chapterOf[id] = ch), (idx!.pos[id] = i)));
    cache.set(data, idx);
  }
  return idx;
}

const lower = (s: string) => s.toLowerCase();

/** Vrai si a et b sont synonymes (dans un sens ou dans l'autre) ou partagent un synonyme. */
function related(a: Word, b: Word): boolean {
  const as = a.synonyms.map(lower);
  const bs = b.synonyms.map(lower);
  return as.includes(lower(b.word)) || bs.includes(lower(a.word)) || as.some((s) => bs.includes(s));
}

/**
 * Distracteurs : même chapitre d'abord, même nature si possible, jamais un synonyme de la bonne réponse.
 * Les voisins immédiats dans le chapitre (souvent de la même famille de sens) passent en dernier recours.
 */
function distractors(data: WordsData, word: Word, n: number, labelOf: (w: Word) => string, avoid: string[], rng: Rng): Word[] {
  const idx = indexOf(data);
  const ch = idx.chapterOf[word.id];
  const myPos = idx.pos[word.id];
  const near = (id: string) => ch.wordIds.includes(id) && Math.abs(idx.pos[id] - myPos) <= 6;

  const all = Object.values(data.words).filter((w) => w.id !== word.id && !related(word, w));
  const inCh = (w: Word) => idx.chapterOf[w.id] === ch;
  const samePos = (w: Word) => w.pos === word.pos;
  const tiers: ((w: Word) => boolean)[] = [
    (w) => inCh(w) && !near(w.id) && samePos(w),
    (w) => inCh(w) && !near(w.id),
    (w) => !inCh(w) && samePos(w),
    (w) => !inCh(w),
    (w) => inCh(w),
  ];

  const chosen: Word[] = [];
  const labels = new Set([...avoid.map(lower), lower(labelOf(word))]);
  for (const tier of tiers) {
    for (const w of shuffle(all.filter(tier), rng)) {
      if (chosen.length >= n) return chosen;
      const l = lower(labelOf(w));
      if (labels.has(l) || chosen.includes(w)) continue;
      labels.add(l);
      chosen.push(w);
    }
  }
  return chosen;
}

// --- Génération ---------------------------------------------------------------

function choice(
  data: WordsData,
  word: Word,
  type: ChoiceType,
  rng: Rng,
): ChoiceExercise | null {
  const defLabel = (w: Word) => w.definition;
  const wordLabel = (w: Word) => w.word;
  let prompt: string;
  let sentence: string | undefined;
  let labelOf: (w: Word) => string;
  let answer: Choice;
  const avoid: string[] = [];

  if (type === 'wordToDef' || type === 'listen') {
    prompt = word.word;
    labelOf = defLabel;
    answer = { id: word.id, label: word.definition };
  } else if (type === 'defToWord') {
    prompt = word.definition;
    labelOf = wordLabel;
    answer = { id: word.id, label: word.word };
  } else if (type === 'fillBlank') {
    const usable = word.sentences.filter((s) => blankOut(s, word.word));
    if (!usable.length) return null;
    sentence = pick(usable, rng);
    prompt = blankOut(sentence, word.word)!;
    labelOf = wordLabel;
    answer = { id: word.id, label: word.word };
  } else {
    if (!word.synonyms.length) return null;
    const syn = pick(word.synonyms, rng);
    prompt = word.word;
    labelOf = wordLabel;
    answer = { id: `syn:${syn}`, label: syn };
    avoid.push(...word.synonyms);
  }

  const others = distractors(data, word, 3, labelOf, avoid, rng);
  if (others.length < 3) return null;
  const options = shuffle([answer, ...others.map((w) => ({ id: w.id, label: labelOf(w) }))], rng);
  return { kind: 'choice', type, wordId: word.id, prompt, sentence, options, answerId: answer.id };
}

function multi(data: WordsData, word: Word, rng: Rng): MultiExercise | null {
  const syns = word.synonyms.filter((x) => !x.includes(' '));
  const usable = word.sentences.filter((x) => blankOut(x, word.word));
  if (!syns.length || !usable.length) return null;
  const sentence = pick(usable, rng);
  const syn = pick(syns, rng);
  const others = distractors(data, word, 4, (w) => w.word, [...word.synonyms, syn], rng);
  if (others.length < 4) return null;
  const answer = [
    { id: word.id, label: word.word },
    { id: `syn:${syn}`, label: syn },
  ];
  return {
    kind: 'multi',
    type: 'equivalence',
    wordId: word.id,
    prompt: blankOut(sentence, word.word)!,
    sentence,
    options: shuffle([...answer, ...others.map((w) => ({ id: w.id, label: w.word }))], rng),
    answerIds: answer.map((a) => a.id),
  };
}

function typed(word: Word): TypeExercise {
  const letters = word.word.split('').map((c, i) => (c === ' ' ? ' ' : i === 0 ? c : '_'));
  return { kind: 'type', type: 'typeWord', wordId: word.id, prompt: word.definition, hint: letters.join(' ') };
}

export function makeExercise(data: WordsData, wordId: string, type: SingleType, rng: Rng = Math.random): SingleExercise {
  const word = data.words[wordId];
  if (type === 'typeWord') return typed(word);
  if (type === 'equivalence') return multi(data, word, rng) ?? makeExercise(data, wordId, 'fillBlank', rng);
  return choice(data, word, type, rng) ?? choice(data, word, 'wordToDef', rng)!;
}

/**
 * Choisit un type autorisé pour la boîte, différent du dernier exercice et des types déjà posés pour ce mot ;
 * si ce n'est pas possible, on garde d'abord la variété entre les exercices d'un même mot.
 */
export function pickType(
  box: number,
  last: ExerciseType | undefined,
  used: ExerciseType[],
  rng: Rng = Math.random,
  listening = false,
): SingleType {
  const all = typesForBox(box, listening);
  for (const ban of [[last, ...used], used, [last], []]) {
    const ok = all.filter((t) => !ban.includes(t));
    if (ok.length) return pick(ok, rng);
  }
  return all[0];
}

/** Exercice de remplacement après une erreur : autre type si possible. */
export function alternativeFor(
  data: WordsData,
  ex: SingleExercise,
  box: number,
  rng: Rng = Math.random,
  listening = false,
): SingleExercise {
  const types = typesForBox(box, listening).filter((t) => t !== ex.type);
  const type = types.length ? pick(types, rng) : (ex.type as SingleType);
  return { ...makeExercise(data, ex.wordId, type, rng), retry: true };
}

export function makePairs(data: WordsData, wordIds: string[], rng: Rng = Math.random): PairsExercise | null {
  const seen = new Set<string>();
  const ids = shuffle(wordIds, rng).filter((id) => {
    const t = lower(data.words[id].definitionFr);
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  const chosen = ids.slice(0, 5);
  if (chosen.length < 4) return null;
  return {
    kind: 'pairs',
    type: 'pairs',
    wordIds: shuffle(chosen, rng),
    defs: shuffle(chosen, rng).map((id) => ({ wordId: id, text: data.words[id].definitionFr })),
  };
}

// --- Correction ---------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export type Grade = 'correct' | 'almost' | 'wrong';

export function gradeTyped(answer: string, input: string): Grade {
  const a = norm(answer);
  const i = norm(input);
  if (!i) return 'wrong';
  if (a === i) return 'correct';
  return a.length >= 4 && levenshtein(a, i) <= 1 ? 'almost' : 'wrong';
}

/** Valeur d'une réponse à choix multiples : ids séparés par « | ». */
export const MULTI_SEP = '|';

export function grade(ex: SingleExercise, data: WordsData, value: string): Grade {
  if (ex.kind === 'choice') return value === ex.answerId ? 'correct' : 'wrong';
  if (ex.kind === 'multi') {
    const given = value.split(MULTI_SEP).filter(Boolean).sort();
    return given.join(MULTI_SEP) === [...ex.answerIds].sort().join(MULTI_SEP) ? 'correct' : 'wrong';
  }
  return gradeTyped(data.words[ex.wordId].word, value);
}
