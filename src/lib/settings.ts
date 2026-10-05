import { setSpeechPrefs } from './speak';

export type Theme = 'auto' | 'light' | 'dark';
export type Settings = {
  theme: Theme;
  accent: 'en-US' | 'en-GB';
  rate: number; // vitesse de la voix
  voice: string | null; // nom de la voix choisie ; null = la plus naturelle disponible
  dailyGoal: number; // leçons par jour
};

export const DEFAULT_SETTINGS: Settings = { theme: 'auto', accent: 'en-US', rate: 0.9, voice: null, dailyGoal: 1 };

const KEY = 'gre-settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sans stockage : réglages valables pour la session seulement */
  }
}

/** Applique le thème au document et la voix à la synthèse vocale. */
export function applySettings(s: Settings) {
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  const dark = s.theme === 'dark' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131f24' : '#58CC02');
  setSpeechPrefs({ lang: s.accent, rate: s.rate, voice: s.voice });
}
