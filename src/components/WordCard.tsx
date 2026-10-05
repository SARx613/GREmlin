import { Lightbulb, Volume2 } from 'lucide-react';
import { splitAround } from '../lib/match';
import { speak } from '../lib/speak';
import type { Word } from '../types';

/** Phrase avec la forme du mot en gras. */
export function Sentence({ text, word, className = '' }: { text: string; word: string; className?: string }) {
  const parts = splitAround(text, word);
  return (
    <p className={className}>
      {parts ? (
        <>
          {parts[0]}
          <strong className="font-extrabold text-ink">{parts[1]}</strong>
          {parts[2]}
        </>
      ) : (
        text
      )}
    </p>
  );
}

export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`Écouter « ${text} »`}
      className={`rounded-xl2 p-2 text-blue-ink transition-colors duration-150 hover:bg-blue-light ${className}`}
    >
      <Volume2 size={26} />
    </button>
  );
}

/** Carte d'un mot : intro (1 phrase) ou fiche complète (2 phrases). */
export default function WordCard({ word, full }: { word: Word; full?: boolean }) {
  const sentences = full ? word.sentences : word.sentences.slice(0, 1);
  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-[32px] font-extrabold leading-tight text-ink">{word.word}</h2>
        <SpeakButton text={word.word} />
      </div>
      <p className="mb-4 text-sm font-bold italic text-muted">{word.pos}</p>
      <p className="text-lg font-bold text-ink">{word.definition}</p>
      <p className="mb-4 text-lg text-blue-ink">{word.definitionFr}</p>
      {sentences.map((s) => (
        <Sentence key={s} text={s} word={word.word} className="mb-2 border-l-4 border-line pl-3 text-base text-muted" />
      ))}
      <div className="mt-4 flex flex-wrap gap-2">
        {word.synonyms.map((s) => (
          <span key={s} className="rounded-full border-2 border-line px-3 py-1 text-sm font-bold text-muted">
            {s}
          </span>
        ))}
      </div>
      {word.mnemonic && (
        <p className="mt-4 flex gap-2 rounded-xl2 bg-tip p-3 text-sm text-ink">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-orange-ink" />
          {word.mnemonic}
        </p>
      )}
    </div>
  );
}
