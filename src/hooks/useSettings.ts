import { useCallback, useEffect, useState } from 'react';
import { applySettings, loadSettings, saveSettings, type Settings } from '../lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    applySettings(s); // avant le premier rendu : pas de flash de thème
    return s;
  });

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      applySettings(next);
      return next;
    });
  }, []);

  // thème « auto » : suit le changement de l'appareil en direct
  useEffect(() => {
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applySettings(settings);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings]);

  return { settings, update };
}
