import { Flame } from 'lucide-react';
import { useEffect } from 'react';
import Button from '../components/Button';
import { data } from '../lib/data';
import type { LessonResult } from '../lib/session';

type Props = {
  result: LessonResult;
  streak: number;
  canRepeat: boolean;
  onAgain: () => void;
  onBack: () => void;
};

export default function LessonEnd({ result, streak, canRepeat, onAgain, onBack }: Props) {
  const pct = Math.round(result.accuracy * 100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && onBack();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="pb-16 pt-10 text-center">
      <p className="text-5xl font-extrabold text-green-ink">{pct} %</p>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold text-ink">Leçon terminée !</h1>
      <p className="mb-2 text-muted">de bonnes réponses du premier coup</p>
      {streak > 0 && (
        <p className="mb-6 flex items-center justify-center gap-1 font-extrabold text-orange-ink">
          <Flame size={20} fill="currentColor" /> {streak} {streak > 1 ? 'jours' : 'jour'} de suite
        </p>
      )}

      <div className="mt-6 space-y-6 text-left">
        {result.ups.length > 0 && (
          <WordList title="Ils progressent" color="text-green-ink" ids={result.ups} />
        )}
        {result.rework.length > 0 && <WordList title="À retravailler" color="text-red-ink" ids={result.rework} />}
      </div>

      <div className="mt-10 grid gap-3">
        {canRepeat && (
          <Button full onClick={onAgain}>
            Encore une leçon
          </Button>
        )}
        <Button full variant="white" onClick={onBack}>
          Retour
        </Button>
      </div>
    </div>
  );
}

function WordList({ title, color, ids }: { title: string; color: string; ids: string[] }) {
  return (
    <section>
      <h2 className={`mb-2 text-sm font-extrabold uppercase tracking-wide ${color}`}>{title}</h2>
      <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
        {ids.map((id) => (
          <li key={id} className="px-4 py-2">
            <span className="font-bold text-ink">{data.words[id].word}</span>
            <span className="text-muted"> — {data.words[id].definitionFr}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
