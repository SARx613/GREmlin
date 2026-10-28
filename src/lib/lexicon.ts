import type { WordsData } from '../types';

/** Formes régulières d'un mot (pluriel, passé, -ing, adverbe) pour reconnaître le vocabulaire dans une phrase. */
function forms(w: string): string[] {
  if (w.length < 4) return [w];
  const out = [w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}ly`];
  const last = w[w.length - 1];
  if (w.endsWith('e')) out.push(`${w.slice(0, -1)}ing`, `${w}ly`);
  if (w.endsWith('y')) out.push(`${w.slice(0, -1)}ies`, `${w.slice(0, -1)}ied`, `${w.slice(0, -1)}ily`);
  if (!/[aeiouy]/.test(last)) out.push(`${w}${last}ed`, `${w}${last}ing`);
  return out;
}

const cache = new WeakMap<WordsData, Map<string, string>>();

/** forme en minuscules → id du mot ; les formes exactes l'emportent sur les formes dérivées. */
export function lexiconOf(data: WordsData): Map<string, string> {
  let lex = cache.get(data);
  if (lex) return lex;
  lex = new Map();
  const single = Object.values(data.words).filter((w) => !w.word.includes(' '));
  for (const w of single) lex.set(w.word.toLowerCase(), w.id);
  for (const w of single) for (const f of forms(w.word.toLowerCase())) if (!lex.has(f)) lex.set(f, w.id);
  cache.set(data, lex);
  return lex;
}

export type Piece = { text: string; wordId?: string };

/** Découpe une phrase : chaque mot du vocabulaire GRE reconnu porte son id (sauf `skipId`, souvent la réponse). */
export function tokenize(sentence: string, data: WordsData, skipId?: string): Piece[] {
  const lex = lexiconOf(data);
  const pieces: Piece[] = [];
  for (const part of sentence.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/)) {
    if (!part) continue;
    const key = part.toLowerCase().replace(/['’]s$/, '');
    const id = /^[A-Za-z]/.test(part) ? lex.get(key) : undefined;
    pieces.push(id && id !== skipId ? { text: part, wordId: id } : { text: part });
  }
  return pieces;
}
