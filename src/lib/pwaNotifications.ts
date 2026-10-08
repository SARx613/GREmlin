import { data } from './data';
import type { Streak } from '../types';

export type PwaNotificationPrefs = {
  enabled: boolean;
  countPerDay: number; // 1, 2 ou 3
};

const STORAGE_KEY = 'gremlin_pwa_notifications';
const SCHEDULE_KEY = 'gremlin_pwa_schedule';

const DEFAULT_PREFS: PwaNotificationPrefs = {
  enabled: false,
  countPerDay: 3,
};

export function isPwaNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPwaNotificationPermission(): NotificationPermission {
  if (!isPwaNotificationSupported()) return 'denied';
  return Notification.permission;
}

export function loadPwaNotificationPrefs(): PwaNotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      countPerDay: Math.min(3, Math.max(1, Number(parsed.countPerDay) || 3)),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePwaNotificationPrefs(prefs: PwaNotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // stockage non disponible
  }
}

export async function requestPwaNotificationPermission(): Promise<boolean> {
  if (!isPwaNotificationSupported()) return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export async function showPwaNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
  if (!isPwaNotificationSupported() || Notification.permission !== 'granted') return false;

  const defaultOpts: NotificationOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'gremlin-notification',
    ...options,
  };

  try {
    // Préférer le Service Worker registration si disponible (meilleur support PWA/mobile)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, defaultOpts);
        return true;
      }
    }
  } catch (err) {
    console.warn('Notification via service worker a échoué, essai fallback:', err);
  }

  // Fallback classique direct dans la page
  try {
    new Notification(title, defaultOpts);
    return true;
  } catch (err) {
    console.warn('Notification fallback a échoué:', err);
    return false;
  }
}

/** Envoie une notification de test immédiate. */
export async function sendTestPwaNotification(): Promise<boolean> {
  const sampleWords = ['aberrant', 'ephemeral', 'loquacious', 'equivocal', 'laconic', 'pragmatic'];
  const sampleWord = sampleWords[Math.floor(Math.random() * sampleWords.length)];
  const w = data.words[sampleWord];

  const body = w
    ? `${w.definitionFr} · "${w.definition}"`
    : 'Ton rappel d’entraînement GRE fonctionne parfaitement !';

  return showPwaNotification(`💡 Mot GRE : ${sampleWord}`, {
    body,
    tag: 'gremlin-test',
  });
}

type ScheduledSlot = {
  id: string;
  hour: number;
  minute: number;
  type: 'word' | 'surprise' | 'streak';
  fired: boolean;
};

type DaySchedule = {
  date: string;
  slots: ScheduledSlot[];
};

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Génère 1 à 3 créneaux aléatoires étalés sur la journée. */
function generateDaySchedule(count: number): DaySchedule {
  const today = getTodayKey();
  const slots: ScheduledSlot[] = [];

  // Créneau 1 (Matin/Midi : 9h30 à 12h30)
  if (count >= 1) {
    slots.push({
      id: `${today}-1`,
      hour: 10 + Math.floor(Math.random() * 2), // 10h ou 11h
      minute: Math.floor(Math.random() * 60),
      type: 'word',
      fired: false,
    });
  }

  // Créneau 2 (Après-midi : 14h à 17h)
  if (count >= 2) {
    slots.push({
      id: `${today}-2`,
      hour: 14 + Math.floor(Math.random() * 3), // 14h, 15h ou 16h
      minute: Math.floor(Math.random() * 60),
      type: 'surprise',
      fired: false,
    });
  }

  // Créneau 3 (Soir : 18h30 à 21h30)
  if (count >= 3) {
    slots.push({
      id: `${today}-3`,
      hour: 19 + Math.floor(Math.random() * 2), // 19h ou 20h
      minute: Math.floor(Math.random() * 60),
      type: 'streak',
      fired: false,
    });
  }

  return { date: today, slots };
}

function loadSchedule(): DaySchedule | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSchedule(schedule: DaySchedule): void {
  try {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  } catch {
    // localStorage plein ou indisponible
  }
}

let activeTimers: number[] = [];

function clearActiveTimers() {
  for (const t of activeTimers) {
    clearTimeout(t);
  }
  activeTimers = [];
}

/** Vérifie et programme les notifications du jour. */
export function checkAndSchedulePwaNotifications(streak?: Streak): void {
  if (typeof window === 'undefined') return;
  const prefs = loadPwaNotificationPrefs();
  if (!prefs.enabled || Notification.permission !== 'granted') {
    clearActiveTimers();
    return;
  }

  const today = getTodayKey();
  let schedule = loadSchedule();

  if (!schedule || schedule.date !== today) {
    schedule = generateDaySchedule(prefs.countPerDay);
    saveSchedule(schedule);
  }

  clearActiveTimers();

  const now = new Date();
  const allIds = Object.keys(data.words);

  schedule.slots.forEach((slot) => {
    if (slot.fired) return;

    const targetDate = new Date();
    targetDate.setHours(slot.hour, slot.minute, 0, 0);

    const diffMs = targetDate.getTime() - now.getTime();

    const triggerNotification = async () => {
      const randomId = allIds[Math.floor(Math.random() * allIds.length)];
      const w = data.words[randomId];

      if (slot.type === 'word' && w) {
        await showPwaNotification(`💡 Mot du jour GRE : ${w.word}`, {
          body: `${w.definitionFr} — "${w.definition}"`,
          tag: slot.id,
        });
      } else if (slot.type === 'surprise' && w) {
        await showPwaNotification(`⚡ Mot surprise : ${w.word}`, {
          body: `Traduction : ${w.definitionFr}. Synonymes : ${w.synonyms.slice(0, 2).join(', ')}`,
          tag: slot.id,
        });
      } else if (slot.type === 'streak') {
        const streakText = streak?.count ? `Tu as une série de ${streak.count} jour${streak.count > 1 ? 's' : ''} !` : 'Prends 5 minutes pour réviser !';
        await showPwaNotification(`🔥 Entraînement GRE du soir`, {
          body: `${streakText} Découvre tes mots pour garder ton rythme.`,
          tag: slot.id,
        });
      }

      slot.fired = true;
      if (schedule) saveSchedule(schedule);
    };

    // Si l'heure est déjà passée dans les 45 dernières minutes (ex: on rouvre l'app)
    if (diffMs <= 0 && diffMs > -45 * 60 * 1000) {
      void triggerNotification();
    } else if (diffMs > 0 && diffMs <= 12 * 60 * 60 * 1000) {
      // Programmer un timer pour aujourd'hui
      const timerId = window.setTimeout(() => {
        void triggerNotification();
      }, diffMs);
      activeTimers.push(timerId);
    }
  });
}
