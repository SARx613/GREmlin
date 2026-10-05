type Prefs = { lang: string; rate: number; voice: string | null };
let prefs: Prefs = { lang: 'en-US', rate: 0.9, voice: null };

export function setSpeechPrefs(p: Prefs) {
  prefs = p;
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// --- Choix de la voix ---------------------------------------------------------
// Sans réglage, le navigateur prendrait la 1re voix « en-US » de la liste : sur Mac, ça peut être une voix de
// fantaisie (Zarvox, Bad News, Fred…). On exclut ces voix et on classe les autres par qualité.

/** Voix robotiques ou de fantaisie, inutilisables pour apprendre. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|espeak)\b/i;

/** Plus le score est haut, plus la voix est naturelle et américaine. */
export function voiceScore(v: { name: string; default?: boolean }): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 50; // voix Microsoft « Natural » (Edge, Windows 11)
  if (/premium|enhanced|siri/.test(n)) s += 40; // voix Apple haute qualité
  if (/google us english/.test(n)) s += 45; // Chrome
  if (/\b(ava|samantha|allison|evan|nathan|zoe|aria|jenny|guy|alex|tom|joelle|susan|noelle)\b/.test(n)) s += 30;
  if (v.default) s += 5;
  return s;
}

const normLang = (l: string) => l.replace('_', '-');

type V = { name: string; lang: string; default?: boolean };

/** Voix utilisables pour la langue demandée (accent exact), sans voix de fantaisie, meilleure en premier. */
export function rankVoices<T extends V>(voices: T[], lang: string): T[] {
  return voices.filter((v) => normLang(v.lang) === lang && !NOVELTY.test(v.name)).sort((a, b) => voiceScore(b) - voiceScore(a));
}

export const listVoices = (lang: string): SpeechSynthesisVoice[] =>
  canSpeak() ? rankVoices(window.speechSynthesis.getVoices(), lang) : [];

function pickVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices(); // peut être vide au tout premier appel
  if (prefs.voice) {
    const chosen = all.find((v) => v.name === prefs.voice);
    if (chosen) return chosen;
  }
  return (
    listVoices(prefs.lang)[0] ??
    all.filter((v) => normLang(v.lang).startsWith('en') && !NOVELTY.test(v.name)).sort((a, b) => voiceScore(b) - voiceScore(a))[0] ??
    null
  );
}

/** Mots que la synthèse vocale lirait mal (ici « minute » = /maï-nioute/, pas la minute du temps). */
const PRONUNCIATION: Record<string, string> = { minute: 'my noot' };

/** Prononce un mot en anglais (voix, accent et vitesse réglables) ; silencieux si le navigateur ne le supporte pas. */
export function speak(text: string) {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(PRONUNCIATION[text.toLowerCase()] ?? text);
  u.lang = prefs.lang;
  u.rate = prefs.rate;
  u.pitch = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
