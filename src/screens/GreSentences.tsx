import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import FeedbackBar from '../components/FeedbackBar';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import RichSentence, { WordLookup } from '../components/RichSentence';
import { data } from '../lib/data';
import { sortCounts } from '../lib/flash';
import {
  GRE_SESSION,
  buildGreQueue,
  grePool,
  isGreCorrect,
  makeGreQuestion,
  newGreSession,
  resolveGre,
  type GreState,
} from '../lib/gre';
import { findForm } from '../lib/match';
import { speak } from '../lib/speak';
import { getWP, markUnknown } from '../lib/srs';
import type { LessonConfig, Progress } from '../types';

type Props = {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  onBack: () => void;
  onSort: () => void;
  onStart: (config: LessonConfig) => void;
};

type Phase = 'ready' | 'play' | 'over';

/**
 * Phrases GRE : Text Completion (5 choix) et Sentence Equivalence (2 bonnes réponses sur 6) sur les mots à apprendre.
 * Les phrases elles-mêmes contiennent du vocabulaire difficile : toucher un mot souligné donne sa définition.
 * N'altère pas les boîtes de répétition (comme le Blitz) ; les erreurs peuvent être révisées ensuite.
 */
export default function GreSentences({ progress, update, onBack, onSort, onStart }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [state, setState] = useState<GreState>(() => newGreSession([]));
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [lookup, setLookup] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const pool = useRef<string[]>([]);
  const counts = sortCounts(data, progress.words);

  const q = state.queue[0];
  const need = q?.answerIds.length ?? 1;
  const ok = !!q && checked && isGreCorrect(q, picked);

  function start() {
    pool.current = grePool(data, progress.words);
    const queue = buildGreQueue(data, pool.current, GRE_SESSION);
    if (!queue.length) return;
    setState(newGreSession(queue));
    setPicked([]);
    setChecked(false);
    setLookup(null);
    setPhase('play');
  }

  function toggle(id: string) {
    if (checked || !q) return;
    setPicked((cur) => {
      if (need === 1) return [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-need);
    });
  }

  function check() {
    if (!q || checked || picked.length !== need) return;
    setChecked(true);
    if (progress.sound && isGreCorrect(q, picked)) speak(data.words[q.wordId].word);
  }

  function next() {
    if (!q || !checked) return;
    const correct = isGreCorrect(q, picked);
    const retry = correct ? undefined : (makeGreQuestion(data, q.wordId, pool.current, Math.random, q.format, q.sentence) ?? undefined);
    const nextState = resolveGre(state, correct, retry && { ...retry, retry: true });
    setState(nextState);
    setPicked([]);
    setChecked(false);
    setLookup(null);
    if (!nextState.queue.length) setPhase('over');
  }

  // clavier : 1-6 choisit, Entrée vérifie / continue
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (confirmQuit) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (checked) next();
        else check();
      } else if (!checked && /^[1-6]$/.test(e.key)) {
        const o = q?.options[Number(e.key) - 1];
        if (o) toggle(o.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lookedUp = lookup ? data.words[lookup] : null;
  const lookedWp = lookup ? getWP(progress.words, lookup) : null;
  const canAdd = !!lookedWp && lookedWp.known === undefined && lookedWp.box === 0;
  const addToPile = () => lookup && update((p) => ({ ...p, words: { ...p.words, [lookup]: markUnknown(getWP(p.words, lookup)) } }));

  // --- Accueil ---
  if (phase === 'ready') {
    return (
      <div className="mx-auto min-h-full w-full max-w-[760px] px-3 pb-16 sm:px-6">
        <header className="flex items-center gap-3 py-4">
          <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
            <X size={28} />
          </button>
          <h1 className="text-2xl font-extrabold text-ink">Phrases GRE</h1>
        </header>
        <div className="mt-2 rounded-xl2 border-2 border-line p-6">
          <p className="mb-2 text-xl font-extrabold text-ink">Comprendre la phrase, puis choisir le mot.</p>
          <p className="mb-3 text-muted">
            Des phrases à trous comme au GRE : 5 mots pour un blanc, ou 2 bonnes réponses sur 6 qui donnent le même sens. Les phrases
            contiennent d'autres mots difficiles : touche un mot souligné pour voir sa définition et, si tu veux, l'ajouter à tes mots à apprendre.
          </p>
          <p className="mb-6 font-bold text-ink">
            {counts.learn > 0
              ? `${counts.learn} mot${counts.learn > 1 ? 's' : ''} à apprendre en priorité.`
              : counts.unsorted > 0
                ? `Tu n'as encore rien trié : ${counts.unsorted} mots t'attendent dans le tri express.`
                : 'Tous tes mots sont connus : on pioche dans tout le vocabulaire.'}
          </p>
          <div className="grid gap-3">
            <Button full onClick={start}>
              {GRE_SESSION} phrases
            </Button>
            {counts.unsorted > 0 && (
              <Button full variant="blue" onClick={onSort}>
                Trier mes mots d'abord
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Fin de série ---
  if (phase === 'over') {
    const missed = state.missed;
    return (
      <div className="mx-auto min-h-full w-full max-w-[760px] px-3 pb-16 pt-6 text-center sm:px-6">
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted">Série terminée</p>
        <p className="text-6xl font-extrabold text-green-ink">
          {state.firstTry} / {state.total}
        </p>
        <p className="mb-6 text-muted">du premier coup</p>

        {missed.length > 0 && (
          <section className="mb-6 text-left">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-red-ink">À retravailler</h2>
            <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
              {missed.map((id) => (
                <li key={id} className="px-4 py-2">
                  <span className="font-bold text-ink">{data.words[id].word}</span>
                  <span className="text-muted"> — {data.words[id].definitionFr}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-3">
          <Button full onClick={start}>
            {GRE_SESSION} autres phrases
          </Button>
          {missed.length > 0 && (
            <Button full variant="blue" onClick={() => onStart({ mode: 'selection', wordIds: missed })}>
              Réviser mes erreurs
            </Button>
          )}
          <Button full variant="white" onClick={onBack}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // --- Question ---
  const answerLabels = q ? q.answerIds.map((id) => q.options.find((o) => o.id === id)?.label).join(' et ') : '';
  const word = q ? data.words[q.wordId] : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface">
      <header className="mx-auto flex w-full max-w-[760px] items-center gap-4 px-3 pt-4 sm:px-6">
        <button type="button" aria-label="Quitter la série" onClick={() => setConfirmQuit(true)} className="rounded-xl2 p-1 text-muted hover:bg-line">
          <X size={28} />
        </button>
        <ProgressBar value={state.total ? state.done / state.total : 0} />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-3 pb-72 pt-8 sm:px-6">
          {q && (
            <>
              <h2 className="mb-1 text-2xl font-extrabold text-ink">{q.format === 'completion' ? 'Complète la phrase' : 'Choisis 2 mots'}</h2>
              <p className="mb-5 text-muted">
                {q.format === 'completion'
                  ? 'Un seul mot convient. Touche les mots soulignés si tu bloques.'
                  : 'Les deux mots doivent donner à la phrase le même sens.'}
              </p>
              <RichSentence
                text={checked ? q.sentence : q.prompt}
                skipId={checked ? undefined : q.wordId}
                highlight={checked && word ? (findForm(q.sentence, word.word) ?? undefined) : undefined}
                activeId={lookup}
                onWord={(id) => setLookup((cur) => (cur === id ? null : id))}
                className="mb-6 text-xl leading-relaxed text-ink sm:text-2xl"
              />
              <div className={`grid gap-3 ${q.format === 'equivalence' ? 'sm:grid-cols-2' : ''}`}>
                {q.options.map((o, i) => {
                  const selected = picked.includes(o.id);
                  const right = q.answerIds.includes(o.id);
                  let style = 'border-line text-ink hover:bg-soft';
                  if (selected) style = 'border-blue bg-blue-light text-blue-ink';
                  if (checked && right) style = 'border-green bg-green-light text-green-ink';
                  else if (checked && selected) style = 'border-red bg-red-light text-red-ink';
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={checked}
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
              {lookedUp && <WordLookup word={lookedUp} onLearn={canAdd ? addToPile : undefined} learned={lookedWp?.known === false} />}
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t-2 border-line bg-surface">
        <div className="mx-auto max-w-[760px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <Button full disabled={picked.length !== need} onClick={check}>
            Vérifier
          </Button>
        </div>
      </footer>

      <FeedbackBar show={checked} ok={ok} title={ok ? 'Bravo !' : `Bonne réponse : ${answerLabels}`} onContinue={next}>
        {word && q && (
          <>
            <p>
              <strong>{word.word}</strong> — {word.definition} ({word.definitionFr})
            </p>
            {q.format === 'equivalence' && (
              <p>
                Même sens : {q.answerIds.map((id) => q.options.find((o) => o.id === id)?.label).join(' ≈ ')}
              </p>
            )}
          </>
        )}
      </FeedbackBar>

      {confirmQuit && (
        <Modal onClose={() => setConfirmQuit(false)}>
          <h2 className="mb-2 text-2xl font-extrabold text-ink">Quitter la série ?</h2>
          <p className="mb-6 text-muted">Tes réponses de cette série ne sont pas enregistrées.</p>
          <div className="grid gap-3">
            <Button full onClick={() => setConfirmQuit(false)}>
              Continuer
            </Button>
            <Button full variant="white" onClick={onBack}>
              Quitter
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
