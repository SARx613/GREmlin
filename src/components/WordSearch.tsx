import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { data } from '../lib/data';
import { getWP, statusOf } from '../lib/srs';
import type { Progress, Word } from '../types';
import Button from './Button';
import Modal from './Modal';
import WordCard from './WordCard';

const DOT = { new: 'bg-dborder', learning: 'bg-orange', mastered: 'bg-green' };

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Recherche dans les 511 mots : mot, définition anglaise ou traduction française. */
export default function WordSearch({ progress, openId }: { progress: Progress; openId?: string | null }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Word | null>(openId ? (data.words[openId] ?? null) : null);

  const results = useMemo(() => {
    const needle = strip(q.trim());
    if (needle.length < 2) return [];
    const words = Object.values(data.words);
    const starts = words.filter((w) => strip(w.word).startsWith(needle));
    const others = words.filter(
      (w) => !strip(w.word).startsWith(needle) && (strip(w.word).includes(needle) || strip(w.definitionFr).includes(needle) || strip(w.definition).includes(needle)),
    );
    return [...starts, ...others].slice(0, 20);
  }, [q]);

  return (
    <div className="mt-6">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un mot ou une traduction"
          aria-label="Rechercher un mot"
          className="w-full rounded-xl2 border-2 border-line bg-soft py-3 pl-10 pr-10 font-bold text-ink outline-none transition-colors duration-150 placeholder:font-normal focus:border-blue"
        />
        {q && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <X size={18} />
          </button>
        )}
      </div>

      {q.trim().length >= 2 && (
        <ul className="mt-3 divide-y-2 divide-line rounded-xl2 border-2 border-line">
          {results.length === 0 && <li className="px-4 py-3 text-muted">Aucun résultat.</li>}
          {results.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => setOpen(w)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-soft">
                <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[statusOf(getWP(progress.words, w.id))]}`} />
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{w.word}</span>
                  <span className="block truncate text-sm text-muted">{w.definitionFr}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <WordCard word={open} full />
          <Button full variant="white" className="mt-6" onClick={() => setOpen(null)}>
            Fermer
          </Button>
        </Modal>
      )}
    </div>
  );
}
