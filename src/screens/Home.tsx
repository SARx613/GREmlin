import { Download, Flame, Play, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import AccountCard from '../components/AccountCard';
import Button from '../components/Button';
import type { useAccount } from '../hooks/useAccount';
import ProgressBar from '../components/ProgressBar';
import { data } from '../lib/data';
import { parseProgress } from '../lib/storage';
import { chapterDueCount, currentStreak, dueIds, masteredCount } from '../lib/srs';
import type { Progress } from '../types';

type Props = {
  progress: Progress;
  account: ReturnType<typeof useAccount>;
  hasPending: boolean;
  onResume: () => void;
  onReview: () => void;
  onChapter: (id: string) => void;
  onToggleSound: () => void;
  onImport: (p: Progress) => void;
  onReset: () => void;
};

export default function Home({ progress, account, hasPending, onResume, onReview, onChapter, onToggleSound, onImport, onReset }: Props) {
  const now = Date.now();
  const fileRef = useRef<HTMLInputElement>(null);
  const allIds = data.chapters.flatMap((c) => c.wordIds);
  const dueCount = dueIds(allIds, progress.words, now).length;
  const mastered = masteredCount(allIds, progress.words);
  const groups = [...new Set(data.chapters.map((c) => c.group))];

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gre-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      const p = parseProgress(JSON.parse(await file.text()));
      if (!p) throw new Error();
      if (window.confirm('Remplacer ta progression actuelle par celle du fichier ?')) onImport(p);
    } catch {
      window.alert("Ce fichier n'est pas une sauvegarde valide.");
    }
  }

  return (
    <div className="pb-16">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-1 text-lg font-extrabold text-orange" title="Série de jours">
          <Flame size={24} fill="currentColor" />
          {currentStreak(progress.streak, now)}
        </div>
        <p className="text-sm font-bold text-muted">
          {mastered} / {allIds.length} maîtrisés
        </p>
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={progress.sound ? 'Désactiver le son' : 'Activer le son'}
          aria-pressed={progress.sound}
          className="rounded-xl2 p-2 text-blue transition-colors duration-150 hover:bg-blue-light"
        >
          {progress.sound ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <img src="/favicon.svg" alt="" width={56} height={56} className="shrink-0" />
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-ink">GREmlin</h1>
          <p className="text-muted">Une leçon de 5 minutes par jour suffit.</p>
        </div>
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
                    className="rounded-xl2 border-2 border-b-4 border-line bg-white p-4 text-left transition-colors duration-150 hover:bg-[#F7F7F7]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-ink">{c.title}</span>
                      <span className="flex items-center gap-2 text-sm font-bold text-muted">
                        {due > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-white">{due} à réviser</span>}
                        {c.wordIds.length} mots
                      </span>
                    </div>
                    <ProgressBar thin value={masteredCount(c.wordIds, progress.words) / c.wordIds.length} />
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      <section className="mt-12 border-t-2 border-line pt-6">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">Compte et progression</h2>
        <div className="mb-4">
          <AccountCard account={account} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="white" className="flex items-center gap-2 !py-2 !text-sm" onClick={exportJson}>
            <Download size={16} /> Exporter
          </Button>
          <Button variant="white" className="flex items-center gap-2 !py-2 !text-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Importer
          </Button>
          <Button
            variant="white"
            className="flex items-center gap-2 !py-2 !text-sm !text-red"
            onClick={() => window.confirm('Effacer toute ta progression ? Cette action est définitive.') && onReset()}
          >
            <Trash2 size={16} /> Réinitialiser
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="mt-3 text-sm text-muted">Ta progression est enregistrée dans ce navigateur. Exporte-la pour la garder ou la transférer.</p>
      </section>
    </div>
  );
}
