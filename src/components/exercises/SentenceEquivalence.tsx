import { MULTI_SEP } from '../../lib/exercises';
import type { MultiExercise } from '../../types';

type Props = {
  ex: MultiExercise;
  value: string; // ids cochés, séparés par « | »
  onChange: (v: string) => void;
  locked: boolean;
};

/** Sentence Equivalence : choisis les 2 mots qui donnent à la phrase le même sens. */
export default function SentenceEquivalence({ ex, value, onChange, locked }: Props) {
  const picked = value.split(MULTI_SEP).filter(Boolean);

  function toggle(id: string) {
    if (locked) return;
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 2 ? [...picked, id] : [picked[1], id];
    onChange(next.join(MULTI_SEP));
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-extrabold text-ink">Choisis 2 mots</h2>
      <p className="mb-6 text-muted">Les deux mots doivent donner à la phrase le même sens.</p>
      <p className="mb-6 text-xl leading-relaxed text-ink sm:text-2xl">{ex.prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ex.options.map((o, i) => {
          const selected = picked.includes(o.id);
          const right = ex.answerIds.includes(o.id);
          let style = 'border-line text-ink hover:bg-soft';
          if (selected) style = 'border-blue bg-blue-light text-blue-ink';
          if (locked && right) style = 'border-green bg-green-light text-green-ink';
          else if (locked && selected) style = 'border-red bg-red-light text-red-ink';
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              aria-pressed={selected}
              onClick={() => toggle(o.id)}
              className={`flex items-center gap-3 rounded-xl2 border-2 border-b-4 px-3 py-3 text-left text-lg font-bold transition-colors duration-150 sm:px-4 sm:text-xl ${style}`}
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
