import { useEffect } from 'react';
import { speak } from '../../lib/speak';
import { SpeakButton } from '../WordCard';
import type { ChoiceExercise } from '../../types';

const INSTRUCTION: Record<ChoiceExercise['type'], string> = {
  wordToDef: 'Que signifie ce mot ?',
  defToWord: 'Quel est ce mot ?',
  fillBlank: 'Complète la phrase',
  synonym: 'Choisis le synonyme',
  listen: 'Écoute et choisis la définition',
};

type Props = {
  ex: ChoiceExercise;
  value: string;
  onChange: (id: string) => void;
  /** Après « Vérifier » : on fige les choix et on colore le résultat. */
  locked: boolean;
  /** Son activé : l'exercice d'écoute prononce le mot dès son apparition. */
  autoPlay?: boolean;
};

/** QCM : mot → définition, définition → mot, phrase à trous, synonyme. */
export default function MultipleChoice({ ex, value, onChange, locked, autoPlay }: Props) {
  const showWord = ex.type === 'wordToDef' || ex.type === 'synonym';
  useEffect(() => {
    if (ex.type === 'listen' && autoPlay) speak(ex.prompt);
  }, [ex, autoPlay]);
  return (
    <div>
      <h2 className="mb-6 text-2xl font-extrabold text-ink">{INSTRUCTION[ex.type]}</h2>
      <div className="mb-6 flex items-center gap-2">
        {ex.type === 'listen' ? (
          <>
            <SpeakButton text={ex.prompt} className="!bg-blue-light !p-4" />
            {locked && <p className="text-3xl font-extrabold text-ink">{ex.prompt}</p>}
          </>
        ) : showWord ? (
          <>
            <p className="text-4xl font-extrabold leading-tight text-ink">{ex.prompt}</p>
            <SpeakButton text={ex.prompt} />
          </>
        ) : (
          <p className={ex.type === 'fillBlank' ? 'text-xl leading-relaxed text-ink sm:text-2xl' : 'text-xl font-bold text-ink sm:text-2xl'}>{ex.prompt}</p>
        )}
      </div>
      <div className="grid gap-3">
        {ex.options.map((o, i) => {
          const selected = value === o.id;
          let style = 'border-line text-ink hover:bg-[#F7F7F7]';
          if (selected) style = 'border-blue bg-blue-light text-blue-dark';
          if (locked && o.id === ex.answerId) style = 'border-green bg-green-light text-green-dark';
          else if (locked && selected) style = 'border-red bg-red-light text-red-dark';
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => onChange(o.id)}
              className={`flex items-center gap-3 rounded-xl2 border-2 border-b-4 px-3 py-3 text-left text-lg font-bold sm:px-4 sm:text-xl transition-colors duration-150 ${style}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-sm">{i + 1}</span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
