import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PUSH_PREFS, pushCall, type PushPrefs, type User } from '../lib/account';

export type PushStatus =
  | 'unsupported' // navigateur sans notifications (ou mode développement)
  | 'ios-install' // iPhone/iPad : il faut d'abord installer l'app sur l'écran d'accueil
  | 'login' // il faut un compte
  | 'unavailable' // serveur non configuré
  | 'denied' // permission refusée dans le navigateur
  | 'off' // possible, pas encore activé sur cet appareil
  | 'on';

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const canPush = () =>
  import.meta.env.PROD && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Rappels : abonnement de cet appareil + préférences, enregistrés côté serveur (compte Google requis). */
export function usePush(user: User | null, vapidKey: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(() => ('Notification' in window ? Notification.permission : 'denied'));
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  let status: PushStatus = 'off';
  if (isIos() && !isStandalone()) status = 'ios-install';
  else if (!canPush()) status = 'unsupported';
  else if (!user) status = 'login';
  else if (!vapidKey) status = 'unavailable';
  else if (permission === 'denied') status = 'denied';
  else if (prefs) status = 'on';

  // état de cet appareil : abonné ? quelles préférences ?
  useEffect(() => {
    if (!user || !vapidKey || !canPush() || Notification.permission !== 'granted') {
      setPrefs(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const sub = await currentSubscription();
      if (!sub) return setPrefs(null);
      const res = await pushCall('push-get', { endpoint: sub.endpoint });
      if (!cancelled) setPrefs(res.ok ? (res.data.prefs ?? null) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, vapidKey]);

  const save = useCallback(async (sub: PushSubscription, next: PushPrefs) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const res = await pushCall('push-save', { subscription: sub.toJSON(), prefs: next, tz }, 'PUT');
    if (!res.ok) setMessage(res.data.error === 'too_many_devices' ? 'Maximum 5 appareils : désactive-en un autre.' : "Impossible d'enregistrer les rappels pour le moment.");
    return res.ok;
  }, []);

  const enable = useCallback(async () => {
    if (!vapidKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await Notification.requestPermission(); // doit venir d'un clic
      setPermission(result);
      if (result !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidKey) }));
      if (await save(sub, DEFAULT_PUSH_PREFS)) setPrefs(DEFAULT_PUSH_PREFS);
    } catch {
      setMessage("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }, [vapidKey, save]);

  const update = useCallback(
    async (patch: Partial<PushPrefs>) => {
      if (!prefs) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      const sub = await currentSubscription();
      if (sub) await save(sub, next);
    },
    [prefs, save],
  );

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await pushCall('push-remove', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setPrefs(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await currentSubscription();
      const res = sub ? await pushCall('push-test', { endpoint: sub.endpoint }) : null;
      setMessage(res?.ok ? 'Notification envoyée : regarde ton appareil.' : "L'envoi a échoué. Désactive puis réactive les rappels.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, prefs, busy, message, enable, update, disable, test };
}
