import { useCallback, useState } from 'react';
import { clearAll, loadProgress, saveProgress, emptyState } from '../lib/storage';
import type { Progress } from '../types';

/** Progression globale : état React + écriture immédiate dans localStorage. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const replace = useCallback((p: Progress) => {
    saveProgress(p);
    setProgress(p);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setProgress(emptyState());
  }, []);

  return { progress, update, replace, reset };
}
