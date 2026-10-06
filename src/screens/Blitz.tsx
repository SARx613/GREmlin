import { ArrowLeft, Flame, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import { SpeakButton } from '../components/WordCard';
import {
  BLITZ_SECONDS,
  COMBO_STEP,
  WRONG_PENALTY_SECONDS,
  answerBlitz,
  blitzPool,
  newBlitz,
  nextBlitzQuestion,
  type BlitzState,
} from '../lib/blitz';
import { data } from '../lib/data';
import type { ChoiceExercise, LessonConfig, Progress } from '../types';

type Props = {
  progress: Progress;
  onFinish: (score: number) => void;
  onBack: () => void;
  onStart: (config: LessonConfig) => void;
};

type Phase = 'ready' | 'play' | 'over';

/** Blitz : 60 secondes de QCM éclair. Bonne réponse +1 (×2 dès 5 d'affilée), erreur −2 s. */
export default function Blitz({ progress, onFinish, onBack, onStart }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [state, setState] = useState<BlitzState>(newBlitz);
  const [question, setQuestion] = useState<ChoiceExercise | null>(null);
  const [flash, setFlash] = useState<{ picked: string; ok: boolean } | null>(null);
  const [left, setLeft] = useState(BLITZ_SECONDS);
  const [record, setRecord] = useState(false);

  const endAt = useRef(0);
  const pool = useRef<string[]>([]);
  const timer = useRef<number>();
  const stateRef = useRef(state);
  stateRef.current = state;
  const best = progress.blitz?.best ?? 0;

  useEffect(() => () => window.clearInterval(timer.current), []);

  function start() {
    pool.current = blitzPool(data, progress.words);
    setState(newBlitz());
    setFlash(null);
    setRecord(false);
    setQuestion(nextBlitzQuestion(data, pool.current, null));
    endAt.current = Date.now() + BLITZ_SECONDS * 1000;
    setLeft(BLITZ_SECONDS);
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
      } else setLeft(remaining);
    }, 100);
  }

  function pick(optionId: string) {
    if (phase !== 'play' || !question || flash) return;
    const ok = optionId === question.answerId;
    setFlash({ picked: optionId, ok });
    setState((s) => answerBlitz(s, ok, question.wordId));
    if (!ok) endAt.current -= WRONG_PENALTY_SECONDS * 1000;
    window.setTimeout(() => {
      setFlash(null);
      setQuestion((q) => nextBlitzQuestion(data, pool.current, q?.wordId ?? null));
    }, ok ? 220 : 650);
  }

  // clavier : 1-4 pour répondre, Entrée pour lancer / relancer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && /^[1-4]$/.test(e.key)) pick(question?.options[Number(e.key) - 1]?.id ?? '');
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
        <Zap size={24} className="text-orange-ink" fill="currentColor" /> Blitz
      </h1>
    </header>
  );

  if (phase === 'ready') {
    return (
      <div className="pb-16">
        {header}
        <div className="mt-6 rounded-xl2 border-2 border-line p-6 text-center">
          <p className="mb-2 text-xl font-extrabold text-ink">60 secondes, un maximum de mots.</p>
          <p className="mb-6 text-muted">
            Réponds le plus vite possible (touches 1 à 4). +1 point par bonne réponse, ×2 à partir de {COMBO_STEP} d'affilée,
            −{WRONG_PENALTY_SECONDS} secondes par erreur.
          </p>
          <p className="mb-6 font-bold text-ink">
            Record : <span className="text-orange-ink">{best}</span> · {progress.blitz?.plays ?? 0} partie{(progress.blitz?.plays ?? 0) > 1 ? 's' : ''}
          </p>
          <Button full onClick={start}>
            Commencer
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'over') {
    return (
      <div className="pb-16 pt-6 text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted">Temps écoulé</p>
        <p className="text-6xl font-extrabold text-orange-ink">{state.score}</p>
        <p className="mb-1 text-muted">
          {state.correct} bonne{state.correct > 1 ? 's' : ''} réponse{state.correct > 1 ? 's' : ''}, {state.wrong} erreur{state.wrong > 1 ? 's' : ''}
        </p>
        <p className="mb-6 font-extrabold text-green-ink">{record ? '🏆 Nouveau record !' : `Record : ${Math.max(best, state.score)}`}</p>

        {state.missed.length > 0 && (
          <section className="mb-6 text-left">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-red-ink">À retravailler</h2>
            <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
              {state.missed.map((id) => (
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
            Rejouer
          </Button>
          {state.missed.length > 0 && (
            <Button full variant="blue" onClick={() => onStart({ mode: 'selection', wordIds: state.missed })}>
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

  const prompt = question?.type === 'fillBlank' ? '' : question?.prompt;
  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 py-4">
        <div className="flex-1">
          <ProgressBar value={left / BLITZ_SECONDS} color={left < 10 ? 'bg-red' : 'bg-orange'} />
        </div>
        <span className="w-12 text-right text-lg font-extrabold tabular-nums text-ink">{Math.ceil(left)}s</span>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-3xl font-extrabold text-orange-ink">{state.score}</p>
        {state.combo >= 2 && (
          <p className="flex items-center gap-1 font-extrabold text-orange-ink" aria-live="polite">
            <Flame size={20} fill="currentColor" /> combo {state.combo}
            {state.combo >= COMBO_STEP && ' ×2'}
          </p>
        )}
      </div>

      {question && (
        <>
          <p className="mb-1 text-sm font-bold text-muted">
            {question.type === 'wordToDef' ? 'Que signifie ce mot ?' : question.type === 'defToWord' ? 'Quel est ce mot ?' : 'Quel est le synonyme ?'}
          </p>
          <div className="mb-5 flex items-center gap-2">
            <p className={question.type === 'defToWord' ? 'text-xl font-bold text-ink' : 'text-4xl font-extrabold text-ink'}>{prompt}</p>
            {question.type !== 'defToWord' && <SpeakButton text={question.prompt} />}
          </div>
          <div className="grid gap-3">
            {question.options.map((o, i) => {
              let style = 'border-line text-ink hover:bg-soft';
              if (flash && o.id === question.answerId) style = 'border-green bg-green-light text-green-ink';
              else if (flash && o.id === flash.picked) style = 'border-red bg-red-light text-red-ink';
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  className={`flex items-center gap-3 rounded-xl2 border-2 border-b-4 px-3 py-3 text-left text-lg font-bold transition-colors duration-150 sm:px-4 sm:text-xl ${style}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-sm">{i + 1}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
