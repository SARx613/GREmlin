import { ArrowLeft, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import { SpeakButton } from '../components/WordCard';
import { data } from '../lib/data';
import { speak } from '../lib/speak';
import { getWP, isNew, markKnown, markUnknown } from '../lib/srs';
import type { Progress, WordProgress } from '../types';

type Props = {
  chapterId: string;
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  onBack: () => void;
};

/** Tri initial : « je connais » (boîte 4, revient dans 8 jours) ou « je ne connais pas » (prioritaire). */
export default function Triage({ chapterId, progress, update, onBack }: Props) {
  const chapter = data.chapters.find((c) => c.id === chapterId)!;
  // mots à trier, figés à l'ouverture de l'écran
  const [ids] = useState(() =>
    chapter.wordIds.filter((id) => {
      const wp = getWP(progress.words, id);
      return isNew(wp) && wp.known === undefined;
    }),
  );
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; prev: WordProgress | undefined }[]>([]);
  const [known, setKnown] = useState(0);

  const id = ids[index];
  const word = id ? data.words[id] : null;

  useEffect(() => {
    if (word && progress.sound) speak(word.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function answer(knows: boolean) {
    if (!id) return;
    const prev = progress.words[id];
    const now = Date.now();
    update((p) => {
      const cur = getWP(p.words, id);
      return { ...p, words: { ...p.words, [id]: knows ? markKnown(cur, now) : markUnknown(cur) } };
    });
    setHistory((h) => [...h, { id, prev }]);
    setKnown((k) => k + (knows ? 1 : 0));
    setIndex(index + 1);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    update((p) => {
      const words = { ...p.words };
      if (last.prev) words[last.id] = last.prev;
      else delete words[last.id];
      return { ...p, words };
    });
    if (progress.words[last.id]?.known) setKnown((k) => k - 1);
    setHistory((h) => h.slice(0, -1));
    setIndex(index - 1);
  }

  // ← je ne connais pas · → je connais
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!word) return;
      if (e.key === 'ArrowRight') answer(true);
      else if (e.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex min-h-full flex-col pb-8">
      <header className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={28} />
        </button>
        <h1 className="flex-1 text-xl font-extrabold text-ink">Trier · {chapter.title}</h1>
        {ids.length > 0 && (
          <span className="font-bold text-muted">
            {Math.min(index + 1, ids.length)} / {ids.length}
          </span>
        )}
      </header>

      {!word ? (
        <div className="my-auto text-center">
          <p className="mb-2 text-2xl font-extrabold text-ink">{ids.length ? 'Tri terminé !' : 'Rien à trier'}</p>
          <p className="mb-6 text-muted">
            {ids.length
              ? `${known} mot${known > 1 ? 's' : ''} connu${known > 1 ? 's' : ''}, ${ids.length - known} à apprendre en priorité.`
              : 'Tous les mots de ce chapitre ont déjà été triés.'}
          </p>
          <div className="mx-auto grid max-w-xs gap-3">
            <Button full onClick={onBack}>
              Retour au chapitre
            </Button>
            {history.length > 0 && (
              <Button full variant="white" onClick={undo}>
                Annuler le dernier
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="my-auto rounded-xl2 border-2 border-b-4 border-line px-6 py-12 text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="text-[32px] font-extrabold text-ink">{word.word}</p>
              <SpeakButton text={word.word} />
            </div>
            <p className="text-sm font-bold italic text-muted">{word.pos}</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button variant="red" onClick={() => answer(false)}>
              Je ne connais pas
            </Button>
            <Button onClick={() => answer(true)}>Je connais</Button>
          </div>
          <p className="mt-3 hidden text-center text-sm text-muted sm:block">Raccourcis : ← je ne connais pas · → je connais</p>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="mx-auto mt-4 flex items-center gap-1 font-bold text-blue-ink disabled:text-dtext"
          >
            <Undo2 size={16} /> Annuler
          </button>
        </>
      )}
    </div>
  );
}
