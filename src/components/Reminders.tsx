import { Bell, BellOff } from 'lucide-react';
import type { usePush } from '../hooks/usePush';
import Button from './Button';

type Push = ReturnType<typeof usePush>;

const HELP: Partial<Record<Push['status'], string>> = {
  unsupported: "Ce navigateur ne gère pas les notifications (ou l'app n'est pas la version installée/déployée).",
  'ios-install': "Sur iPhone et iPad, les notifications ne marchent que si l'app est installée : Partager → « Sur l'écran d'accueil », puis rouvre-la depuis l'icône.",
  login: 'Connecte-toi avec Google (juste au-dessus) pour activer les rappels : ils sont liés à ton compte.',
  unavailable: "Les rappels ne sont pas encore configurés sur le serveur.",
  denied: 'Les notifications sont bloquées pour ce site : autorise-les dans les réglages de ton navigateur, puis recharge la page.',
};

const timeInput = 'rounded-xl2 border-2 border-line bg-soft px-3 py-2 font-bold text-ink';

function Choice({ value, onPick, options }: { value: number; onPick: (n: number) => void; options: number[] }) {
  return (
    <div role="radiogroup" aria-label="Mots surprise par jour" className="flex flex-wrap gap-2">
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
          {n === 0 ? 'Aucun' : n}
        </button>
      ))}
    </div>
  );
}

/** Réglages des rappels : un rappel quotidien + quelques mots surprise avec leur définition. */
export default function Reminders({ push }: { push: Push }) {
  const { status, prefs } = push;

  if (status !== 'on' && status !== 'off') {
    return (
      <p className="flex gap-2 rounded-xl2 border-2 border-line p-4 text-muted">
        <BellOff size={20} className="mt-0.5 shrink-0" />
        {HELP[status]}
      </p>
    );
  }

  if (status === 'off' || !prefs) {
    return (
      <div className="rounded-xl2 border-2 border-line p-4">
        <p className="mb-3 font-bold text-ink">Un rappel par jour, et des mots surprise avec leur définition : tu apprends sans t'en rendre compte.</p>
        <Button className="flex items-center gap-2" disabled={push.busy} onClick={() => void push.enable()}>
          <Bell size={18} /> Activer sur cet appareil
        </Button>
        {push.message && <p className="mt-3 text-sm text-red-ink">{push.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl2 border-2 border-line p-4">
      <div>
        <label className="flex items-center gap-3 font-bold text-ink">
          <input
            type="checkbox"
            checked={prefs.reminder}
            onChange={(e) => void push.update({ reminder: e.target.checked })}
            className="h-5 w-5 accent-[#1CB0F6]"
          />
          Rappel quotidien d'apprendre
        </label>
        {prefs.reminder && (
          <div className="mt-2 flex items-center gap-2 pl-8">
            <label htmlFor="reminder-time" className="text-muted">
              à
            </label>
            <input id="reminder-time" type="time" value={prefs.reminderTime} onChange={(e) => e.target.value && void push.update({ reminderTime: e.target.value })} className={timeInput} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 font-bold text-ink">Mots surprise par jour</p>
        <Choice value={prefs.surprise} onPick={(n) => void push.update({ surprise: n })} options={[0, 1, 2, 3, 4]} />
        {prefs.surprise > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="from" className="text-muted">
              entre
            </label>
            <input id="from" type="time" value={prefs.from} onChange={(e) => e.target.value && void push.update({ from: e.target.value })} className={timeInput} />
            <label htmlFor="to" className="text-muted">
              et
            </label>
            <input id="to" type="time" value={prefs.to} onChange={(e) => e.target.value && void push.update({ to: e.target.value })} className={timeInput} />
          </div>
        )}
        <p className="mt-2 text-sm text-muted">Chaque mot arrive à une heure un peu différente chaque jour, avec sa définition en anglais et en français.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="white" className="!py-2 !text-sm" disabled={push.busy} onClick={() => void push.test()}>
          Envoyer un test
        </Button>
        <Button variant="white" className="!py-2 !text-sm !text-red-ink" disabled={push.busy} onClick={() => void push.disable()}>
          Désactiver ici
        </Button>
      </div>
      {push.message && <p className="text-sm text-muted">{push.message}</p>}
    </div>
  );
}
