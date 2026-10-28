import { Plus, Volume2 } from 'lucide-react';
import { useMemo } from 'react';
import { data } from '../lib/data';
import { tokenize } from '../lib/lexicon';
import { speak } from '../lib/speak';
import type { Word } from '../types';

type Props = {
  text: string;
  /** Mot à ne pas souligner (la réponse). */
  skipId?: string;
  /** Mot à mettre en valeur (la réponse, une fois révélée). */
  highlight?: string;
  activeId?: string | null;
  onWord: (id: string) => void;
  className?: string;
};

/** Phrase dont chaque mot du vocabulaire GRE est cliquable (pointillés) pour en voir la définition. */
export default function RichSentence({ text, skipId, highlight, activeId, onWord, className = '' }: Props) {
  const pieces = useMemo(() => tokenize(text, data, skipId), [text, skipId]);
  return (
    <p className={className}>
      {pieces.map((p, i) =>
        highlight && p.text.toLowerCase() === highlight.toLowerCase() ? (
          <strong key={i} className="font-extrabold text-green-ink">
            {p.text}
          </strong>
        ) : p.wordId ? (
          <button
            key={i}
            type="button"
            onClick={() => onWord(p.wordId!)}
            className={`rounded border-b-2 border-dotted px-0.5 font-bold transition-colors duration-150 ${
              activeId === p.wordId ? 'border-blue bg-blue-light text-blue-ink' : 'border-blue text-ink hover:bg-blue-light'
            }`}
          >
            {p.text}
          </button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

type LookupProps = {
  word: Word;
  /** Proposé seulement pour un mot pas encore trié : l'ajoute à la pile « à apprendre ». */
  onLearn?: () => void;
  learned?: boolean;
};

/** Mini-fiche d'un mot touché dans une phrase. */
export function WordLookup({ word, onLearn, learned }: LookupProps) {
  return (
    <div className="mt-4 rounded-xl2 border-2 border-blue bg-blue-light p-3 text-blue-ink" aria-live="polite">
      <div className="flex items-center gap-2">
        <p className="text-lg font-extrabold">{word.word}</p>
        <span className="text-sm italic">{word.pos}</span>
        <button type="button" onClick={() => speak(word.word)} aria-label={`Écouter « ${word.word} »`} className="rounded-lg p-1 hover:bg-surface/40">
          <Volume2 size={18} />
        </button>
        {onLearn && !learned && (
          <button type="button" onClick={onLearn} className="ml-auto flex items-center gap-1 rounded-lg border-2 border-current px-2 py-0.5 text-xs font-extrabold uppercase hover:bg-surface/40">
            <Plus size={14} /> À apprendre
          </button>
        )}
        {learned && <span className="ml-auto text-xs font-extrabold uppercase">Ajouté</span>}
      </div>
      <p className="font-bold">{word.definitionFr}</p>
      <p className="text-sm">{word.definition}</p>
    </div>
  );
}
