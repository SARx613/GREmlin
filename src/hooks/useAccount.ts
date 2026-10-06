import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMe, loadRemote, login, logout, saveRemote, type User } from '../lib/account';
import { mergeProgress } from '../lib/merge';
import type { Progress } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

/**
 * Compte Google facultatif + synchronisation.
 * Connexion : on fusionne la progression locale et celle du cloud, puis on pousse le résultat.
 * Ensuite : envoi différé à chaque modification, et récupération quand l'app revient au premier plan.
 */
export function useAccount(progress: Progress, replace: (p: Progress) => void) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');

  const latest = useRef(progress);
  latest.current = progress;
  const lastSent = useRef('');
  const ready = useRef(false); // vrai après la première fusion

  const push = useCallback(async (p: Progress) => {
    const body = JSON.stringify(p);
    if (body === lastSent.current) return;
    setStatus('syncing');
    const ok = await saveRemote(p);
    if (ok) lastSent.current = body;
    setStatus(ok ? 'ok' : 'error');
  }, []);

  /** Récupère le cloud, fusionne avec le local, remplace le local si besoin, pousse si le cloud est en retard. */
  const pull = useCallback(async () => {
    setStatus('syncing');
    const res = await loadRemote();
    if (!res.ok) {
      if (res.unauthorized) setUser(null);
      setStatus('error');
      return;
    }
    const local = latest.current;
    const merged = res.progress ? mergeProgress(local, res.progress) : local;
    if (JSON.stringify(merged) !== JSON.stringify(local)) replace(merged);
    ready.current = true;
    if (!res.progress || JSON.stringify(merged) !== JSON.stringify(res.progress)) await push(merged);
    else {
      lastSent.current = JSON.stringify(merged);
      setStatus('ok');
    }
  }, [push, replace]);

  useEffect(() => {
    void fetchMe().then((me) => {
      if (!me) return;
      setClientId(me.clientId);
      setPushKey(me.push);
      if (me.user && me.sync) setUser(me.user);
    });
  }, []);

  // première synchronisation dès qu'on est connecté
  useEffect(() => {
    if (!user) {
      ready.current = false;
      return;
    }
    void pull();
  }, [user, pull]);

  // envoi différé après chaque modification
  useEffect(() => {
    if (!user || !ready.current) return;
    const t = window.setTimeout(() => void push(progress), 1500);
    return () => window.clearTimeout(t);
  }, [progress, user, push]);

  // retour au premier plan : on récupère ce qui a été fait sur un autre appareil
  useEffect(() => {
    if (!user) return;
    const onVisible = () => document.visibilityState === 'visible' && ready.current && void pull();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, pull]);

  const signIn = useCallback(async (credential: string) => {
    const u = await login(credential);
    if (u) setUser(u);
    return !!u;
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus('idle');
  }, []);

  /** Après « Réinitialiser » : écrase le cloud avec l'état vide (sinon la fusion ramènerait les anciens mots). */
  const overwrite = useCallback(
    async (p: Progress) => {
      if (user) await push(p);
    },
    [user, push],
  );

  return { clientId, pushKey, user, status, signIn, signOut, overwrite };
}
