import { useEffect, useState } from 'react';
import { STORAGE_ERROR_EVENT, storageWorks } from '../lib/storage';

/** Bandeaux d'information : stockage indisponible, nouvelle version de l'app. */
export default function Notices() {
  const [storageBroken, setStorageBroken] = useState(() => !storageWorks());
  const [update, setUpdate] = useState(false);

  useEffect(() => {
    const onStorage = () => setStorageBroken(true);
    const onUpdate = () => setUpdate(true);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorage);
    window.addEventListener('gre-update', onUpdate);
    return () => {
      window.removeEventListener(STORAGE_ERROR_EVENT, onStorage);
      window.removeEventListener('gre-update', onUpdate);
    };
  }, []);

  if (!storageBroken && !update) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-30 space-y-1 p-2" role="status">
      {storageBroken && (
        <p className="mx-auto max-w-[760px] rounded-xl2 bg-red-light px-4 py-2 text-sm font-bold text-red-ink">
          Ton navigateur bloque l'enregistrement (navigation privée ?) : ta progression sera perdue en quittant. Exporte-la dans les réglages.
        </p>
      )}
      {update && (
        <p className="mx-auto flex max-w-[760px] items-center justify-between gap-3 rounded-xl2 bg-blue-light px-4 py-2 text-sm font-bold text-blue-ink">
          Une nouvelle version est disponible.
          <button type="button" className="rounded-xl2 bg-blue px-3 py-1 text-deep" onClick={() => window.location.reload()}>
            Actualiser
          </button>
        </p>
      )}
    </div>
  );
}
