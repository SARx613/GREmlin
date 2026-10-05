import type { ReactNode } from 'react';
import Button from './Button';

type Props = {
  show: boolean;
  ok: boolean;
  title: string;
  children?: ReactNode;
  onContinue: () => void;
};

/** Barre qui monte du bas après chaque réponse : verte si juste, rouge sinon. */
export default function FeedbackBar({ show, ok, title, children, onContinue }: Props) {
  return (
    <div
      aria-live="polite"
      className={`absolute inset-x-0 bottom-0 transition-transform duration-150 ${show ? 'translate-y-0' : 'translate-y-full'} ${
        ok ? 'bg-green-light' : 'bg-red-light'
      }`}
    >
      <div className="mx-auto max-w-[760px] px-3 sm:px-6 pb-6 pt-4">
        <p className={`mb-2 text-xl font-extrabold ${ok ? 'text-green-dark' : 'text-red-dark'}`}>{title}</p>
        <div className={`mb-4 space-y-1 text-sm sm:text-base ${ok ? 'text-green-dark' : 'text-red-dark'}`}>{children}</div>
        <Button variant={ok ? 'green' : 'red'} full onClick={onContinue} tabIndex={show ? 0 : -1}>
          Continuer
        </Button>
      </div>
    </div>
  );
}
