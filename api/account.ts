// Compte Google + synchronisation de la progression.
// Une seule fonction, aiguillée par ?op=… :
//   GET  ?op=me      → { clientId, sync, user }
//   POST ?op=login   → { credential } (jeton Google) → cookie de session
//   POST ?op=logout  → efface le cookie
//   GET  ?op=load    → { progress }  (connecté)
//   PUT  ?op=save    → { progress }  (connecté)
//   POST ?op=push-get | push-remove | push-test, PUT ?op=push-save → rappels (notifications push, par appareil)
//
// Variables d'environnement (Vercel) :
//   GOOGLE_CLIENT_ID, SESSION_SECRET,
//   KV_REST_API_URL + KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (notifications ; l'envoi se fait dans api/notify.ts)
import { createHash } from 'node:crypto';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import webpush from 'web-push';

const COOKIE = 'gremlin_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_BYTES = 400_000;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type User = { id: string; name: string; picture: string; email: string };

const env = (key: string) => process.env[key] || undefined;
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const secretKey = () => {
  const s = env('SESSION_SECRET');
  return s ? new TextEncoder().encode(s) : null;
};

function redisConfig() {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url, token } : null;
}

async function redis(command: string[]): Promise<unknown> {
  const cfg = redisConfig();
  if (!cfg) throw new Error('redis non configuré');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

async function sessionUser(req: Request): Promise<User | null> {
  const key = secretKey();
  const token = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ''),
      picture: String(payload.picture ?? ''),
      email: String(payload.email ?? ''),
    };
  } catch {
    return null;
  }
}

function cookie(value: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/** Protection CSRF : JSON obligatoire (impossible via un formulaire externe) et même origine. */
function sameOriginJson(req: Request): boolean {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return false;
  const origin = req.headers.get('origin');
  return !origin || new URL(origin).host === new URL(req.url).host;
}

/** Forme minimale d'une progression ; renvoie null si ce n'en est pas une. */
function validProgress(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const words = (p as { words?: unknown }).words;
  if (!words || typeof words !== 'object') return false;
  return Object.values(words).every((w) => {
    const x = w as { box?: unknown; dueAt?: unknown; seen?: unknown; misses?: unknown };
    return x && typeof x.box === 'number' && typeof x.dueAt === 'number' && typeof x.seen === 'number' && typeof x.misses === 'number';
  });
}

// --- Rappels (Web Push) -------------------------------------------------------

type PushPrefs = { reminder: boolean; reminderTime: string; surprise: number; from: string; to: string };
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DEVICES = 5;

const pushConfigured = () => !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') && redisConfig());
const deviceId = (endpoint: string) => createHash('sha256').update(endpoint).digest('base64url').slice(0, 22);

function validSubscription(s: unknown): s is Subscription {
  const x = s as Partial<Subscription> | null;
  return (
    !!x &&
    typeof x.endpoint === 'string' &&
    x.endpoint.startsWith('https://') &&
    x.endpoint.length < 1000 &&
    typeof x.keys?.p256dh === 'string' &&
    typeof x.keys?.auth === 'string'
  );
}

function validPrefs(p: unknown): p is PushPrefs {
  const x = p as Partial<PushPrefs> | null;
  return (
    !!x &&
    typeof x.reminder === 'boolean' &&
    HHMM.test(String(x.reminderTime)) &&
    Number.isInteger(x.surprise) &&
    x.surprise! >= 0 &&
    x.surprise! <= 5 &&
    HHMM.test(String(x.from)) &&
    HHMM.test(String(x.to))
  );
}

function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function pushOps(op: string, req: Request, user: User): Promise<Response> {
  if (!pushConfigured()) return json({ error: 'not_configured' }, 503);
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    subscription?: unknown;
    prefs?: unknown;
    tz?: unknown;
  } | null;
  if (!body) return json({ error: 'invalid' }, 400);
  const hash = `push:${user.id}`;

  try {
    if (op === 'push-save' && req.method === 'PUT') {
      if (!validSubscription(body.subscription) || !validPrefs(body.prefs) || !validTimeZone(body.tz)) return json({ error: 'invalid' }, 400);
      const id = deviceId(body.subscription.endpoint);
      const existing = (await redis(['HGETALL', hash])) as string[] | null;
      const count = existing ? existing.length / 2 : 0;
      const known = existing?.some((v, i) => i % 2 === 0 && v === id);
      if (!known && count >= MAX_DEVICES) return json({ error: 'too_many_devices' }, 409);
      const prev = known ? JSON.parse((await redis(['HGET', hash, id])) as string) : null;
      const record = { sub: body.subscription, prefs: body.prefs, tz: body.tz, state: prev?.state ?? { day: '', sent: [], recent: [] } };
      await redis(['HSET', hash, id, JSON.stringify(record)]);
      await redis(['SADD', 'push:users', user.id]);
      return json({ ok: true });
    }

    if (typeof body.endpoint !== 'string') return json({ error: 'invalid' }, 400);
    const id = deviceId(body.endpoint);

    if (op === 'push-get' && req.method === 'POST') {
      const raw = (await redis(['HGET', hash, id])) as string | null;
      return json({ prefs: raw ? JSON.parse(raw).prefs : null });
    }

    if (op === 'push-remove' && req.method === 'POST') {
      await redis(['HDEL', hash, id]);
      return json({ ok: true });
    }

    if (op === 'push-test' && req.method === 'POST') {
      const raw = (await redis(['HGET', hash, id])) as string | null;
      if (!raw) return json({ error: 'unknown_device' }, 404);
      webpush.setVapidDetails(env('VAPID_SUBJECT') ?? new URL(req.url).origin, env('VAPID_PUBLIC_KEY')!, env('VAPID_PRIVATE_KEY')!);
      try {
        await webpush.sendNotification(
          JSON.parse(raw).sub,
          JSON.stringify({ title: 'GREmlin', body: 'Les rappels fonctionnent ✓', url: '/', tag: 'test' }),
          { TTL: 60 },
        );
        return json({ ok: true });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await redis(['HDEL', hash, id]); // abonnement expiré
        return json({ error: 'push_failed', status }, status === 404 || status === 410 ? 410 : 502);
      }
    }
  } catch {
    return json({ error: 'storage' }, 502);
  }
  return json({ error: 'not_found' }, 404);
}

