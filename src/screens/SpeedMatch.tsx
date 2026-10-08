import { ArrowLeft, Flame, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import { data } from '../lib/data';
import { canSpeak, speak } from '../lib/speak';
import {
  ACTIVE_PAIRS_COUNT,
  newSpeedMatch,
  recordSpeedMatchError,
  replacePair,
  SPEED_MATCH_COMBO_STEP,
  SPEED_MATCH_SECONDS,
  type SpeedMatchState,
} from '../lib/speedMatch';
import { sprintPool } from '../lib/sprint';
import type { LessonConfig, Progress } from '../types';

type Props = {
  progress: Progress;
  onFinish: (score: number) => void;
  onBack: () => void;
  onStart: (config: LessonConfig) => void;
};

type Phase = 'ready' | 'play' | 'over';

export default function SpeedMatch({ progress, onFinish, onBack, onStart: _onStart }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [state, setState] = useState<SpeedMatchState | null>(null);
  const [selectedEn, setSelectedEn] = useState<string | null>(null);
  const [selectedFr, setSelectedFr] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ en: string; fr: string } | null>(null);
  const [left, setLeft] = useState(SPEED_MATCH_SECONDS);
  const [record, setRecord] = useState(false);

  const pool = useRef<string[]>([]);
  const poolIndex = useRef(ACTIVE_PAIRS_COUNT);
  const endAt = useRef(0);
  const timer = useRef<number>();
  const stateRef = useRef(state);
  stateRef.current = state;

  const best = progress.speedMatch?.best ?? 0;

  useEffect(() => () => window.clearInterval(timer.current), []);

  function start() {
    pool.current = sprintPool(data, progress.words);
    poolIndex.current = ACTIVE_PAIRS_COUNT;
    const initial = newSpeedMatch(data, pool.current);
    setState(initial);
    setSelectedEn(null);
    setSelectedFr(null);
    setWrongFlash(null);
    setRecord(false);
    endAt.current = Date.now() + SPEED_MATCH_SECONDS * 1000;
    setLeft(SPEED_MATCH_SECONDS);
    setPhase('play');

    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const remaining = (endAt.current - Date.now()) / 1000;
      if (remaining <= 0) {
        window.clearInterval(timer.current);
        const final = stateRef.current;
        const finalScore = final?.score ?? 0;
        setLeft(0);
        setRecord(finalScore > best);
        setPhase('over');
        onFinish(finalScore);
      } else {
        setLeft(remaining);
      }
    }, 100);
  }

  function handlePickEn(id: string) {
    if (wrongFlash) return;
    if (selectedFr) {
      checkPair(id, selectedFr);
    } else {
      setSelectedEn(id);
    }
  }

  function handlePickFr(id: string) {
    if (wrongFlash) return;
    if (selectedEn) {
      checkPair(selectedEn, id);
    } else {
      setSelectedFr(id);
    }
  }

  function checkPair(enId: string, frId: string) {
    if (!state) return;
    if (enId === frId) {
      // Bonne paire !
      if (progress.sound && canSpeak()) {
        const w = data.words[enId];
        if (w) speak(w.word);
      }
      setSelectedEn(null);
      setSelectedFr(null);
      const nextId = pool.current[poolIndex.current++];
      setState((s) => (s ? replacePair(s, enId, data, nextId) : s));
    } else {
      // Mauvaise paire
      setWrongFlash({ en: enId, fr: frId });
      setState((s) => (s ? recordSpeedMatchError(s) : s));
      window.setTimeout(() => {
        setWrongFlash(null);
        setSelectedEn(null);
        setSelectedFr(null);
      }, 400);
    }
  }

  const header = (
    <header className="flex items-center gap-3 py-4">
      <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
        <ArrowLeft size={28} />
      </button>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
        <Shuffle size={26} className="text-green-ink" /> Speed Match
      </h1>
    </header>
  );

  if (phase === 'ready') {
    return (
      <div className="pb-16">
        {header}
        <div className="mt-4 rounded-xl2 border-2 border-line bg-surface p-6 text-center">
          <p className="mb-2 text-xl font-extrabold text-ink">Associe un maximum de paires !</p>
          <p className="mb-6 text-muted">
            Relie chaque mot anglais à sa traduction française. Dès qu'une paire est validée, un nouveau mot apparaît
            immédiatement ! 90 secondes chrono.
          </p>

          <p className="mb-6 font-bold text-ink">
            Record : <span className="text-green-ink">{best} paires</span> ·{' '}
            {progress.speedMatch?.plays ?? 0} partie{(progress.speedMatch?.plays ?? 0) > 1 ? 's' : ''}
          </p>

          <Button full variant="green" onClick={start}>
            Lancer le Speed Match
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'over') {
    return (
      <div className="pb-16 pt-6 text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted">Temps écoulé !</p>
        <p className="text-6xl font-extrabold text-green-ink">{state?.score ?? 0}</p>
        <p className="mb-1 text-muted">
          {state?.correctCount ?? 0} paire{(state?.correctCount ?? 0) > 1 ? 's' : ''} trouvée{(state?.correctCount ?? 0) > 1 ? 's' : ''},{' '}
          {state?.wrongCount ?? 0} erreur{(state?.wrongCount ?? 0) > 1 ? 's' : ''}
        </p>
        <p className="mb-6 font-extrabold text-green-ink">
          {record ? '🏆 Nouveau record personnel !' : `Record : ${Math.max(best, state?.score ?? 0)}`}
        </p>

        <div className="grid gap-3">
          <Button full variant="green" onClick={start}>
            Rejouer
          </Button>
          <Button full variant="white" onClick={onBack}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(left / 60);
  const seconds = Math.floor(left % 60);

  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Quitter" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <ProgressBar value={left / SPEED_MATCH_SECONDS} color={left < 20 ? 'bg-red' : 'bg-green'} />
        </div>
        <span className="w-16 text-right font-mono text-lg font-extrabold tabular-nums text-ink">
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-3xl font-extrabold text-green-ink">{state?.score ?? 0}</p>
        {(state?.combo ?? 0) >= 2 && (
          <p className="flex items-center gap-1 font-extrabold text-orange-ink" aria-live="polite">
            <Flame size={20} fill="currentColor" /> combo {state?.combo}
            {(state?.combo ?? 0) >= SPEED_MATCH_COMBO_STEP && ' ×2'}
          </p>
        )}
      </div>

      {state && (
        <div className="grid grid-cols-2 gap-3">
          {/* Mots anglais */}
          <div className="space-y-2.5">
            <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">Anglais</p>
            {state.englishItems.map((item) => {
              const isSelected = selectedEn === item.id;
              const isWrong = wrongFlash?.en === item.id;
              let style = 'border-line text-ink hover:bg-soft';
              if (isSelected) style = 'border-blue bg-blue-light text-blue-dark';
              if (isWrong) style = 'border-red bg-red-light text-red-ink animate-shake';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePickEn(item.id)}
                  className={`flex min-h-[58px] w-full items-center justify-center rounded-xl2 border-2 border-b-4 p-2 text-center text-base font-bold transition-all sm:text-lg ${style}`}
                >
                  {item.text}
                </button>
              );
            })}
          </div>

          {/* Définitions / traductions françaises */}
          <div className="space-y-2.5">
            <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">Français</p>
            {state.frenchItems.map((item) => {
              const isSelected = selectedFr === item.id;
              const isWrong = wrongFlash?.fr === item.id;
              let style = 'border-line text-ink hover:bg-soft';
              if (isSelected) style = 'border-blue bg-blue-light text-blue-dark';
              if (isWrong) style = 'border-red bg-red-light text-red-ink animate-shake';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePickFr(item.id)}
                  className={`flex min-h-[58px] w-full items-center justify-center rounded-xl2 border-2 border-b-4 p-2 text-center text-xs font-bold leading-tight transition-all sm:text-sm ${style}`}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
