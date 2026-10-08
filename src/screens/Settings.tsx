import { ArrowLeft, Download, Smartphone, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AccountCard from '../components/AccountCard';
import Button from '../components/Button';
import Reminders from '../components/Reminders';
import type { useAccount } from '../hooks/useAccount';
import { useInstall } from '../hooks/useInstall';
import { canSpeak, listVoices, speak, voiceScore } from '../lib/speak';
import { parseProgress } from '../lib/storage';
import type { Settings as SettingsType } from '../lib/settings';
import type { Progress } from '../types';

type Props = {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
  progress: Progress;
  account: ReturnType<typeof useAccount>;
  onToggleSound: () => void;
  onImport: (p: Progress) => void;
  onReset: () => void;
  onBack: () => void;
};

function Choice<T extends string | number>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { value: T; text: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onPick(o.value)}
          className={`rounded-xl2 border-2 border-b-4 px-4 py-2 font-bold transition-colors duration-150 ${
            o.value === value ? 'border-blue bg-blue-light text-blue-ink' : 'border-line text-ink hover:bg-soft'
          }`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">{title}</h2>
    {children}
  </section>
);

export default function Settings({ settings, onChange, progress, account, onToggleSound, onImport, onReset, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const app = useInstall();
  // les voix se chargent de façon asynchrone dans certains navigateurs
  const [voices, setVoices] = useState(() => listVoices(settings.accent));
  useEffect(() => {
    if (!canSpeak()) return;
    const refresh = () => setVoices(listVoices(settings.accent));
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, [settings.accent]);

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gremlin-progress-${new Date().toISOString().slice(0, 10)}.json`;
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
      <header className="flex items-center gap-3 py-4">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-xl2 p-1 text-muted hover:bg-line">
          <ArrowLeft size={28} />
        </button>
        <h1 className="text-2xl font-extrabold text-ink">Réglages</h1>
      </header>

      {(app.canInstall || app.showIosHint || app.installed) && (
        <Section title="Application">
          {app.installed ? (
            <p className="text-muted">✓ GREmlin est installée sur cet appareil.</p>
          ) : app.canInstall ? (
            <Button className="flex items-center gap-2" onClick={() => void app.install()}>
              <Smartphone size={18} /> Installer l'application
            </Button>
          ) : (
            <p className="text-muted">Pour installer GREmlin : touche Partager puis « Sur l'écran d'accueil ».</p>
          )}
        </Section>
      )}

      <Section title="Apparence">
        <Choice
          label="Thème"
          value={settings.theme}
          onPick={(theme) => onChange({ theme })}
          options={[
            { value: 'auto', text: 'Auto' },
            { value: 'light', text: 'Clair' },
            { value: 'dark', text: 'Sombre' },
          ]}
        />
      </Section>

      <Section title="Objectif quotidien">
        <Choice
          label="Leçons par jour"
          value={settings.dailyGoal}
          onPick={(dailyGoal) => onChange({ dailyGoal })}
          options={[1, 2, 3, 5].map((n) => ({ value: n, text: `${n} leçon${n > 1 ? 's' : ''}` }))}
        />
      </Section>

      <Section title="Son">
        <div className="space-y-4">
          <label className="flex items-center gap-3 font-bold text-ink">
            <input type="checkbox" checked={progress.sound} onChange={onToggleSound} className="h-5 w-5 accent-[#1CB0F6]" />
            Prononciation et exercices d'écoute
          </label>
          {canSpeak() ? (
            <>
              <Choice
                label="Accent"
                value={settings.accent}
                onPick={(accent) => {
                  onChange({ accent, voice: null });
                  window.setTimeout(() => speak('vocabulary'), 50);
                }}
                options={[
                  { value: 'en-US', text: 'Américain' },
                  { value: 'en-GB', text: 'Britannique' },
                ]}
              />
              <div>
                <label htmlFor="voice" className="mb-2 block font-bold text-ink">
                  Voix
                </label>
                <select
                  id="voice"
                  value={settings.voice ?? ''}
                  onChange={(e) => {
                    onChange({ voice: e.target.value || null });
                    window.setTimeout(() => speak('vocabulary'), 50);
                  }}
                  className="w-full rounded-xl2 border-2 border-line bg-soft px-3 py-3 font-bold text-ink"
                >
                  <option value="">Automatique (la plus naturelle)</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                      {voiceScore(v) >= 40 ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted">
                  ★ = voix de haute qualité. Sur Mac et iPhone, tu peux en ajouter dans Réglages système → Accessibilité → Contenu énoncé → Voix du système.
                </p>
              </div>
              <Choice
                label="Vitesse"
                value={settings.rate}
                onPick={(rate) => {
                  onChange({ rate });
                  window.setTimeout(() => speak('vocabulary'), 50);
                }}
                options={[
                  { value: 0.7, text: 'Lente' },
                  { value: 0.9, text: 'Normale' },
                  { value: 1.1, text: 'Rapide' },
                ]}
              />
            </>
          ) : (
            <p className="text-muted">Ce navigateur ne propose pas de synthèse vocale.</p>
          )}
        </div>
      </Section>

      <Section title="Rappels">
        <Reminders />
      </Section>

      <Section title="Compte et progression">
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
            className="flex items-center gap-2 !py-2 !text-sm !text-red-ink"
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
        <p className="mt-3 text-sm text-muted">Sans compte, ta progression reste dans ce navigateur : exporte-la pour la garder ou la transférer.</p>
      </Section>
    </div>
  );
}
