import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeRedis } from './fakeRedis';

const send = vi.fn();
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => send(...a) } }));

const { default: handler } = await import('../api/notify');

const SECRET = 'cron-secret-for-tests';
let redis: ReturnType<typeof installFakeRedis>;

const prefs = { reminder: true, reminderTime: '19:00', surprise: 0, from: '09:00', to: '21:00' };
const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };

function addDevice(over: { prefs?: Partial<typeof prefs>; tz?: string; user?: string } = {}, progress?: unknown) {
  const user = over.user ?? 'u1';
  redis.hashes.set(`push:${user}`, new Map([['dev1', JSON.stringify({ sub, prefs: { ...prefs, ...over.prefs }, tz: over.tz ?? 'Europe/Paris', state: { day: '', sent: [], recent: [] } })]]));
  redis.sets.set('push:users', new Set([user]));
  if (progress) redis.strings.set(`progress:${user}`, JSON.stringify(progress));
}

const run = async (iso: string) => {
  vi.setSystemTime(new Date(iso));
  const res = await handler.fetch(new Request('https://x.test/api/notify', { headers: { authorization: `Bearer ${SECRET}` } }));
  return { status: res.status, body: await res.json() };
};
const sentPayloads = () => send.mock.calls.map((c) => JSON.parse(c[1] as string));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  send.mockReset();
  send.mockResolvedValue({});
  redis = installFakeRedis();
  process.env.CRON_SECRET = SECRET;
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 'tok';
});
afterEach(() => {
  vi.useRealTimers();
  redis.restore();
  for (const k of ['CRON_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
});

describe('api/notify : sécurité', () => {
  it('refuse sans secret ou avec un mauvais secret', async () => {
    for (const headers of [{}, { authorization: 'Bearer faux' }, { authorization: `Bearer ${SECRET}x` }] as Record<string, string>[]) {
      expect((await handler.fetch(new Request('https://x.test/api/notify', { headers }))).status).toBe(401);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('refuse si CRON_SECRET n\'est pas défini (même avec « Bearer undefined »)', async () => {
    delete process.env.CRON_SECRET;
    expect((await handler.fetch(new Request('https://x.test/api/notify', { headers: { authorization: 'Bearer undefined' } }))).status).toBe(401);
  });
});

describe('api/notify : rappel quotidien', () => {
  it('envoie le rappel à l\'heure locale (19:00 à Paris = 17:00 UTC en octobre), une seule fois par jour', async () => {
    addDevice();
    expect((await run('2026-10-06T16:50:00Z')).body.sent).toBe(0); // 18:50 : trop tôt
    expect((await run('2026-10-06T17:05:00Z')).body.sent).toBe(1); // 19:05
    expect(sentPayloads()[0]).toMatchObject({ title: 'C’est l’heure de ta leçon', url: '/' });
    expect((await run('2026-10-06T17:15:00Z')).body.sent).toBe(0); // déjà envoyé
    expect(send).toHaveBeenCalledTimes(1);
    expect((await run('2026-10-07T17:05:00Z')).body.sent).toBe(1); // le lendemain, à nouveau
  });

  it('respecte le fuseau horaire de l\'appareil', async () => {
    addDevice({ tz: 'America/New_York' }); // 19:00 à New York = 23:00 UTC
    expect((await run('2026-10-06T17:05:00Z')).body.sent).toBe(0);
    expect((await run('2026-10-06T23:05:00Z')).body.sent).toBe(1);
  });

  it('n\'envoie plus un créneau manqué de plus de 3 h', async () => {
    addDevice();
    expect((await run('2026-10-06T20:30:00Z')).body.sent).toBe(0); // 22:30 à Paris
  });

  it('pas de rappel si la leçon du jour est déjà faite', async () => {
    addDevice({}, { words: {}, days: { '2026-10-06': { lessons: 1 } } });
    expect((await run('2026-10-06T17:05:00Z')).body.sent).toBe(0);
    expect((await run('2026-10-06T17:15:00Z')).body.sent).toBe(0);
  });

  it('annonce les mots à réviser et la série en danger', async () => {
    const past = Date.parse('2026-10-01');
    addDevice({}, { words: { a: { box: 2, dueAt: past }, b: { box: 3, dueAt: past }, c: { box: 0, dueAt: 0 } }, streak: { count: 4, lastDay: '2026-10-05' } });
    await run('2026-10-06T17:05:00Z');
    expect(sentPayloads()[0].title).toBe('🔥 Garde ta série de 4 jours !');
    expect(sentPayloads()[0].body).toContain('2 mots à réviser');
  });

  it('rappel désactivé : rien n\'est envoyé', async () => {
    addDevice({ prefs: { reminder: false } });
    expect((await run('2026-10-06T17:05:00Z')).body.sent).toBe(0);
  });
});

describe('api/notify : mots surprise', () => {
  it('3 mots différents dans la journée, dans la plage choisie, avec définition et lien vers la fiche', async () => {
    addDevice({ prefs: { reminder: false, surprise: 3 } });
    const times: string[] = [];
    for (let t = Date.parse('2026-10-06T00:00:00Z'); t < Date.parse('2026-10-07T00:00:00Z'); t += 10 * 60 * 1000) {
      const before = send.mock.calls.length;
      await run(new Date(t).toISOString());
      if (send.mock.calls.length > before) times.push(new Date(t + 2 * 3600 * 1000).toISOString().slice(11, 16)); // heure de Paris
    }
    expect(times).toHaveLength(3);
    for (const t of times) expect(t >= '09:00' && t <= '21:30').toBe(true);
    const payloads = sentPayloads();
    expect(new Set(payloads.map((p) => p.url)).size).toBe(3);
    for (const p of payloads) {
      expect(p.url).toMatch(/^\/\?word=[a-z-]+$/);
      expect(p.title).toMatch(/\(.+\)$/); // « abate (v.) »
      expect(p.body.split('\n')).toHaveLength(2); // définition EN + FR
    }
  });

  it('les heures changent d\'un jour à l\'autre', async () => {
    const firstSlot = async (day: string) => {
      addDevice({ prefs: { reminder: false, surprise: 1 } });
      for (let t = Date.parse(`${day}T06:00:00Z`); t < Date.parse(`${day}T20:00:00Z`); t += 10 * 60 * 1000) {
        const before = send.mock.calls.length;
        await run(new Date(t).toISOString());
        if (send.mock.calls.length > before) return t;
      }
      return -1;
    };
    const slots = new Set<number>();
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']) slots.add(((await firstSlot(d)) % 86400000));
    expect(slots.size).toBeGreaterThan(1);
  });

  it('préfère les mots pas encore maîtrisés', async () => {
    const mastered = Object.fromEntries(Object.keys(JSON.parse((await import('node:fs')).readFileSync('data/words.json', 'utf8')).words).slice(0, 500).map((id) => [id, { box: 5, dueAt: 1 }]));
    addDevice({ prefs: { reminder: false, surprise: 1 } }, { words: mastered });
    for (let t = Date.parse('2026-10-06T06:00:00Z'); t < Date.parse('2026-10-06T20:00:00Z'); t += 10 * 60 * 1000) await run(new Date(t).toISOString());
    const id = sentPayloads()[0].url.split('=')[1];
    expect(mastered[id]).toBeUndefined(); // un des ~11 mots non maîtrisés
  });
});

describe('api/notify : erreurs d\'envoi', () => {
  it('abonnement expiré (410) : l\'appareil est supprimé', async () => {
    addDevice();
    send.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const { body } = await run('2026-10-06T17:05:00Z');
    expect(body.removed).toBe(1);
    expect(redis.hashes.get('push:u1')?.size ?? 0).toBe(0);
  });

  it('erreur temporaire (500) : le créneau n\'est pas perdu, nouvel essai au passage suivant', async () => {
    addDevice();
    send.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    expect((await run('2026-10-06T17:05:00Z')).body.sent).toBe(0);
    expect((await run('2026-10-06T17:15:00Z')).body.sent).toBe(1);
  });

  it('nettoie l\'utilisateur sans appareil', async () => {
    redis.sets.set('push:users', new Set(['ghost']));
    await run('2026-10-06T17:05:00Z');
    expect(redis.sets.get('push:users')?.size).toBe(0);
  });
});
