import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/account';

const SECRET = 'x'.repeat(40);
const store = new Map<string, string>();
const realFetch = globalThis.fetch;

async function cookieFor(sub: string) {
  const jwt = await new SignJWT({ name: 'Ada', email: 'ada@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
  return `gremlin_session=${jwt}`;
}

const call = (op: string, init: RequestInit & { cookie?: string } = {}) =>
  handler.fetch(
    new Request(`https://gremlin.test/api/account?op=${op}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}) },
    }),
  );

const progress = { words: { abate: { box: 2, dueAt: 5, seen: 3, misses: 1 } }, streak: { count: 1, lastDay: '2026-10-06' }, sound: true };

beforeEach(() => {
  store.clear();
  process.env.GOOGLE_CLIENT_ID = 'client.apps.googleusercontent.com';
  process.env.SESSION_SECRET = SECRET;
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 'tok';
  // faux Redis REST : ["GET", k] / ["SET", k, v]
  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const [cmd, key, value] = JSON.parse(String(init?.body));
    if (cmd === 'SET') store.set(key, value);
    return Response.json({ result: cmd === 'GET' ? (store.get(key) ?? null) : 'OK' });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ['GOOGLE_CLIENT_ID', 'SESSION_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
});

describe('api/account', () => {
  it('me : sans session, expose le client id et l\'état de la synchro', async () => {
    const body = await (await call('me')).json();
    expect(body).toEqual({ clientId: 'client.apps.googleusercontent.com', sync: true, push: null, user: null, missing: [] });
  });

  it('me : non configuré → pas de client id (le bouton Google est masqué)', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const body = await (await call('me')).json();
    expect(body.clientId).toBeNull();
    expect(body.missing).toEqual(['GOOGLE_CLIENT_ID']); // dit laquelle manque, sans révéler de valeur
  });

  it('me : avec un cookie valide, renvoie l\'utilisateur', async () => {
    const body = await (await call('me', { cookie: await cookieFor('g-123') })).json();
    expect(body.user).toMatchObject({ id: 'g-123', name: 'Ada' });
  });

  it('refuse load/save sans session et un cookie falsifié', async () => {
    expect((await call('load')).status).toBe(401);
    expect((await call('load', { cookie: 'gremlin_session=abc.def.ghi' })).status).toBe(401);
  });

  it('save puis load : aller-retour, isolé par utilisateur', async () => {
    const ada = await cookieFor('ada');
    const bob = await cookieFor('bob');
    expect((await call('save', { method: 'PUT', cookie: ada, body: JSON.stringify({ progress }) })).status).toBe(200);
    expect((await (await call('load', { cookie: ada })).json()).progress).toEqual(progress);
    expect((await (await call('load', { cookie: bob })).json()).progress).toBeNull();
  });

  it('save : refuse une progression mal formée', async () => {
    const res = await call('save', { method: 'PUT', cookie: await cookieFor('ada'), body: JSON.stringify({ progress: { words: { a: { box: 'x' } } } }) });
    expect(res.status).toBe(400);
  });

  it('CSRF : refuse un POST/PUT qui n\'est pas du JSON ou vient d\'une autre origine', async () => {
    const ada = await cookieFor('ada');
    const form = await handler.fetch(
      new Request('https://gremlin.test/api/account?op=save', { method: 'PUT', headers: { cookie: ada, 'content-type': 'text/plain' }, body: '{}' }),
    );
    expect(form.status).toBe(403);
    const cross = await handler.fetch(
      new Request('https://gremlin.test/api/account?op=save', {
        method: 'PUT',
        headers: { cookie: ada, 'content-type': 'application/json', origin: 'https://evil.test' },
        body: JSON.stringify({ progress }),
      }),
    );
    expect(cross.status).toBe(403);
  });

  it('login : un jeton qui n\'est pas signé par Google est refusé, aucun cookie posé', async () => {
    const res = await call('login', { method: 'POST', body: JSON.stringify({ credential: 'faux.jeton.ici' }) });
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('logout : efface le cookie', async () => {
    const res = await call('logout', { method: 'POST', body: '{}' });
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});
