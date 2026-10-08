import { ArrowLeft, Check, Flame, SkipForward, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import { SpeakButton } from '../components/WordCard';
import { data } from '../lib/data';
import { canSpeak, speak } from '../lib/speak';
import {
  answerSprint,
  isSprintAnswerCorrect,
  makeSprintQuestion,
  newSprint,
  SPRINT_COMBO_STEP,
  SPRINT_DEFAULT_SECONDS,
  SPRINT_DURATIONS,
  sprintPool,
  type SprintQuestion,
  type SprintState,
} from '../lib/sprint';
import type { LessonConfig, Progress } from '../types';

type Props = {
  progress: Progress;
  onFinish: (score: number) => void;
  onBack: () => void;
  onStart: (config: LessonConfig) => void;
};

type Phase = 'ready' | 'play' | 'over';

export default function Sprint({ progress, onFinish, onBack, onStart }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [duration, setDuration] = useState(SPRINT_DEFAULT_SECONDS);
  const [state, setState] = useState<SprintState>(newSprint);
  const [question, setQuestion] = useState<SprintQuestion | null>(null);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; typo?: boolean; revealed?: string } | null>(null);
  const [left, setLeft] = useState(duration);
  const [record, setRecord] = useState(false);

  const pool = useRef<string[]>([]);
  const poolIndex = useRef(0);
  const endAt = useRef(0);
  const timer = useRef<number>();
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef<HTMLInputElement>(null);

  const best = progress.sprint?.best ?? 0;

  useEffect(() => () => window.clearInterval(timer.current), []);

  function nextWord(): SprintQuestion | null {
    if (poolIndex.current >= pool.current.length) {
      pool.current = sprintPool(data, progress.words);
      poolIndex.current = 0;
    }
    const id = pool.current[poolIndex.current++];
    const w = data.words[id];
    return w ? makeSprintQuestion(w) : null;
  }

  function start() {
    pool.current = sprintPool(data, progress.words);
    poolIndex.current = 0;
    setState(newSprint());
    setFlash(null);
    setInput('');
    setRecord(false);
    const first = nextWord();
    setQuestion(first);
    endAt.current = Date.now() + duration * 1000;
    setLeft(duration);
    setPhase('play');

    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const remaining = (endAt.current - Date.now()) / 1000;
      if (remaining <= 0) {
        window.clearInterval(timer.current);
        const final = stateRef.current;
        setLeft(0);
        setRecord(final.score > best);
        setPhase('over');
        onFinish(final.score);
      } else {
        setLeft(remaining);
      }
    }, 100);

    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleInput(val: string) {
    if (phase !== 'play' || !question || flash) return;
    setInput(val);

    const check = isSprintAnswerCorrect(val, question.word);
    if (check.ok) {
      if (progress.sound && canSpeak()) speak(question.word);
      setFlash({ ok: true, typo: check.typo });
      setState((s) => answerSprint(s, true, question.wordId));

      window.setTimeout(() => {
        setFlash(null);
        setInput('');
        setQuestion(nextWord());
        inputRef.current?.focus();
      }, 300);
    }
  }

  function skip() {
    if (phase !== 'play' || !question || flash) return;
    setFlash({ ok: false, revealed: question.word });
    setState((s) => answerSprint(s, false, question.wordId));

    window.setTimeout(() => {
      setFlash(null);
      setInput('');
      setQuestion(nextWord());
      inputRef.current?.focus();
    }, 900);
  }

  // Raccourcis clavier : Échap pour passer, Entrée pour lancer / relancer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && e.key === 'Escape') skip();
      else if (e.key === 'Enter' && phase !== 'play') start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const header = (
    <header className="flex items-center gap-3 py-4">
      <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
        <ArrowLeft size={28} />
      </button>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
        <Timer size={26} className="text-blue" /> Sprint Traduction
      </h1>
    </header>
  );

  if (phase === 'ready') {
    return (
      <div className="pb-16">
        {header}
        <div className="mt-4 rounded-xl2 border-2 border-line bg-surface p-6 text-center">
          <p className="mb-2 text-xl font-extrabold text-ink">Tape le mot le plus vite possible !</p>
          <p className="mb-6 text-muted">
            On te donne la traduction et le sens en français. Tape le mot anglais correspondant au clavier.
            +1 point par mot trouvé, ×2 dès {SPRINT_COMBO_STEP} d'affilée !
          </p>

          <div className="mb-6">
            <p className="mb-2 text-sm font-bold text-muted">Durée du chrono :</p>
            <div className="flex justify-center gap-2">
              {SPRINT_DURATIONS.map((d) => (
                <button
                  key={d.seconds}
                  type="button"
                  onClick={() => setDuration(d.seconds)}
                  className={`rounded-xl2 border-2 px-4 py-2 font-bold transition-colors ${
                    duration === d.seconds
                      ? 'border-blue bg-blue-light text-blue-dark'
                      : 'border-line text-ink hover:bg-soft'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mb-6 font-bold text-ink">
            Record : <span className="text-blue">{best} mot{best > 1 ? 's' : ''}</span> ·{' '}
            {progress.sprint?.plays ?? 0} partie{(progress.sprint?.plays ?? 0) > 1 ? 's' : ''}
          </p>

          <Button full variant="blue" onClick={start}>
            Démarrer le chrono
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'over') {
    return (
      <div className="pb-16 pt-6 text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted">Temps écoulé !</p>
        <p className="text-6xl font-extrabold text-blue">{state.score}</p>
        <p className="mb-1 text-muted">
          {state.correct.length} mot{state.correct.length > 1 ? 's' : ''} trouvé{state.correct.length > 1 ? 's' : ''},{' '}
          {state.missed.length} passé{state.missed.length > 1 ? 's' : ''}
        </p>
        <p className="mb-6 font-extrabold text-green-ink">
          {record ? '🏆 Nouveau record personnel !' : `Record : ${Math.max(best, state.score)}`}
        </p>

        {state.missed.length > 0 && (
          <section className="mb-6 text-left">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-red-ink">Mots passés à revoir</h2>
            <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line bg-surface">
              {state.missed.map((id) => {
                const w = data.words[id];
                if (!w) return null;
                return (
                  <li key={id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-bold text-ink">{w.word}</span>
                      <span className="text-xs text-muted"> ({w.pos})</span>
                      <p className="text-sm text-muted">{w.definitionFr}</p>
                    </div>
                    <SpeakButton text={w.word} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="grid gap-3">
          <Button full variant="blue" onClick={start}>
            Rejouer
          </Button>
          {state.missed.length > 0 && (
            <Button full variant="white" onClick={() => onStart({ mode: 'selection', wordIds: state.missed })}>
              Réviser ces mots en leçon
            </Button>
          )}
          <Button full variant="white" onClick={onBack}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(left / 60);
  const seconds = Math.floor(left % 60);
  const timeFormatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Quitter" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <ProgressBar value={left / duration} color={left < 30 ? 'bg-red' : 'bg-blue'} />
        </div>
        <span className="w-16 text-right font-mono text-lg font-extrabold tabular-nums text-ink">
          {timeFormatted}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-3xl font-extrabold text-blue">{state.score}</p>
        {state.combo >= 2 && (
          <p className="flex items-center gap-1 font-extrabold text-orange-ink" aria-live="polite">
            <Flame size={20} fill="currentColor" /> combo {state.combo}
            {state.combo >= SPRINT_COMBO_STEP && ' ×2'}
          </p>
        )}
      </div>

      {question && (
        <div className="rounded-xl2 border-2 border-b-4 border-line bg-surface p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-bold text-muted">
              {question.pos}
            </span>
            <span className="text-xs font-bold text-muted">
              {question.length} lettres (commence par {question.firstLetter})
            </span>
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Traduction / Définition</p>
          <p className="mb-4 text-2xl font-extrabold text-ink">{question.promptFr}</p>

          {flash?.revealed ? (
            <div className="mb-4 rounded-xl2 bg-red-light p-3 text-center">
              <p className="text-xs font-bold uppercase text-red-ink">Réponse :</p>
              <p className="text-2xl font-extrabold text-red-ink">{flash.revealed}</p>
            </div>
          ) : flash?.ok ? (
            <div className="mb-4 rounded-xl2 bg-green-light p-3 text-center">
              <p className="flex items-center justify-center gap-1 text-lg font-extrabold text-green-ink">
                <Check size={22} /> {flash.typo ? 'Presque !' : 'Bravo !'}
              </p>
            </div>
          ) : null}

          <div className="relative mt-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              placeholder={`Tape le mot (${question.firstLetter}...)`}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={!!flash}
              className={`w-full rounded-xl2 border-2 px-4 py-3 text-xl font-bold outline-none transition-colors ${
                flash?.ok
                  ? 'border-green bg-green-light text-green-ink'
                  : flash?.revealed
                    ? 'border-red bg-red-light text-red-ink'
                    : 'border-line text-ink focus:border-blue'
              }`}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={skip}
              disabled={!!flash}
              className="flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-ink"
            >
              <SkipForward size={16} /> Passer ce mot (Échap)
            </button>
            <span className="text-xs text-muted">
              Validation auto ou faute tolérée
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
