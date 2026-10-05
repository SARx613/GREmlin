import { useEffect, useRef } from 'react';
import type { TypeExercise, Word } from '../../types';

type Props = {
  ex: TypeExercise;
  word: Word;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
};

/** Saisie du mot à partir de sa définition et de sa première lettre. */
export default function TypeWord({ ex, word, value, onChange, locked }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [ex]);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-extrabold text-ink">Écris le mot</h2>
      <p className="text-xl font-bold text-ink">{ex.prompt}</p>
      <p className="mb-6 text-lg text-blue-ink">{word.definitionFr}</p>
      <p className="mb-3 font-mono text-2xl tracking-widest text-muted" aria-label="Indice">
        {ex.hint}
      </p>
      <input
        ref={ref}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Tape le mot en anglais"
        className="w-full rounded-xl2 border-2 border-line bg-soft px-4 py-3 text-xl font-bold text-ink outline-none transition-colors duration-150 focus:border-blue"
      />
    </div>
  );
}
