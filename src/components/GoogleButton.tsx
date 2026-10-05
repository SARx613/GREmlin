import { useEffect, useRef, useState } from 'react';

type GoogleId = {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let loading: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null; // permet de réessayer plus tard
      reject(new Error('gsi'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

type Props = { clientId: string; onCredential: (credential: string) => Promise<boolean> };

/** Bouton officiel « Se connecter avec Google » (Google Identity Services). */
export default function GoogleButton({ clientId, onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        const id = window.google?.accounts.id;
        if (cancelled || !id || !ref.current) return;
        id.initialize({
          client_id: clientId,
          callback: async (r) => setDenied(!(await onCredential(r.credential))),
        });
        id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'fr', width: 260 });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential]);

  if (failed) return <p className="text-sm text-muted">Connexion Google indisponible (hors ligne ?).</p>;
  return (
    <div>
      <div ref={ref} className="min-h-[44px]" />
      {denied && <p className="mt-2 text-sm text-red-ink">La connexion a échoué. Réessaie.</p>}
    </div>
  );
}
