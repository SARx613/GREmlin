import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Search, Sparkles } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import WordCard from './WordCard';
import { data } from '../lib/data';
import { CONTRASTS, LOOKALIKES, SYNONYM_FAMILIES } from '../lib/themes';
import type { LessonConfig, Progress } from '../types';

type Category = 'contrasts' | 'synonyms' | 'lookalikes';

type Props = {
  progress: Progress;
  onStart: (config: LessonConfig) => void;
  onToggleStar: (id: string) => void;
};

export default function ThemeExplorer({ progress, onStart, onToggleStar }: Props) {
  const [category, setCategory] = useState<Category>('contrasts');
  const [search, setSearch] = useState('');
  const [inspectWordId, setInspectWordId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();

  const filteredContrasts = CONTRASTS.filter((c) => {
    if (!q) return true;
    const matchTitle = c.title.toLowerCase().includes(q);
    const matchConceptA = c.conceptA.label.toLowerCase().includes(q) || c.conceptA.wordIds.some((w) => w.toLowerCase().includes(q));
    const matchConceptB = c.conceptB.label.toLowerCase().includes(q) || c.conceptB.wordIds.some((w) => w.toLowerCase().includes(q));
    return matchTitle || matchConceptA || matchConceptB;
  });

  const filteredFamilies = SYNONYM_FAMILIES.filter((f) => {
    if (!q) return true;
    const matchLabel = f.label.toLowerCase().includes(q);
    const matchWords = f.wordIds.some((w) => {
      const entry = data.words[w];
      return w.toLowerCase().includes(q) || (entry && entry.definitionFr.toLowerCase().includes(q));
    });
    return matchLabel || matchWords;
  });

  const filteredLookalikes = LOOKALIKES.filter((l) => {
    if (!q) return true;
    return (
      l.title.toLowerCase().includes(q) ||
      l.wordA.toLowerCase().includes(q) ||
      l.wordB.toLowerCase().includes(q) ||
      l.distinction.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-4 space-y-5">
      {/* Sélecteur de sous-catégorie */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('contrasts')}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-extrabold transition-all duration-150 ${
            category === 'contrasts'
              ? 'border-orange bg-orange/15 text-orange-ink shadow-sm'
              : 'border-line text-muted hover:bg-soft'
          }`}
        >
          <ArrowRightLeft size={16} />
          <span>Contraires & Duels ({CONTRASTS.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategory('synonyms')}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-extrabold transition-all duration-150 ${
            category === 'synonyms'
              ? 'border-blue bg-blue-light text-blue-ink shadow-sm'
              : 'border-line text-muted hover:bg-soft'
          }`}
        >
          <Sparkles size={16} />
          <span>Synonymes par thèmes ({SYNONYM_FAMILIES.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategory('lookalikes')}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-extrabold transition-all duration-150 ${
            category === 'lookalikes'
              ? 'border-red-500 bg-red-500/10 text-red-ink shadow-sm'
              : 'border-line text-muted hover:bg-soft'
          }`}
        >
          <AlertTriangle size={16} />
          <span>Pièges & Sosies ({LOOKALIKES.length})</span>
        </button>
      </div>

      {/* Barre de recherche thématique */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            category === 'contrasts'
              ? 'Rechercher un contraste (ex: abondance, calme, éloge...)'
              : category === 'synonyms'
              ? 'Rechercher un thème ou un mot synonyme...'
              : 'Rechercher une paire piège (ex: ingenuous, discreet)...'
          }
          className="w-full rounded-xl2 border-2 border-line bg-surface py-2.5 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-blue focus:outline-none"
        />
      </div>

      {/* 1. DUELS DE CONTRAIRES */}
      {category === 'contrasts' && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Les questions Text Completion et Sentence Equivalence du GRE reposent sur les contrastes. Clique sur un mot pour voir sa définition, ou lance un duel pour les pratiquer face à face.
          </p>

          <div className="grid gap-4">
            {filteredContrasts.map((c) => {
              const allWords = [...c.conceptA.wordIds, ...c.conceptB.wordIds];
              return (
                <div key={c.id} className="rounded-xl2 border-2 border-line bg-surface p-4 shadow-xs">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
                    <h3 className="text-base font-extrabold text-ink">{c.title}</h3>
                    <span className="text-xs font-bold text-muted">{allWords.length} mots au duel</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Pôle A */}
                    <div className="rounded-xl border border-blue/30 bg-blue-light/40 p-3">
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-blue-ink">
                        {c.conceptA.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.conceptA.wordIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setInspectWordId(id)}
                            className="rounded-lg border border-blue/30 bg-surface px-2 py-1 text-xs font-bold text-ink transition-colors hover:border-blue hover:text-blue-ink"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pôle B */}
                    <div className="rounded-xl border border-orange/30 bg-orange/10 p-3">
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-orange-ink">
                        {c.conceptB.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.conceptB.wordIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setInspectWordId(id)}
                            className="rounded-lg border border-orange/30 bg-surface px-2 py-1 text-xs font-bold text-ink transition-colors hover:border-orange hover:text-orange-ink"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 flex justify-end">
                    <Button
                      variant="white"
                      className="!py-1.5 !px-4 !text-xs !font-extrabold"
                      onClick={() => onStart({ mode: 'selection', wordIds: allWords })}
                    >
                      <ArrowRightLeft size={14} className="mr-1.5 inline" />
                      Pratiquer ce duel ({Math.min(allWords.length, 10)} mots)
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FAMILLES DE SYNONYMES */}
      {category === 'synonyms' && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Dans le GRE Sentence Equivalence, tu dois sélectionner exactement deux synonymes qui complètent la phrase. Révise les mots regroupés par affinité de sens.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredFamilies.map((f) => (
              <div key={f.id} className="flex flex-col justify-between rounded-xl2 border-2 border-line bg-surface p-3.5">
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-1">
                    <h3 className="text-sm font-extrabold text-ink">{f.label}</h3>
                    <span className="text-xs font-bold text-muted">{f.wordIds.length} mots</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {f.wordIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setInspectWordId(id)}
                        className="rounded-lg border border-line bg-soft px-2 py-0.5 text-xs font-bold text-ink transition-colors hover:border-blue hover:text-blue-ink"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 border-t border-line/60 pt-2.5">
                  <Button
                    variant="white"
                    full
                    className="!py-1.5 !text-xs !font-extrabold"
                    onClick={() => onStart({ mode: 'selection', wordIds: f.wordIds })}
                  >
                    <Sparkles size={14} className="mr-1.5 inline" />
                    Pratiquer ces synonymes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SOSIES ET PIÈGES */}
      {category === 'lookalikes' && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Les paires de mots qui se ressemblent mais dont le sens est radicalement différent ou faussement proche. Maîtrise ces pièges pour ne pas tomber dans les embûches du testeur.
          </p>

          <div className="grid gap-3.5">
            {filteredLookalikes.map((l) => {
              const wa = data.words[l.wordA];
              const wb = data.words[l.wordB];
              return (
                <div key={l.id} className="rounded-xl2 border-2 border-line bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                    <span className="text-sm font-extrabold text-ink">{l.title}</span>
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-ink">
                      Piège fréquent
                    </span>
                  </div>

                  <p className="mb-3 text-sm text-ink">{l.distinction}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                    {wa && (
                      <button
                        type="button"
                        onClick={() => setInspectWordId(l.wordA)}
                        className="rounded-lg border border-line p-2 text-left transition-colors hover:border-blue hover:bg-soft"
                      >
                        <span className="font-extrabold text-ink block">{wa.word}</span>
                        <span className="line-clamp-1">{wa.definitionFr}</span>
                      </button>
                    )}
                    {wb && (
                      <button
                        type="button"
                        onClick={() => setInspectWordId(l.wordB)}
                        className="rounded-lg border border-line p-2 text-left transition-colors hover:border-blue hover:bg-soft"
                      >
                        <span className="font-extrabold text-ink block">{wb.word}</span>
                        <span className="line-clamp-1">{wb.definitionFr}</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="white"
                      className="!py-1.5 !px-3 !text-xs !font-extrabold"
                      onClick={() => onStart({ mode: 'selection', wordIds: [l.wordA, l.wordB] })}
                    >
                      Pratiquer ce piège
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal d'inspection détaillée du mot */}
      {inspectWordId && data.words[inspectWordId] && (
        <Modal onClose={() => setInspectWordId(null)}>
          <div className="p-4">
            <WordCard
              word={data.words[inspectWordId]}
              full
              starred={Boolean(progress.starred?.includes(inspectWordId))}
              onToggleStar={() => onToggleStar(inspectWordId)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
