import type { LessonSnapshot, Progress } from '../types';

const PROGRESS_KEY = 'gre-progress-v1';
const LESSON_KEY = 'gre-lesson-v1';

export const emptyState = (): Progress => ({ words: {}, streak: { count: 0, lastDay: null }, sound: true, days: {} });

/** Vérifie le minimum de forme d'une progression (fichier importé ou localStorage corrompu). */
export function parseProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Progress>;
  if (!p.words || typeof p.words !== 'object') return null;
  const base = emptyState();
  return {
    words: p.words,
    streak: p.streak && typeof p.streak.count === 'number' ? p.streak : base.streak,
    sound: typeof p.sound === 'boolean' ? p.sound : base.sound,
    days: p.days && typeof p.days === 'object' ? p.days : base.days,
  };
}

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

/** Événement émis quand le navigateur refuse d'enregistrer (navigation privée, quota, stockage bloqué). */
export const STORAGE_ERROR_EVENT = 'gre-storage-error';

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    window.dispatchEvent(new Event(STORAGE_ERROR_EVENT));
  }
}

/** Vérifie au démarrage que le stockage local fonctionne. */
export function storageWorks(): boolean {
  try {
    localStorage.setItem('gre-probe', '1');
    localStorage.removeItem('gre-probe');
    return true;
  } catch {
    return false;
  }
}

export const loadProgress = (): Progress => parseProgress(read(PROGRESS_KEY)) ?? emptyState();
export const saveProgress = (p: Progress) => write(PROGRESS_KEY, p);

export function loadLesson(): LessonSnapshot | null {
  const s = read(LESSON_KEY) as LessonSnapshot | null;
  return s && s.state && Array.isArray(s.state.queue) ? s : null;
}
export const saveLesson = (s: LessonSnapshot) => write(LESSON_KEY, s);
export function clearLesson() {
  try {
    localStorage.removeItem(LESSON_KEY);
  } catch {
    /* rien */
  }
}

export function clearAll() {
  clearLesson();
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* rien */
  }
}
