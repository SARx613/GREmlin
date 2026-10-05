import type { Word } from '../../types';
import WordCard from '../WordCard';

export default function Intro({ word }: { word: Word }) {
  return (
    <div>
      <p className="mb-4 text-sm font-extrabold uppercase tracking-wide text-blue-ink">Nouveau mot</p>
      <WordCard word={word} />
    </div>
  );
}
