const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Retrouve dans une phrase la forme (éventuellement fléchie) d'un mot.
 * Renvoie la sous-chaîne telle qu'écrite dans la phrase, ou null.
 */
export function findForm(sentence: string, word: string): string | null {
  const w = word.toLowerCase();
  if (w.includes(' ')) {
    const m = sentence.match(new RegExp(`\\b${escapeRe(w)}\\b`, 'i'));
    return m ? m[0] : null;
  }
  const exact = sentence.match(new RegExp(`\\b${escapeRe(w)}\\b`, 'i'));
  if (exact) return exact[0];

  // Forme fléchie : préfixe commun d'au moins 4 lettres (ou len-1 pour les mots courts : wane → waning)
  const need = Math.min(w.length, 4);
  let best: string | null = null;
  let bestScore = 0;
  for (const token of sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []) {
    const score = commonPrefix(token.toLowerCase(), w);
    const ok = score >= need || (score >= 3 && score >= w.length - 1);
    if (ok && score > bestScore) {
      best = token;
      bestScore = score;
    }
  }
  return best;
}

/** Découpe la phrase autour de la forme du mot : [avant, forme, après]. */
export function splitAround(sentence: string, word: string): [string, string, string] | null {
  const form = findForm(sentence, word);
  const m = form && new RegExp(`\\b${escapeRe(form)}\\b`, 'i').exec(sentence);
  return m ? [sentence.slice(0, m.index), m[0], sentence.slice(m.index + m[0].length)] : null;
}

/** Remplace la forme du mot par un blanc ; null si le mot est introuvable. */
export function blankOut(sentence: string, word: string): string | null {
  const parts = splitAround(sentence, word);
  return parts && `${parts[0]}_____${parts[2]}`;
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
