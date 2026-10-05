import type { Progress, Streak, WordProgress } from '../types';

/** Entre deux versions d'un même mot : la plus travaillée (seen), puis la boîte la plus haute, puis celle triée. */
function pickWord(local: WordProgress, remote: WordProgress): WordProgress {
  if (local.seen !== remote.seen) return local.seen > remote.seen ? local : remote;
  if (local.box !== remote.box) return local.box > remote.box ? local : remote;
  return local.known === undefined && remote.known !== undefined ? remote : local;
}

function pickStreak(a: Streak, b: Streak): Streak {
  if (!a.lastDay) return b;
  if (!b.lastDay) return a;
  if (a.lastDay !== b.lastDay) return a.lastDay > b.lastDay ? a : b;
  return a.count >= b.count ? a : b;
}

/** Fusionne la progression locale et celle du cloud sans rien perdre (le son reste un réglage local). */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const words = { ...remote.words };
  for (const [id, wp] of Object.entries(local.words)) {
    words[id] = remote.words[id] ? pickWord(wp, remote.words[id]) : wp;
  }
  return { words, streak: pickStreak(local.streak, remote.streak), sound: local.sound };
}
