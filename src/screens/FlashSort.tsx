import { ArrowLeft, Check, Undo2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import { Sentence, SpeakButton } from '../components/WordCard';
import { data } from '../lib/data';
import { flashDeck, sortCounts, type DeckKind } from '../lib/flash';
import { speak } from '../lib/speak';
import { getWP, markKnown, markUnknown } from '../lib/srs';
import type { LessonConfig, Progress, WordProgress } from '../types';

type Props = {
  kind: DeckKind;
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  onBack: () => void;
  onGre: () => void;
  onStart: (config: LessonConfig) => void;
};

const SWIPE = 90; // px de glissement pour valider une carte

/**
 * Tri express : tous les mots du GRE en flashcards, une carte à la fois.
 * Glisser (ou ← / →) : « à apprendre » à gauche, « je connais » à droite. Toucher la carte la retourne.
 * `check` : repasse en revue les mots déclarés connus sans qu'aucune leçon ne l'ait vérifié.
 */
export default function FlashSort({ kind, progress, update, onBack, onGre, onStart }: Props) {
  // paquet figé à l'ouverture : trier ne le fait pas bouger sous les doigts
  const [deck] = useState(() => flashDeck(data, progress.words, kind));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<{ id: string; prev: WordProgress | undefined }[]>([]);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const id = deck[index];
  const word = id ? data.words[id] : null;
  const counts = sortCounts(data, progress.words);
  const learnedHere = history.filter((h) => progress.words[h.id]?.known === false).length;

  useEffect(() => {
    setFlipped(false);
    setDx(0);
    if (word && progress.sound) speak(word.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function answer(knows: boolean) {
    if (!id) return;
    const prev = progress.words[id];
    const now = Date.now();
    update((p) => {
      const cur = getWP(p.words, id);
      const next = knows ? { ...markKnown(cur, now), ...(kind === 'check' ? { verified: true } : {}) } : markUnknown(cur);
      return { ...p, words: { ...p.words, [id]: next } };
    });
    setHistory((h) => [...h, { id, prev }]);
    setIndex((i) => i + 1);
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
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
  }

  // ← à apprendre · → je connais · espace / ↑ retourne · retour arrière annule
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && word) answer(true);
      else if (e.key === 'ArrowLeft' && word) answer(false);
      else if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && word) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'Backspace') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 8) drag.current.moved = true;
    setDx(d);
  };
  const onPointerUp = () => {
    const d = dx;
    const moved = drag.current?.moved;
    drag.current = null;
    if (d > SWIPE) answer(true);
    else if (d < -SWIPE) answer(false);
    else {
      setDx(0);
      if (!moved) setFlipped((f) => !f);
    }
  };

  const tilt = Math.max(-1, Math.min(1, dx / SWIPE));
  const title = kind === 'sort' ? 'Tri express' : 'Contrôle des mots connus';

  return (
    <div className="flex min-h-full flex-col pb-8">
      <header className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={28} />
        </button>
        <h1 className="flex-1 text-xl font-extrabold text-ink">{title}</h1>
        {deck.length > 0 && (
          <span className="font-bold tabular-nums text-muted">
            {Math.min(index + 1, deck.length)} / {deck.length}
          </span>
        )}
      </header>

      {deck.length > 0 && <ProgressBar thin value={index / deck.length} />}

      {!word ? (
        <div className="my-auto text-center">
          <p className="mb-2 text-2xl font-extrabold text-ink">{deck.length ? 'Paquet terminé !' : 'Rien à trier'}</p>
          <p className="mb-6 text-muted">
            {kind === 'sort'
              ? `${counts.known} mot${counts.known > 1 ? 's' : ''} connu${counts.known > 1 ? 's' : ''} · ${counts.learn} à apprendre`
              : 'Tous les mots que tu dis connaître ont été revérifiés.'}
          </p>
          <div className="mx-auto grid max-w-xs gap-3">
            {counts.learn > 0 && (
              <>
                <Button full onClick={onGre}>
                  Phrases GRE sur mes {counts.learn} mots
                </Button>
                <Button full variant="blue" onClick={() => onStart({ mode: 'learn' })}>
                  Apprendre mes mots
                </Button>
              </>
            )}
            {history.length > 0 && (
              <Button full variant="white" onClick={undo}>
                Annuler le dernier
              </Button>
            )}
            <Button full variant="white" onClick={onBack}>
              Retour
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="my-auto select-none py-6">
            <div
              role="button"
              tabIndex={0}
              aria-label={flipped ? 'Cacher la définition' : 'Voir la définition'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                drag.current = null;
                setDx(0);
              }}
              style={{ transform: `translateX(${dx}px) rotate(${tilt * 6}deg)`, touchAction: 'pan-y' }}
              className={`relative min-h-[300px] cursor-grab rounded-xl2 border-2 border-b-4 px-6 py-8 text-center transition-[border-color,background-color] duration-150 ${
                tilt > 0.3 ? 'border-green bg-green-light' : tilt < -0.3 ? 'border-red bg-red-light' : 'border-line bg-surface'
              } ${dx === 0 ? 'transition-transform' : ''}`}
            >
              <span
                className={`absolute inset-x-0 top-3 text-sm font-extrabold uppercase transition-opacity ${
                  tilt > 0.3 ? 'text-green-ink opacity-100' : tilt < -0.3 ? 'text-red-ink opacity-100' : 'opacity-0'
                }`}
              >
                {tilt > 0 ? 'Je connais' : 'À apprendre'}
              </span>

              <div className="flex items-center justify-center gap-2">
                <p className="text-[34px] font-extrabold leading-tight text-ink">{word.word}</p>
                <span onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                  <SpeakButton text={word.word} />
                </span>
              </div>
              <p className="text-sm font-bold italic text-muted">{word.pos}</p>

              {flipped ? (
                <div className="mt-6 space-y-2 text-left">
                  <p className="text-lg font-bold text-ink">{word.definition}</p>
                  <p className="text-lg text-blue-ink">{word.definitionFr}</p>
                  <Sentence text={word.sentences[0]} word={word.word} className="border-l-4 border-line pl-3 text-base text-muted" />
                </div>
              ) : (
                <p className="mt-10 text-sm text-muted">Touche la carte pour voir la définition</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="red" className="flex items-center justify-center gap-2 whitespace-nowrap !px-3" onClick={() => answer(false)}>
              <X size={20} /> À apprendre
            </Button>
            <Button className="flex items-center justify-center gap-2 whitespace-nowrap !px-3" onClick={() => answer(true)}>
              <Check size={20} /> Je connais
            </Button>
          </div>
          <p className="mt-3 hidden text-center text-sm text-muted sm:block">
            Raccourcis : ← à apprendre · → je connais · espace retourne · retour arrière annule
          </p>
          <div className="mt-4 flex items-center justify-between text-sm font-bold">
            <button type="button" onClick={undo} disabled={history.length === 0} className="flex items-center gap-1 text-blue-ink disabled:text-dtext">
              <Undo2 size={16} /> Annuler
            </button>
            <span className="text-muted">
              {learnedHere} à apprendre sur {history.length} triés
            </span>
          </div>
        </>
      )}
    </div>
  );
}
