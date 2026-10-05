import { ArrowLeft } from 'lucide-react';
import { BarChart, LineChart } from '../components/Charts';
import Button from '../components/Button';
import { data } from '../lib/data';
import { currentStreak, getWP, masteredCount, statusOf } from '../lib/srs';
import { lastDays, leechIds, lessonsSeries, masteredSeries } from '../lib/stats';
import type { LessonConfig, Progress } from '../types';

const fmt = (key: string) => key.slice(8) + '/' + key.slice(5, 7);

function Tile({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className="rounded-xl2 border-2 border-line p-4">
      <p className={`text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-sm font-bold text-muted">{label}</p>
    </div>
  );
}

type Props = { progress: Progress; onBack: () => void; onStart: (config: LessonConfig) => void };

export default function Stats({ progress, onBack, onStart }: Props) {
  const now = Date.now();
  const all = data.chapters.flatMap((c) => c.wordIds);
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const id of all) counts[statusOf(getWP(progress.words, id))]++;

  const mastered = masteredCount(all, progress.words);
  const m30 = masteredSeries(progress.days, now, 30, mastered);
  const l14 = lessonsSeries(progress.days, now, 14);
  const d30 = lastDays(now, 30).map(fmt);
  const d14 = lastDays(now, 14).map(fmt);
  const leeches = leechIds(all, progress.words);
  const streak = currentStreak(progress.streak, now);

  return (
    <div className="pb-16">
      <header className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={28} />
        </button>
        <h1 className="text-2xl font-extrabold text-ink">Statistiques</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={counts.mastered} label={`maîtrisés / ${all.length}`} tone="text-green-ink" />
        <Tile value={counts.learning} label="en cours" tone="text-orange-ink" />
        <Tile value={counts.new} label="nouveaux" tone="text-muted" />
        <Tile value={`${streak} j`} label={`série (record ${Math.max(progress.streak.best ?? 0, streak)} j)`} tone="text-blue-ink" />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">Mots maîtrisés · 30 jours</h2>
        <LineChart values={m30} labels={d30} label={`Mots maîtrisés sur 30 jours : de ${m30[0]} à ${m30[m30.length - 1]}`} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">Leçons terminées · 14 jours</h2>
        <BarChart values={l14} labels={d14} label={`Leçons par jour sur 14 jours : ${l14.reduce((a, b) => a + b, 0)} au total`} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">Mots difficiles</h2>
        {leeches.length === 0 ? (
          <p className="text-muted">Aucun mot difficile pour l'instant. Les mots ratés plus souvent que réussis apparaissent ici.</p>
        ) : (
          <>
            <ul className="divide-y-2 divide-line rounded-xl2 border-2 border-line">
              {leeches.map((id) => {
                const wp = getWP(progress.words, id);
                return (
                  <li key={id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{data.words[id].word}</span>
                      <span className="block truncate text-sm text-muted">{data.words[id].definitionFr}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-red-ink">{wp.misses} erreurs</span>
                  </li>
                );
              })}
            </ul>
            <Button full className="mt-4" onClick={() => onStart({ mode: 'selection', wordIds: leeches })}>
              Réviser ces mots
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
