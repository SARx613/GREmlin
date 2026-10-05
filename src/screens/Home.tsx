import { BarChart3, Check, Flame, Play, Settings, Volume2, VolumeX } from 'lucide-react';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import WordSearch from '../components/WordSearch';
import { data } from '../lib/data';
import { chapterDueCount, currentStreak, dueIds, masteredCount } from '../lib/srs';
import { lessonsToday } from '../lib/stats';
import type { Progress } from '../types';

type Props = {
  progress: Progress;
  dailyGoal: number;
  hasPending: boolean;
  onResume: () => void;
  onReview: () => void;
  onChapter: (id: string) => void;
  onToggleSound: () => void;
  onStats: () => void;
  onSettings: () => void;
};

const iconBtn = 'rounded-xl2 p-2 text-blue-ink transition-colors duration-150 hover:bg-blue-light';

export default function Home({ progress, dailyGoal, hasPending, onResume, onReview, onChapter, onToggleSound, onStats, onSettings }: Props) {
  const now = Date.now();
  const allIds = data.chapters.flatMap((c) => c.wordIds);
  const dueCount = dueIds(allIds, progress.words, now).length;
  const mastered = masteredCount(allIds, progress.words);
  const groups = [...new Set(data.chapters.map((c) => c.group))];
  const today = lessonsToday(progress.days, now);
  const goalDone = today >= dailyGoal;

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

      <WordSearch progress={progress} />

      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">{g}</h2>
          <div className="grid gap-3">
            {data.chapters
              .filter((c) => c.group === g)
              .map((c) => {
                const due = chapterDueCount(c, progress.words, now);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChapter(c.id)}
                    className="rounded-xl2 border-2 border-b-4 border-line bg-surface p-4 text-left transition-colors duration-150 hover:bg-soft"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-ink">{c.title}</span>
                      <span className="flex items-center gap-2 text-sm font-bold text-muted">
                        {due > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-deep">{due} à réviser</span>}
                        {c.wordIds.length} mots
                      </span>
                    </div>
                    {c.subtitle && <p className="mb-3 text-sm text-muted">{c.subtitle}</p>}
                    <div className={c.subtitle ? '' : 'mt-3'}>
                      <ProgressBar thin value={masteredCount(c.wordIds, progress.words) / c.wordIds.length} />
                    </div>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
