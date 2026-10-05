import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import type { useAccount } from '../hooks/useAccount';
import Button from './Button';
import GoogleButton from './GoogleButton';

type Account = ReturnType<typeof useAccount>;

const STATUS = {
  idle: { icon: Cloud, text: 'Connecté', color: 'text-muted' },
  syncing: { icon: RefreshCw, text: 'Synchronisation…', color: 'text-blue-ink' },
  ok: { icon: Cloud, text: 'Progression synchronisée', color: 'text-green-ink' },
  error: { icon: CloudOff, text: 'Synchro impossible pour le moment', color: 'text-red-ink' },
} as const;

/** Carte « Compte » : bouton Google si déconnecté, sinon profil + état de la synchro. Masquée si l'API n'est pas configurée. */
export default function AccountCard({ account }: { account: Account }) {
  const { clientId, user, status } = account;
  if (!clientId && !user) return null;

  if (!user) {
    return (
      <div className="rounded-xl2 border-2 border-line p-4">
        <p className="mb-3 font-bold text-ink">Retrouve ta progression sur tous tes appareils</p>
        <GoogleButton clientId={clientId!} onCredential={account.signIn} />
        <p className="mt-3 text-sm text-muted">Facultatif : sans compte, tout reste enregistré dans ce navigateur.</p>
      </div>
    );
  }

  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <div className="rounded-xl2 border-2 border-line p-4">
      <div className="flex items-center gap-3">
        {user.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-full bg-blue-light" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{user.name}</p>
          <p className={`flex items-center gap-1 text-sm font-bold ${s.color}`}>
            <Icon size={14} className={status === 'syncing' ? 'animate-spin' : ''} /> {s.text}
          </p>
        </div>
      </div>
      <Button variant="white" className="mt-3 flex items-center gap-2 !py-2 !text-sm" onClick={() => void account.signOut()}>
        <LogOut size={16} /> Se déconnecter
      </Button>
    </div>
  );
}
