import type { Progress } from '../types';
import { parseProgress } from './storage';

export type User = { id: string; name: string; picture: string; email: string };
export type Me = { clientId: string | null; sync: boolean; push: string | null; user: User | null; missing?: string[]; missingPush?: string[] };

export type PushPrefs = { reminder: boolean; reminderTime: string; surprise: number; from: string; to: string };
export const DEFAULT_PUSH_PREFS: PushPrefs = { reminder: true, reminderTime: '19:00', surprise: 3, from: '09:00', to: '21:00' };

const API = '/api/account';

async function call(op: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${API}?op=${op}`, {
      credentials: 'same-origin',
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    return null; // hors ligne
  }
}

/** null = pas d'API (dev local, hors ligne…) : l'app fonctionne alors sans compte. */
export async function fetchMe(): Promise<Me | null> {
  const res = await call('me');
  if (!res?.ok) return null;
  try {
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export async function login(credential: string): Promise<User | null> {
  const res = await call('login', { method: 'POST', body: JSON.stringify({ credential }) });
  if (!res?.ok) return null;
  return ((await res.json()) as { user: User }).user;
}

export async function logout(): Promise<void> {
  await call('logout', { method: 'POST', body: '{}' });
}

export type Loaded = { ok: true; progress: Progress | null } | { ok: false; unauthorized: boolean };

export async function loadRemote(): Promise<Loaded> {
  const res = await call('load');
  if (!res) return { ok: false, unauthorized: false };
  if (!res.ok) return { ok: false, unauthorized: res.status === 401 };
  const { progress } = (await res.json()) as { progress: unknown };
  return { ok: true, progress: progress ? parseProgress(progress) : null };
}

export async function saveRemote(progress: Progress): Promise<boolean> {
  const res = await call('save', { method: 'PUT', body: JSON.stringify({ progress }) });
  return !!res?.ok;
}

// --- Rappels (notifications push) -------------------------------------------------

export type PushResult = { ok: boolean; status: number; data: { prefs?: PushPrefs | null; error?: string } };

/** Appel d'une opération « push-… » ; ok = false avec le statut HTTP en cas d'échec (0 = hors ligne). */
export async function pushCall(op: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<PushResult> {
  const res = await call(op, { method, body: JSON.stringify(body) });
  if (!res) return { ok: false, status: 0, data: {} };
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}
