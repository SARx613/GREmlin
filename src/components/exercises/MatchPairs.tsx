import { useEffect, useRef, useState } from 'react';
import { speak } from '../../lib/speak';
import type { PairsExercise, WordsData } from '../../types';

type Props = {
  ex: PairsExercise;
  data: WordsData;
  /** Appelé quand toutes les paires sont trouvées, avec un id de mot par erreur commise. */
  onComplete: (wrongWordIds: string[]) => void;
};

/** 5 mots à gauche, 5 définitions à droite : on associe en touchant (dans n'importe quel ordre). */
export default function MatchPairs({ ex, data, onComplete }: Props) {
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ l: string; r: string } | null>(null);
  const wrong = useRef<string[]>([]);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function resolve(l: string, r: string) {
    setLeft(null);
    setRight(null);
    if (l === r) {
      const next = [...matched, l];
      setMatched(next);
      if (next.length === ex.wordIds.length) onComplete(wrong.current);
      return;
    }
    wrong.current = [...wrong.current, l, r];
    setFlash({ l, r });
    timer.current = window.setTimeout(() => setFlash(null), 450);
  }

  function pickLeft(id: string) {
    if (matched.includes(id) || flash) return;
    speak(data.words[id].word);
    if (right) resolve(id, right);
    else setLeft(id);
  }

  function pickRight(id: string) {
    if (matched.includes(id) || flash) return;
    if (left) resolve(left, id);
    else setRight(id);
  }

  const cls = (id: string, side: 'l' | 'r', selected: boolean) => {
    if (matched.includes(id)) return 'border-green bg-green-light text-green-ink opacity-60';
    if (flash && (side === 'l' ? flash.l : flash.r) === id) return 'border-red bg-red-light text-red-ink';
    if (selected) return 'border-blue bg-blue-light text-blue-ink';
    return 'border-line text-ink hover:bg-soft';
  };
  const base = 'rounded-xl2 border-2 border-b-4 px-3 py-3 text-left font-bold transition-colors duration-150';

  return (
    <div>
      <h2 className="mb-6 text-2xl font-extrabold text-ink">Associe les paires</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid content-start gap-3">
          {ex.wordIds.map((id) => (
            <button key={id} type="button" onClick={() => pickLeft(id)} className={`${base} text-lg ${cls(id, 'l', left === id)}`}>
              {data.words[id].word}
            </button>
          ))}
        </div>
        <div className="grid content-start gap-3">
          {ex.defs.map((d) => (
            <button key={d.wordId} type="button" onClick={() => pickRight(d.wordId)} className={`${base} text-base ${cls(d.wordId, 'r', right === d.wordId)}`}>
              {d.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
