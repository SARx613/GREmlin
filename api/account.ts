// Compte Google + synchronisation de la progression.
// Une seule fonction, aiguillée par ?op=… :
//   GET  ?op=me      → { clientId, sync, user }
//   POST ?op=login   → { credential } (jeton Google) → cookie de session
//   POST ?op=logout  → efface le cookie
//   GET  ?op=load    → { progress }  (connecté)
//   PUT  ?op=save    → { progress }  (connecté)
//
// Variables d'environnement (Vercel) :
//   GOOGLE_CLIENT_ID, SESSION_SECRET,
//   KV_REST_API_URL + KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';

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
        user: await sessionUser(req),
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      if (!sameOriginJson(req)) return json({ error: 'forbidden' }, 403);
    }

    if (op === 'login' && req.method === 'POST') return login(req);

    if (op === 'logout' && req.method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, url.protocol === 'https:') });
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
