import { ArrowLeft, Star } from 'lucide-react';
import { useState } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import WordCard from '../components/WordCard';
import { data } from '../lib/data';
import { MAX_SELECTION } from '../lib/session';
import { dueIds, getWP, isLeech, isNew, masteredCount, newIds, statusOf } from '../lib/srs';
import type { LessonConfig, Progress } from '../types';

const DOT = { new: 'bg-dborder', learning: 'bg-orange', mastered: 'bg-green' };
const DOT_LABEL = { new: 'nouveau', learning: 'en cours', mastered: 'maîtrisé' };

type Filter = 'all' | 'new' | 'learning' | 'mastered' | 'hard' | 'fav';
const FILTERS: { id: Filter; text: string }[] = [
  { id: 'all', text: 'Tous' },
  { id: 'new', text: 'Nouveaux' },
  { id: 'learning', text: 'En cours' },
  { id: 'mastered', text: 'Maîtrisés' },
  { id: 'hard', text: 'Difficiles' },
  { id: 'fav', text: '★ Favoris' },
];

type Props = {
  chapterId: string;
  progress: Progress;
  onBack: () => void;
  onStart: (config: LessonConfig) => void;
  onTriage: () => void;
  onToggleStar: (id: string) => void;
};

export default function Chapter({ chapterId, progress, onBack, onStart, onTriage, onToggleStar }: Props) {
  const chapter = data.chapters.find((c) => c.id === chapterId)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();

  const toStudy = dueIds(chapter.wordIds, progress.words, now).length + newIds(chapter.wordIds, progress.words).length;
  const untriaged = chapter.wordIds.filter((id) => {
    const wp = getWP(progress.words, id);
    return isNew(wp) && wp.known === undefined;
  }).length;
  const shown = chapter.wordIds.filter((id) => {
    const wp = getWP(progress.words, id);
    if (filter === 'fav') return !!progress.starred?.includes(id);
    return filter === 'all' || (filter === 'hard' ? isLeech(wp) : statusOf(wp) === filter);
  });
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
          {chapter.subtitle && <p className="text-sm text-muted">{chapter.subtitle}</p>}
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

      <div role="radiogroup" aria-label="Filtrer les mots" className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors duration-150 ${
              filter === f.id ? 'border-blue bg-blue-light text-blue-ink' : 'border-line text-muted hover:bg-soft'
            }`}
          >
            {f.text}
          </button>
        ))}
      </div>

      <div className="mb-2 mt-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
          {filter === 'all' ? `${chapter.wordIds.length} mots` : `${shown.length} / ${chapter.wordIds.length} mots`}
        </h2>
        <button
          type="button"
          className="text-sm font-bold text-blue-ink"
          onClick={() => setSelected(selected.length ? [] : chapter.wordIds)}
        >
          {selected.length ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
        {shown.length === 0 && <li className="px-4 py-3 text-muted">Aucun mot dans cette catégorie.</li>}
        {shown.map((id) => {
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
                {progress.starred?.includes(id) && <Star size={16} fill="currentColor" className="ml-auto shrink-0 text-orange-ink" aria-label="Favori" />}
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <WordCard word={data.words[open]} full starred={progress.starred?.includes(open)} onToggleStar={() => onToggleStar(open)} />
          <Button full variant="white" className="mt-6" onClick={() => setOpen(null)}>
            Fermer
          </Button>
        </Modal>
      )}
    </div>
  );
}
