import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeRedis } from './fakeRedis';

const send = vi.fn();
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => send(...a) } }));
const { default: handler } = await import('../api/account');

const SECRET = 'x'.repeat(40);
let redis: ReturnType<typeof installFakeRedis>;

const sub = (n = 1) => ({ endpoint: `https://push.example/device-${n}`, keys: { p256dh: 'p', auth: 'a' } });
const prefs = { reminder: true, reminderTime: '19:00', surprise: 3, from: '09:00', to: '21:00' };

async function cookie(sub: string) {
  const jwt = await new SignJWT({ name: 'Ada' }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
  return `gremlin_session=${jwt}`;
}

const call = async (op: string, method: string, body: unknown, who: string | null = 'ada') =>
  handler.fetch(
    new Request(`https://gremlin.test/api/account?op=${op}`, {
      method,
      headers: { 'content-type': 'application/json', ...(who ? { cookie: await cookie(who) } : {}) },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({});
  redis = installFakeRedis();
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: 'c.apps.googleusercontent.com',
    SESSION_SECRET: SECRET,
    KV_REST_API_URL: 'https://redis.test',
    KV_REST_API_TOKEN: 'tok',
    VAPID_PUBLIC_KEY: 'pub-key',
    VAPID_PRIVATE_KEY: 'priv-key',
  });
});
afterEach(() => {
  redis.restore();
  for (const k of ['GOOGLE_CLIENT_ID', 'SESSION_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) delete process.env[k];
});

describe('rappels : abonnement', () => {
  it('me : expose la clé publique VAPID (jamais la privée)', async () => {
    const res = await handler.fetch(new Request('https://gremlin.test/api/account?op=me'));
    const text = await res.text();
    expect(JSON.parse(text).push).toBe('pub-key');
    expect(text).not.toContain('priv-key');
  });

  it('me : push = null si les clés VAPID manquent', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await (await handler.fetch(new Request('https://gremlin.test/api/account?op=me'))).json()).push).toBeNull();
  });

  it('exige un compte connecté', async () => {
    expect((await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'Europe/Paris' }, null)).status).toBe(401);
  });

  it('enregistre, relit puis supprime un appareil', async () => {
    expect((await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'Europe/Paris' })).status).toBe(200);
    expect(redis.sets.get('push:users')).toContain('ada');
    const got = await (await call('push-get', 'POST', { endpoint: sub().endpoint })).json();
    expect(got.prefs).toEqual(prefs);
    expect((await (await call('push-get', 'POST', { endpoint: sub(2).endpoint })).json()).prefs).toBeNull(); // autre appareil
    await call('push-remove', 'POST', { endpoint: sub().endpoint });
    expect((await (await call('push-get', 'POST', { endpoint: sub().endpoint })).json()).prefs).toBeNull();
  });

  it('une mise à jour des préférences garde l\'état d\'envoi du jour (pas de doublon)', async () => {
    await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'Europe/Paris' });
    const key = [...redis.hashes.get('push:ada')!.keys()][0];
    const rec = JSON.parse(redis.hashes.get('push:ada')!.get(key)!);
    rec.state = { day: '2026-10-06', sent: ['reminder'], recent: ['abate'] };
    redis.hashes.get('push:ada')!.set(key, JSON.stringify(rec));
    await call('push-save', 'PUT', { subscription: sub(), prefs: { ...prefs, surprise: 1 }, tz: 'Europe/Paris' });
    expect(JSON.parse(redis.hashes.get('push:ada')!.get(key)!).state.sent).toEqual(['reminder']);
  });

  it('refuse les données invalides (endpoint non https, heure, nombre, fuseau)', async () => {
    const bad = [
      { subscription: { ...sub(), endpoint: 'http://evil.test/x' }, prefs, tz: 'Europe/Paris' },
      { subscription: sub(), prefs: { ...prefs, reminderTime: '25:99' }, tz: 'Europe/Paris' },
      { subscription: sub(), prefs: { ...prefs, surprise: 50 }, tz: 'Europe/Paris' },
      { subscription: sub(), prefs, tz: 'Mars/Phobos' },
      { subscription: { endpoint: sub().endpoint }, prefs, tz: 'Europe/Paris' },
    ];
    for (const b of bad) expect((await call('push-save', 'PUT', b)).status).toBe(400);
    expect(redis.hashes.get('push:ada')).toBeUndefined();
  });

  it('limite à 5 appareils par compte', async () => {
    for (let i = 1; i <= 5; i++) expect((await call('push-save', 'PUT', { subscription: sub(i), prefs, tz: 'UTC' })).status).toBe(200);
    expect((await call('push-save', 'PUT', { subscription: sub(6), prefs, tz: 'UTC' })).status).toBe(409);
    expect((await call('push-save', 'PUT', { subscription: sub(3), prefs, tz: 'UTC' })).status).toBe(200); // mise à jour d'un existant : ok
  });

  it('un utilisateur ne peut ni lire ni supprimer l\'appareil d\'un autre', async () => {
    await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'UTC' });
    expect((await (await call('push-get', 'POST', { endpoint: sub().endpoint }, 'bob')).json()).prefs).toBeNull();
    await call('push-remove', 'POST', { endpoint: sub().endpoint }, 'bob');
    expect((await (await call('push-get', 'POST', { endpoint: sub().endpoint })).json()).prefs).toEqual(prefs);
  });
});

describe('rappels : notification de test', () => {
  it('envoie une notification à l\'appareil enregistré', async () => {
    await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'UTC' });
    expect((await call('push-test', 'POST', { endpoint: sub().endpoint })).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][1] as string).body).toContain('fonctionnent');
  });

  it('appareil inconnu : 404, rien n\'est envoyé', async () => {
    expect((await call('push-test', 'POST', { endpoint: sub(9).endpoint })).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('abonnement expiré : 410 et appareil supprimé', async () => {
    await call('push-save', 'PUT', { subscription: sub(), prefs, tz: 'UTC' });
    send.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    expect((await call('push-test', 'POST', { endpoint: sub().endpoint })).status).toBe(410);
    expect(redis.hashes.get('push:ada')?.size ?? 0).toBe(0);
  });
});
