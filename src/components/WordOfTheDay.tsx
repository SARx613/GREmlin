import { useState } from 'react';
import { data } from '../lib/data';
import { wordOfTheDay } from '../lib/daily';
import type { Progress } from '../types';
import Button from './Button';
import Modal from './Modal';
import WordCard, { SpeakButton } from './WordCard';

type Props = { progress: Progress; onToggleStar: (id: string) => void };

/** Carte « Mot du jour » de l'accueil : un coup d'œil suffit pour apprendre un mot de plus. */
export default function WordOfTheDay({ progress, onToggleStar }: Props) {
  const [open, setOpen] = useState(false);
  const word = data.words[wordOfTheDay(data, Date.now())];

  return (
    <section className="mt-6 rounded-xl2 bg-tip p-4" aria-label="Mot du jour">
      <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-orange-ink">Mot du jour</p>
      <div className="flex items-center gap-2">
        <h2 className="text-3xl font-extrabold text-ink">{word.word}</h2>
        <SpeakButton text={word.word} />
        <span className="text-sm font-bold italic text-muted">{word.pos}</span>
      </div>
      <p className="font-bold text-ink">{word.definition}</p>
      <p className="mb-3 text-blue-ink">{word.definitionFr}</p>
      <Button variant="white" className="!py-2 !text-sm" onClick={() => setOpen(true)}>
        Voir la fiche
      </Button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <WordCard word={word} full starred={progress.starred?.includes(word.id)} onToggleStar={() => onToggleStar(word.id)} />
          <Button full variant="white" className="mt-6" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </Modal>
      )}
    </section>
  );
}
