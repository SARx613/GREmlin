import { BarChart3, Check, Flame, Play, Settings, Shuffle, Star, Timer, Volume2, VolumeX, Zap } from 'lucide-react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import WordOfTheDay from '../components/WordOfTheDay';
import WordSearch from '../components/WordSearch';
import { data } from '../lib/data';
import { chapterDueCount, chapterProgress, currentStreak, dueIds, masteredCount } from '../lib/srs';
import { lessonsToday } from '../lib/stats';
import type { LessonConfig, Progress } from '../types';

type Props = {
  progress: Progress;
  dailyGoal: number;
  hasPending: boolean;
  openWordId?: string | null;
  onResume: () => void;
  onReview: () => void;
  onChapter: (id: string) => void;
  onToggleSound: () => void;
  onBlitz: () => void;
  onSprint: () => void;
  onSpeedMatch: () => void;
  onStats: () => void;
  onSettings: () => void;
  onToggleStar: (id: string) => void;
  onStart: (config: LessonConfig) => void;
};

const iconBtn = 'rounded-xl2 p-2 text-blue-ink transition-colors duration-150 hover:bg-blue-light';

export default function Home({ progress, dailyGoal, hasPending, openWordId, onResume, onReview, onChapter, onToggleSound, onBlitz, onSprint, onSpeedMatch, onStats, onSettings, onToggleStar, onStart }: Props) {
  const now = Date.now();
  const allIds = data.chapters.flatMap((c) => c.wordIds);
  const dueCount = dueIds(allIds, progress.words, now).length;
  const mastered = masteredCount(allIds, progress.words);
  const groups = [...new Set(data.chapters.map((c) => c.group))];
  const today = lessonsToday(progress.days, now);
  const goalDone = today >= dailyGoal;
  const starred = (progress.starred ?? []).filter((id) => data.words[id]);

  return (
    <div className="pb-16">
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-1 text-lg font-extrabold text-orange-ink" title="Série de jours">
          <Flame size={24} fill="currentColor" />
          {currentStreak(progress.streak, now)}
        </div>
        <p className="text-sm font-bold text-muted">
          {mastered} / {allIds.length} maîtrisés
        </p>
        <div className="flex items-center">
          <button type="button" onClick={onStats} aria-label="Statistiques" className={iconBtn}>
            <BarChart3 size={24} />
          </button>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={progress.sound ? 'Désactiver le son' : 'Activer le son'}
            aria-pressed={progress.sound}
            className={iconBtn}
          >
            {progress.sound ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button type="button" onClick={onSettings} aria-label="Réglages" className={iconBtn}>
            <Settings size={24} />
          </button>
        </div>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <img src="/favicon.svg" alt="" width={56} height={56} className="shrink-0" />
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-ink">GREmlin</h1>
          <p className="text-muted">Une leçon de 5 minutes par jour suffit.</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-1 flex items-center justify-between text-sm font-bold text-muted">
          <span>Objectif du jour</span>
          <span className={goalDone ? 'flex items-center gap-1 text-green-ink' : ''}>
            {goalDone && <Check size={16} />}
            {Math.min(today, dailyGoal)} / {dailyGoal} leçon{dailyGoal > 1 ? 's' : ''}
          </span>
        </div>
        <ProgressBar thin value={today / dailyGoal} />
      </div>

      {hasPending && (
        <Button variant="blue" full className="mb-3 flex items-center justify-center gap-2" onClick={onResume}>
          <Play size={20} /> Reprendre ma leçon
        </Button>
      )}
      <Button full disabled={dueCount === 0} onClick={onReview}>
        {dueCount ? `Réviser (${dueCount} ${dueCount > 1 ? 'mots dus' : 'mot dû'})` : 'Réviser'}
      </Button>
      {dueCount === 0 && <p className="mt-2 text-center text-sm text-muted">Rien à réviser, reviens demain</p>}

      {/* Entraînement rapide et jeux */}
      <div className="mt-4 grid gap-2.5">
        <button
          type="button"
          onClick={onSprint}
          className="flex w-full items-center justify-between gap-3 rounded-xl2 border-2 border-b-4 border-line bg-surface p-3.5 text-left transition-colors duration-150 hover:bg-soft"
        >
          <span className="flex items-center gap-3">
            <Timer size={24} className="text-blue" />
            <span>
              <span className="block text-base font-bold text-ink">Sprint Traduction · 5 min</span>
              <span className="block text-xs text-muted">Tape le mot anglais depuis la traduction</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-blue">{progress.sprint?.best ? `Record ${progress.sprint.best}` : 'Jouer'}</span>
        </button>

        <button
          type="button"
          onClick={onSpeedMatch}
          className="flex w-full items-center justify-between gap-3 rounded-xl2 border-2 border-b-4 border-line bg-surface p-3.5 text-left transition-colors duration-150 hover:bg-soft"
        >
          <span className="flex items-center gap-3">
            <Shuffle size={24} className="text-green-ink" />
            <span>
              <span className="block text-base font-bold text-ink">Speed Match · 90 s</span>
              <span className="block text-xs text-muted">Associe un maximum de paires express</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-green-ink">{progress.speedMatch?.best ? `Record ${progress.speedMatch.best}` : 'Jouer'}</span>
        </button>

        <button
          type="button"
          onClick={onBlitz}
          className="flex w-full items-center justify-between gap-3 rounded-xl2 border-2 border-b-4 border-line bg-surface p-3.5 text-left transition-colors duration-150 hover:bg-soft"
        >
          <span className="flex items-center gap-3">
            <Zap size={24} className="text-orange-ink" fill="currentColor" />
            <span>
              <span className="block text-base font-bold text-ink">Blitz QCM · 60 s</span>
              <span className="block text-xs text-muted">Choisis la bonne réponse le plus vite possible</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-orange-ink">{progress.blitz?.best ? `Record ${progress.blitz.best}` : 'Jouer'}</span>
        </button>
      </div>

      <WordOfTheDay progress={progress} onToggleStar={onToggleStar} />

      {starred.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl2 border-2 border-line p-4">
          <p className="flex items-center gap-2 font-bold text-ink">
            <Star size={20} fill="currentColor" className="text-orange-ink" /> Mes favoris · {starred.length} mot{starred.length > 1 ? 's' : ''}
          </p>
          <Button variant="white" className="!py-2 !text-sm" onClick={() => onStart({ mode: 'selection', wordIds: starred })}>
            Réviser
          </Button>
        </div>
      )}

      <WordSearch progress={progress} openId={openWordId} onToggleStar={onToggleStar} />

      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">{g}</h2>
          <div className="grid gap-3">
            {data.chapters
              .filter((c) => c.group === g)
              .map((c) => {
                const due = chapterDueCount(c, progress.words, now);
                const cp = chapterProgress(c.wordIds, progress.words);
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-chapter={c.id}
                    onClick={() => onChapter(c.id)}
                    className="rounded-xl2 border-2 border-b-4 border-line bg-surface p-4 text-left transition-colors duration-150 hover:bg-soft"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-ink">{c.title}</span>
                      {due > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-sm font-bold text-deep">{due} à réviser</span>}
                    </div>
                    {c.subtitle && <p className="mb-2 text-sm text-muted">{c.subtitle}</p>}
                    <div className="mb-1 mt-2 flex items-baseline justify-between text-sm font-bold">
                      <span className="text-ink">
                        {cp.discovered === cp.total ? 'Tous les mots découverts' : `Leçon ${cp.lessonsDone}/${cp.lessonsTotal}`}
                      </span>
                      <span className="text-green-ink">{cp.percent} %</span>
                    </div>
                    <ProgressBar thin value={cp.mastered / cp.total} secondary={cp.discovered / cp.total} />
                    <p className="mt-1 text-xs text-muted">
                      {cp.discovered}/{cp.total} mots découverts · {cp.mastered} maîtrisé{cp.mastered > 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
