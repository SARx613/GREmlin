// Envoi des notifications (rappel quotidien + mots surprise).
// Appelé toutes les ~10 minutes par une tâche planifiée (GitHub Actions, cron-job.org ou cron Vercel) avec
//   Authorization: Bearer <CRON_SECRET>
// À chaque appel, pour chaque appareil abonné, on regarde si un créneau du jour est arrivé et pas encore envoyé.
//
// Variables : CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, KV_REST_API_URL + KV_REST_API_TOKEN
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import webpush from 'web-push';

type PushPrefs = { reminder: boolean; reminderTime: string; surprise: number; from: string; to: string };
type State = { day: string; sent: string[]; recent: string[] };
type Device = { sub: webpush.PushSubscription; prefs: PushPrefs; tz: string; state: State };
type Word = { id: string; word: string; pos: string; definition: string; definitionFr: string };
type WP = { box: number; dueAt: number };
type Progress = {
  words: Record<string, WP>;
  streak?: { count: number; lastDay: string | null };
  days?: Record<string, { lessons: number }>;
};

const GRACE_MINUTES = 180; // un créneau manqué de plus de 3 h n'est plus envoyé
const RECENT_MAX = 60;

const env = (key: string) => process.env[key] || undefined;

function redisConfig() {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url, token } : null;
}

