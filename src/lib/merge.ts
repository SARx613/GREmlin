import type { DayStat, Progress, Streak, WordProgress } from '../types';

/** Entre deux versions d'un même mot : la plus travaillée (seen), puis la boîte la plus haute, puis celle triée. */
function pickWord(local: WordProgress, remote: WordProgress): WordProgress {
  if (local.seen !== remote.seen) return local.seen > remote.seen ? local : remote;
  if (local.box !== remote.box) return local.box > remote.box ? local : remote;
  return local.known === undefined && remote.known !== undefined ? remote : local;
}

function pickStreak(a: Streak, b: Streak): Streak {
  const best = Math.max(a.best ?? 0, b.best ?? 0, a.count, b.count);
  const win = !a.lastDay ? b : !b.lastDay ? a : a.lastDay !== b.lastDay ? (a.lastDay > b.lastDay ? a : b) : a.count >= b.count ? a : b;
  return { ...win, best };
}

function mergeDays(a: Record<string, DayStat> = {}, b: Record<string, DayStat> = {}): Record<string, DayStat> {
  const out: Record<string, DayStat> = { ...b };
  for (const [day, s] of Object.entries(a)) {
    const o = out[day];
    out[day] = o ? { lessons: Math.max(s.lessons, o.lessons), mastered: Math.max(s.mastered, o.mastered) } : s;
  }
  return out;
}

/** Fusionne la progression locale et celle du cloud sans rien perdre (le son reste un réglage local). */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const words = { ...remote.words };
  for (const [id, wp] of Object.entries(local.words)) {
    words[id] = remote.words[id] ? pickWord(wp, remote.words[id]) : wp;
  }
  const starred = [...new Set([...(remote.starred ?? []), ...(local.starred ?? [])])];
  const blitz = local.blitz || remote.blitz ? { best: Math.max(local.blitz?.best ?? 0, remote.blitz?.best ?? 0), plays: Math.max(local.blitz?.plays ?? 0, remote.blitz?.plays ?? 0) } : undefined;
  return {
    words,
    streak: pickStreak(local.streak, remote.streak),
    sound: local.sound,
    days: mergeDays(local.days, remote.days),
    starred,
    ...(blitz ? { blitz } : {}),
  };
}
