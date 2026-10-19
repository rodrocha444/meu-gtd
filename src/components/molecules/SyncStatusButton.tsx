import React from 'react';
import { RefreshCw } from 'lucide-react';

type SyncState = 'synced' | 'syncing' | 'offline';

interface SyncStatusButtonProps {
  syncState: SyncState;
  showLabel?: boolean;
  onClick: () => void;
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({
  syncState,
  showLabel = true,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition-colors border ${
      syncState === 'offline'
        ? 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
    }`}
  >
    <RefreshCw
      className={`w-3.5 h-3.5 ${
        syncState === 'syncing'
          ? 'animate-spin text-indigo-400'
          : syncState === 'offline'
          ? 'text-amber-400'
          : 'text-emerald-400'
      }`}
    />
    {showLabel && (
      <span className="font-medium">
        {syncState === 'offline'
          ? 'Desconectado'
          : syncState === 'syncing'
          ? 'Carregando...'
          : 'Conectado'}
      </span>
    )}
  </button>
);
