import type { Choice, Word, WordProgress, WordsData } from '../types';
import { related, shuffle, type Rng } from './exercises';
import { allWordIds } from './flash';
import { blankOut } from './match';
import { getWP, isMastered, isNew } from './srs';

export const GRE_SESSION = 10;
export const COMPLETION_OPTIONS = 5;
export const EQUIVALENCE_OPTIONS = 6;
const REINSERT_GAP = 3;

/** Text Completion (1 bonne réponse sur 5) ou Sentence Equivalence (2 bonnes réponses sur 6). */
export type GreFormat = 'completion' | 'equivalence';

export type GreQuestion = {
  wordId: string;
  format: GreFormat;
  sentence: string; // phrase complète
  prompt: string; // phrase avec _____
  options: Choice[];
  answerIds: string[];
  retry?: boolean;
};

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

/**
 * Mots à travailler, par priorité : « à apprendre » (triés), puis mots en cours d'apprentissage, puis mots jamais vus.
 * Les mots connus ou maîtrisés ne reviennent que s'il ne reste rien d'autre.
 */
export function grePool(data: WordsData, words: Record<string, WordProgress>, rng: Rng = Math.random): string[] {
  const ids = allWordIds(data);
  const tier = (id: string): number => {
    const wp = getWP(words, id);
    if (isMastered(wp) || wp.known === true) return 3;
    if (wp.known === false) return 0;
    return isNew(wp) ? 2 : 1;
  };
  const focus = ids.filter((id) => tier(id) < 3);
  if (!focus.length) return shuffle(ids, rng);
  return [0, 1, 2].flatMap((t) => shuffle(focus.filter((id) => tier(id) === t), rng));
}

/** Bonnes phrases pour un mot : celles où sa forme est retrouvable pour faire le trou. */
const usableSentences = (word: Word) => word.sentences.filter((s) => blankOut(s, word.word));

/** Distracteurs : mots à travailler de préférence (c'est eux qu'on veut voir passer), même nature, jamais apparentés. */
function distractorsFor(data: WordsData, word: Word, n: number, pool: string[], avoid: string[], rng: Rng): Word[] {
  const banned = new Set([word.word.toLowerCase(), ...avoid.map((a) => a.toLowerCase())]);
  const ok = (w: Word) => w.id !== word.id && !banned.has(w.word.toLowerCase()) && !related(word, w);
  const fromPool = pool.map((id) => data.words[id]).filter(ok);
  const fromAll = Object.values(data.words).filter(ok);
  const tiers = [
    fromPool.filter((w) => w.pos === word.pos),
    fromPool,
    fromAll.filter((w) => w.pos === word.pos),
    fromAll,
  ];
  const chosen: Word[] = [];
  for (const t of tiers) {
    for (const w of shuffle(t, rng)) {
      if (chosen.length >= n) return chosen;
      if (!chosen.includes(w) && !chosen.some((c) => related(c, w))) chosen.push(w);
    }
  }
  return chosen;
}

/**
 * Une question GRE sur un mot. `pool` : mots parmi lesquels piocher les distracteurs.
 * `avoidSentence` : phrase à ne pas reposer (réessai après une erreur) si une autre existe.
 */
export function makeGreQuestion(
  data: WordsData,
  wordId: string,
  pool: string[],
  rng: Rng = Math.random,
  format?: GreFormat,
  avoidSentence?: string,
): GreQuestion | null {
  const word = data.words[wordId];
  const sentences = usableSentences(word);
  if (!sentences.length) return null;
  const fresh = sentences.filter((s) => s !== avoidSentence);
  const sentence = pick(fresh.length ? fresh : sentences, rng);
  const prompt = blankOut(sentence, word.word)!;

  const syns = word.synonyms.filter((s) => !s.includes(' ') && s.toLowerCase() !== word.word.toLowerCase());
  const wantEquivalence = format ? format === 'equivalence' : syns.length > 0 && rng() < 0.45;

  if (wantEquivalence && syns.length) {
    const syn = pick(syns, rng);
    const others = distractorsFor(data, word, EQUIVALENCE_OPTIONS - 2, pool, word.synonyms, rng);
    if (others.length === EQUIVALENCE_OPTIONS - 2) {
      const answer: Choice[] = [
        { id: word.id, label: word.word },
        { id: `syn:${syn}`, label: syn },
      ];
      return {
        wordId,
        format: 'equivalence',
        sentence,
        prompt,
        options: shuffle([...answer, ...others.map((w) => ({ id: w.id, label: w.word }))], rng),
        answerIds: answer.map((a) => a.id),
      };
    }
  }

  const others = distractorsFor(data, word, COMPLETION_OPTIONS - 1, pool, word.synonyms, rng);
  if (others.length < COMPLETION_OPTIONS - 1) return null;
  return {
    wordId,
    format: 'completion',
    sentence,
    prompt,
    options: shuffle([{ id: word.id, label: word.word }, ...others.map((w) => ({ id: w.id, label: w.word }))], rng),
    answerIds: [word.id],
  };
}

/** Construit une série de questions sur les premiers mots du pool qui s'y prêtent. */
export function buildGreQueue(data: WordsData, pool: string[], size = GRE_SESSION, rng: Rng = Math.random): GreQuestion[] {
  const queue: GreQuestion[] = [];
  for (const id of pool) {
    if (queue.length >= size) break;
    const q = makeGreQuestion(data, id, pool, rng);
    if (q) queue.push(q);
  }
  return queue;
}

export const isGreCorrect = (q: GreQuestion, picked: string[]): boolean =>
  picked.length === q.answerIds.length && q.answerIds.every((id) => picked.includes(id));

// --- Déroulement d'une série ----------------------------------------------------

export type GreState = {
  queue: GreQuestion[];
  total: number;
  done: number;
  firstTry: number;
  missed: string[]; // mots ratés (sans doublon)
};

export const newGreSession = (queue: GreQuestion[]): GreState => ({ queue, total: queue.length, done: 0, firstTry: 0, missed: [] });

/**
 * Résout la question en tête de file. Une première erreur remet le mot dans la file 3 questions plus loin,
 * avec une autre phrase si le mot en a une (`retry` fournie par l'appelant). Une erreur au réessai clôt la question :
 * le mot reste dans « à retravailler » au lieu de boucler.
 */
export function resolveGre(s: GreState, correct: boolean, retry?: GreQuestion): GreState {
  const head = s.queue[0];
  if (!head) return s;
  const rest = s.queue.slice(1);
  if (correct) return { ...s, queue: rest, done: s.done + 1, firstTry: s.firstTry + (head.retry ? 0 : 1) };
  const missed = s.missed.includes(head.wordId) ? s.missed : [...s.missed, head.wordId];
  if (head.retry) return { ...s, queue: rest, done: s.done + 1, missed };
  const again = retry ?? { ...head, retry: true };
  const at = Math.min(REINSERT_GAP, rest.length);
  return { ...s, queue: [...rest.slice(0, at), again, ...rest.slice(at)], missed };
}