async function login(req: Request): Promise<Response> {
  const clientId = env('GOOGLE_CLIENT_ID');
  const key = secretKey();
  if (!clientId || !key) return json({ error: 'not_configured' }, 503);
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return json({ error: 'missing_credential' }, 400);

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    if (!payload.sub || payload.email_verified !== true) return json({ error: 'unverified' }, 401);
    const user: User = {
      id: payload.sub,
      name: String(payload.name ?? payload.email ?? ''),
      picture: String(payload.picture ?? ''),
      email: String(payload.email ?? ''),
    };
    const session = await new SignJWT({ name: user.name, picture: user.picture, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_SECONDS}s`)
      .sign(key);
    const secure = new URL(req.url).protocol === 'https:';
    return json({ user }, 200, { 'Set-Cookie': cookie(session, SESSION_SECONDS, secure) });
  } catch {
    return json({ error: 'invalid_credential' }, 401);
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const op = url.searchParams.get('op');

    if (op === 'me' && req.method === 'GET') {
      return json({
        clientId: env('GOOGLE_CLIENT_ID') && secretKey() ? env('GOOGLE_CLIENT_ID') : null,
        sync: !!redisConfig(),
        push: pushConfigured() ? env('VAPID_PUBLIC_KEY') : null, // clé publique : sert à s'abonner
        user: await sessionUser(req),
        // diagnostic : quelles variables le serveur voit (jamais leurs valeurs)
        missing: [!env('GOOGLE_CLIENT_ID') && 'GOOGLE_CLIENT_ID', !env('SESSION_SECRET') && 'SESSION_SECRET'].filter(Boolean),
        missingPush: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'CRON_SECRET'].filter((k) => !env(k)),
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      if (!sameOriginJson(req)) return json({ error: 'forbidden' }, 403);
    }

    if (op === 'login' && req.method === 'POST') return login(req);

    if (op === 'logout' && req.method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, url.protocol === 'https:') });
    }

    if (op?.startsWith('push-')) {
      const user = await sessionUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      return pushOps(op, req, user);
    }

    if (op === 'load' || op === 'save') {
      const user = await sessionUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      if (!redisConfig()) return json({ error: 'not_configured' }, 503);
      const key = `progress:${user.id}`;
      try {
        if (op === 'load' && req.method === 'GET') {
          const raw = (await redis(['GET', key])) as string | null;
          return json({ progress: raw ? JSON.parse(raw) : null });
        }
        if (op === 'save' && req.method === 'PUT') {
          const text = await req.text();
          if (text.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
          const { progress } = JSON.parse(text) as { progress?: unknown };
          if (!validProgress(progress)) return json({ error: 'invalid' }, 400);
          await redis(['SET', key, JSON.stringify(progress)]);
          return json({ ok: true });
        }
      } catch {
        return json({ error: 'storage' }, 502);
      }
    }

    return json({ error: 'not_found' }, 404);
  },
};
