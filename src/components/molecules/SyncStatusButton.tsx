import React from 'react';
import { RefreshCw } from 'lucide-react';

export type SyncState = 'synced' | 'syncing' | 'offline';

export interface SyncStatusButtonProps {
  syncState: SyncState;
  showLabel?: boolean;
  pendingCount?: number;
  onClick: () => void;
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({
  syncState,
  showLabel = true,
  pendingCount = 0,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={
      pendingCount > 0
        ? `${pendingCount} alteração(ões) salva(s) localmente aguardando sincronização`
        : syncState === 'offline'
        ? 'Dispositivo desconectado (modo offline local-first ativo)'
        : 'Conectado e sincronizado com o Turso Cloud'
    }
    className={`w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition-colors border ${
      syncState === 'offline'
        ? 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 border-amber-500/30'
        : pendingCount > 0
        ? 'bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
    }`}
  >
    <RefreshCw
      className={`w-3.5 h-3.5 shrink-0 ${
        syncState === 'syncing'
          ? 'animate-spin text-indigo-400'
          : syncState === 'offline'
          ? 'text-amber-400'
          : 'text-emerald-400'
      }`}
    />
    {showLabel && (
      <span className="font-medium truncate">
        {syncState === 'syncing'
          ? 'Sincronizando...'
          : syncState === 'offline'
          ? pendingCount > 0
            ? `Offline (${pendingCount})`
            : 'Offline'
          : pendingCount > 0
          ? `Pendente (${pendingCount})`
          : 'Sincronizado'}
      </span>
    )}
  </button>
);
