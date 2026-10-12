import { useCallback, useEffect, useState } from 'react';

export type OfflineState = 'checking' | 'ready' | 'unavailable';

/** Vrai quand le service worker a téléchargé toute l'app (l'installation échoue tant que tout n'est pas en cache). */
export function useOffline() {
  const supported = 'serviceWorker' in navigator && import.meta.env.PROD;
  const [state, setState] = useState<OfflineState>(supported ? 'checking' : 'unavailable');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then(async () => {
      const keys = await caches.keys();
      if (!cancelled) setState(keys.some((k) => k.startsWith('gremlin-')) ? 'ready' : 'unavailable');
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  /** Cherche une nouvelle version et la télécharge (la page propose ensuite d'actualiser). */
  const refresh = useCallback(async () => {
    setUpdating(true);
    try {
      await (await navigator.serviceWorker.getRegistration())?.update();
    } catch {
      /* hors ligne : on garde la version déjà téléchargée */
    }
    setUpdating(false);
  }, []);

  return { state, refresh, updating, online: navigator.onLine };
}