async function redis(command: string[]): Promise<unknown> {
  const cfg = redisConfig();
  if (!cfg) throw new Error('redis non configuré');
  const res = await fetch(cfg.url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` }, body: JSON.stringify(command) });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

let wordsCache: Word[] | null = null;
function allWords(): Word[] {
  // data/words.json est inclus dans la fonction via vercel.json (includeFiles)
  wordsCache ??= Object.values((JSON.parse(readFileSync(join(process.cwd(), 'data', 'words.json'), 'utf8')) as { words: Record<string, Word> }).words);
  return wordsCache;
}

// --- Heure locale de l'utilisateur ----------------------------------------------

function localDay(now: number, tz: string): { day: string; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Petit hash déterministe (pour décaler les mots surprise d'un jour à l'autre sans stocker de hasard). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Slot = { id: string; minute: number; kind: 'reminder' | 'word' };

/** Créneaux du jour : le rappel à l'heure choisie, et N mots surprise répartis dans la plage avec un décalage de ±20 min. */
function slotsFor(prefs: PushPrefs, day: string, seed: string): Slot[] {
  const slots: Slot[] = [];
  if (prefs.reminder) slots.push({ id: 'reminder', minute: toMinutes(prefs.reminderTime), kind: 'reminder' });
  const from = toMinutes(prefs.from);
  const to = toMinutes(prefs.to);
  if (prefs.surprise > 0 && to > from) {
    for (let i = 0; i < prefs.surprise; i++) {
      const base = from + ((i + 0.5) * (to - from)) / prefs.surprise;
      const jitter = (hash(`${day}|${seed}|${i}`) % 41) - 20;
      slots.push({ id: `word${i}`, minute: Math.min(to, Math.max(from, Math.round(base + jitter))), kind: 'word' });
    }
  }
  return slots.sort((a, b) => a.minute - b.minute);
}

// --- Messages --------------------------------------------------------------------

function pickWord(progress: Progress | null, recent: string[]): Word {
  const words = allWords();
  const notRecent = words.filter((w) => !recent.includes(w.id));
  const pool = notRecent.length ? notRecent : words;
  // on privilégie les mots pas encore maîtrisés (boîte < 4)
  const learning = pool.filter((w) => (progress?.words[w.id]?.box ?? 0) < 4);
  const from = learning.length ? learning : pool;
  return from[Math.floor(Math.random() * from.length)];
}

function reminderMessage(progress: Progress | null, yesterday: string, now: number) {
  const due = progress ? Object.values(progress.words).filter((w) => w.box > 0 && w.dueAt <= now).length : 0;
  const atRisk = !!progress?.streak && progress.streak.count > 0 && progress.streak.lastDay === yesterday;
  const body = due
    ? `${due} mot${due > 1 ? 's' : ''} à réviser aujourd'hui. 5 minutes suffisent.`
    : 'Une petite leçon de 5 minutes ?';
  return {
    title: atRisk ? `🔥 Garde ta série de ${progress!.streak!.count} jour${progress!.streak!.count > 1 ? 's' : ''} !` : 'C’est l’heure de ta leçon',
    body,
    url: '/',
    tag: 'reminder',
  };
}

// --- Exécution -------------------------------------------------------------------

function authorized(req: Request): boolean {
  const secret = env('CRON_SECRET');
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function run(now: number): Promise<{ users: number; devices: number; sent: number; removed: number }> {
  webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'https://gremlin-tawny.vercel.app', env('VAPID_PUBLIC_KEY')!, env('VAPID_PRIVATE_KEY')!);
  const summary = { users: 0, devices: 0, sent: 0, removed: 0 };
  const userIds = ((await redis(['SMEMBERS', 'push:users'])) as string[] | null) ?? [];

  for (const userId of userIds) {
    const flat = ((await redis(['HGETALL', `push:${userId}`])) as string[] | null) ?? [];
    if (!flat.length) {
      await redis(['SREM', 'push:users', userId]);
      continue;
    }
    summary.users++;
    let progress: Progress | null = null;
    try {
      const raw = (await redis(['GET', `progress:${userId}`])) as string | null;
      progress = raw ? (JSON.parse(raw) as Progress) : null;
    } catch {
      /* sans progression : messages génériques */
    }

    for (let i = 0; i < flat.length; i += 2) {
      const id = flat[i];
      const device = JSON.parse(flat[i + 1]) as Device;
      summary.devices++;

      let local: { day: string; minute: number };
      try {
        local = localDay(now, device.tz);
      } catch {
        local = localDay(now, 'UTC');
      }
      const state: State = device.state.day === local.day ? device.state : { day: local.day, sent: [], recent: device.state.recent ?? [] };

      // un seul envoi par passage et par appareil : le créneau échu le plus ancien
      const slot = slotsFor(device.prefs, local.day, id).find(
        (s) => !state.sent.includes(s.id) && local.minute >= s.minute && local.minute - s.minute <= GRACE_MINUTES,
      );
      if (!slot) {
        if (state !== device.state) await redis(['HSET', `push:${userId}`, id, JSON.stringify({ ...device, state })]);
        continue;
      }

      const lessonsToday = progress?.days?.[local.day]?.lessons ?? 0;
      let payload: { title: string; body: string; url: string; tag: string } | null = null;
      if (slot.kind === 'reminder') {
        if (lessonsToday === 0) {
          const yesterday = localDay(now - 24 * 3600 * 1000, device.tz).day;
          payload = reminderMessage(progress, yesterday, now);
        }
      } else {
        const w = pickWord(progress, state.recent);
        payload = { title: `${w.word} (${w.pos})`, body: `${w.definition}\n${w.definitionFr}`, url: `/?word=${w.id}`, tag: `word-${slot.id}` };
        state.recent = [...state.recent, w.id].slice(-RECENT_MAX);
      }

      if (payload) {
        try {
          await webpush.sendNotification(device.sub, JSON.stringify(payload), { TTL: 3 * 3600 });
          summary.sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await redis(['HDEL', `push:${userId}`, id]); // abonnement expiré ou désinstallé
            summary.removed++;
          }
          continue; // créneau non marqué : nouvel essai au prochain passage (dans la limite du délai de grâce)
        }
      }
      state.sent = [...state.sent, slot.id];
      await redis(['HSET', `push:${userId}`, id, JSON.stringify({ ...device, state })]);
    }
  }
  return summary;
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY') || !redisConfig()) return Response.json({ error: 'not_configured' }, { status: 503 });
    try {
      return Response.json(await run(Date.now()), { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ error: 'failed' }, { status: 500 });
    }
  },
};
