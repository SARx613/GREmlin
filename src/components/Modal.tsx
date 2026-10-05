import { useEffect, type ReactNode } from 'react';

/** Fenêtre centrée ; se ferme avec Échap ou en cliquant à côté. */
export default function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-full w-full max-w-[560px] overflow-y-auto rounded-xl2 bg-surface p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
