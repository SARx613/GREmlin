import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import WordCard from '../components/WordCard';
import { data } from '../lib/data';
import { MAX_SELECTION } from '../lib/session';
import { dueIds, getWP, isNew, masteredCount, newIds, statusOf } from '../lib/srs';
import type { LessonConfig, Progress } from '../types';

const DOT = { new: 'bg-[#CFCFCF]', learning: 'bg-orange', mastered: 'bg-green' };
const DOT_LABEL = { new: 'nouveau', learning: 'en cours', mastered: 'maîtrisé' };

type Props = {
  chapterId: string;
  progress: Progress;
  onBack: () => void;
  onStart: (config: LessonConfig) => void;
  onTriage: () => void;
};

export default function Chapter({ chapterId, progress, onBack, onStart, onTriage }: Props) {
  const chapter = data.chapters.find((c) => c.id === chapterId)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();

  const toStudy = dueIds(chapter.wordIds, progress.words, now).length + newIds(chapter.wordIds, progress.words).length;
  const untriaged = chapter.wordIds.filter((id) => {
    const wp = getWP(progress.words, id);
    return isNew(wp) && wp.known === undefined;
  }).length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="pb-16">
      <header className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={28} />
        </button>
        <div className="flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{chapter.group}</p>
          <h1 className="text-2xl font-extrabold text-ink">{chapter.title}</h1>
        </div>
      </header>

      <ProgressBar thin value={masteredCount(chapter.wordIds, progress.words) / chapter.wordIds.length} />

      <div className="mt-6 grid gap-3">
        <Button full onClick={() => onStart({ mode: 'chapter', chapterId })}>
          {toStudy ? 'Commencer une leçon' : 'Entraînement libre'}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="white" className="!px-3 !text-sm" disabled={untriaged === 0} onClick={onTriage}>
            Trier les mots
          </Button>
          <Button variant="white" className="!px-3 !text-sm" disabled={selected.length === 0} onClick={() => onStart({ mode: 'selection', wordIds: selected })}>
            Leçon sur ma sélection{selected.length ? ` (${Math.min(selected.length, MAX_SELECTION)})` : ''}
          </Button>
        </div>
        {selected.length > MAX_SELECTION && <p className="text-sm text-muted">Une leçon porte sur {MAX_SELECTION} mots maximum : les {MAX_SELECTION} premiers cochés.</p>}
      </div>

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{chapter.wordIds.length} mots</h2>
        <button
          type="button"
          className="text-sm font-bold text-blue"
          onClick={() => setSelected(selected.length ? [] : chapter.wordIds)}
        >
          {selected.length ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
        {chapter.wordIds.map((id) => {
          const w = data.words[id];
          const st = statusOf(getWP(progress.words, id));
          return (
            <li key={id} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
                aria-label={`Sélectionner ${w.word}`}
                className="h-5 w-5 shrink-0 accent-[#1CB0F6]"
              />
              <button type="button" onClick={() => setOpen(id)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
                <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[st]}`} title={DOT_LABEL[st]} />
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{w.word}</span>
                  <span className="block truncate text-sm text-muted">{w.definitionFr}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <WordCard word={data.words[open]} full />
          <Button full variant="white" className="mt-6" onClick={() => setOpen(null)}>
            Fermer
          </Button>
        </Modal>
      )}
    </div>
  );
}
