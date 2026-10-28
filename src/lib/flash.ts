import type { WordProgress, WordsData } from '../types';
import { shuffle, type Rng } from './exercises';
import { getWP, isMastered, isNew } from './srs';

export const allWordIds = (data: WordsData): string[] => data.chapters.flatMap((c) => c.wordIds);

/** Deux paquets de flashcards : les mots jamais triés, ou les « je connais » jamais travaillés (contrôle). */
export type DeckKind = 'sort' | 'check';

const untriaged = (wp: WordProgress) => isNew(wp) && wp.known === undefined;
const claimedKnown = (wp: WordProgress) => wp.known === true && wp.seen === 0 && !wp.verified;

/** Paquet mélangé. `check` : les mots déclarés connus qu'aucune leçon n'a encore vérifiés. */
export function flashDeck(data: WordsData, words: Record<string, WordProgress>, kind: DeckKind, rng: Rng = Math.random): string[] {
  const keep = kind === 'sort' ? untriaged : claimedKnown;
  return shuffle(allWordIds(data).filter((id) => keep(getWP(words, id))), rng);
}

export type SortCounts = { total: number; unsorted: number; known: number; learn: number; check: number };

export function sortCounts(data: WordsData, words: Record<string, WordProgress>): SortCounts {
  const ids = allWordIds(data);
  const wps = ids.map((id) => getWP(words, id));
  return {
    total: ids.length,
    unsorted: wps.filter(untriaged).length,
    known: wps.filter((w) => w.known === true).length,
    learn: wps.filter((w) => w.known === false && !isMastered(w)).length,
    check: wps.filter(claimedKnown).length,
  };
}

/** Mots « à apprendre » (triés « je ne connais pas », pas encore maîtrisés) dans l'ordre des chapitres. */
export const learnPile = (data: WordsData, words: Record<string, WordProgress>): string[] =>
  allWordIds(data).filter((id) => {
    const wp = getWP(words, id);
    return wp.known === false && !isMastered(wp);
  });
