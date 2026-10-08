import { Bell, BellOff, CheckCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import Button from './Button';
import {
  getPwaNotificationPermission,
  isPwaNotificationSupported,
  loadPwaNotificationPrefs,
  requestPwaNotificationPermission,
  savePwaNotificationPrefs,
  sendTestPwaNotification,
  type PwaNotificationPrefs,
} from '../lib/pwaNotifications';

function Choice({
  value,
  onPick,
  options,
}: {
  value: number;
  onPick: (n: number) => void;
  options: number[];
}) {
  return (
    <div role="radiogroup" aria-label="Notifications par jour" className="flex flex-wrap gap-2">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          onClick={() => onPick(n)}
          className={`rounded-xl2 border-2 border-b-4 px-4 py-2 font-bold transition-colors duration-150 ${
            n === value ? 'border-blue bg-blue-light text-blue-ink' : 'border-line text-ink hover:bg-soft'
          }`}
        >
          {n} par jour
        </button>
      ))}
    </div>
  );
}

export default function Reminders() {
  const supported = isPwaNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission>(() => getPwaNotificationPermission());
  const [prefs, setPrefs] = useState<PwaNotificationPrefs>(() => loadPwaNotificationPrefs());
  const [testSent, setTestSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!supported) {
    return (
      <div className="flex gap-3 rounded-xl2 border-2 border-line p-4 text-muted">
        <BellOff size={22} className="mt-0.5 shrink-0 text-muted" />
        <div>
          <p className="font-bold text-ink">Notifications non disponibles sur ce navigateur.</p>
          <p className="text-sm">Sur iPhone et iPad, installe d'abord l'application sur l'écran d'accueil (Partager → Sur l'écran d'accueil) pour activer les notifications PWA.</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex gap-3 rounded-xl2 border-2 border-orange/40 bg-orange/10 p-4">
        <BellOff size={22} className="mt-0.5 shrink-0 text-orange" />
        <div>
          <p className="font-bold text-ink">Notifications bloquées</p>
          <p className="text-sm text-muted">
            Les notifications sont actuellement refusées par ton navigateur. Réactive-les dans les réglages du site ou de ton appareil pour recevoir les mots du jour.
          </p>
        </div>
      </div>
    );
  }

  const isEnabled = permission === 'granted' && prefs.enabled;

  const handleEnable = async () => {
    setMessage(null);
    const granted = await requestPwaNotificationPermission();
    setPermission(getPwaNotificationPermission());
    if (granted) {
      const next = { ...prefs, enabled: true };
      setPrefs(next);
      savePwaNotificationPrefs(next);
      setMessage('Notifications activées avec succès !');
    } else {
      setMessage("Autorisation refusée par l'appareil.");
    }
  };

  const handleDisable = () => {
    const next = { ...prefs, enabled: false };
    setPrefs(next);
    savePwaNotificationPrefs(next);
    setMessage('Notifications désactivées.');
  };

  const handleCountChange = (countPerDay: number) => {
    const next = { ...prefs, countPerDay };
    setPrefs(next);
    savePwaNotificationPrefs(next);
  };

  const handleTest = async () => {
    setTestSent(true);
    await sendTestPwaNotification();
    setTimeout(() => setTestSent(false), 3000);
  };

  if (!isEnabled) {
    return (
      <div className="rounded-xl2 border-2 border-line p-4">
        <p className="mb-2 font-bold text-ink">
          Reçois 2 à 3 mots et rappels par jour directement sur ton appareil.
        </p>
        <p className="mb-4 text-sm text-muted">
          100% interne à la PWA : mot du jour, mots surprise avec leur traduction, et rappel pour garder ta série. Aucun email ni inscription requis.
        </p>
        <Button className="flex items-center gap-2" onClick={() => void handleEnable()}>
          <Bell size={18} /> Activer sur cet appareil
        </Button>
        {message && <p className="mt-3 text-sm text-muted">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl2 border-2 border-line p-4">
      <div className="flex items-center gap-2 text-green-ink font-bold">
        <CheckCircle size={20} />
        <span>Notifications PWA actives sur cet appareil</span>
      </div>

      <div>
        <p className="mb-2 font-bold text-ink">Fréquence quotidienne</p>
        <Choice value={prefs.countPerDay} onPick={handleCountChange} options={[1, 2, 3]} />
        <p className="mt-2 text-sm text-muted">
          Envoyées à des moments aléatoires de la journée (matin, après-midi, soir) avec le mot du jour, des surprises et ta série.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="white" className="flex items-center gap-2 !py-2 !text-sm" onClick={() => void handleTest()}>
          <Sparkles size={16} /> {testSent ? 'Notification envoyée !' : 'Tester une notification'}
        </Button>
        <Button variant="white" className="!py-2 !text-sm !text-red-ink" onClick={handleDisable}>
          Désactiver ici
        </Button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
