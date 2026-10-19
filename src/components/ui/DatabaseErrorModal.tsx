import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';

export interface DatabaseErrorInfo {
  title?: string;
  message?: string;
  operation: string;
  detail?: string;
  isNetworkError?: boolean;
  onRetry?: () => Promise<void> | void;
}

interface DatabaseErrorModalProps {
  error: DatabaseErrorInfo | null;
  onClose: () => void;
  onRetry?: () => Promise<void> | void;
}

export function isNetworkOrOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('internet') ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout') ||
    msg.includes('tempo limite') ||
    msg.includes('esgotado') ||
    msg.includes('fetch') ||
    msg.includes('hrana') ||
    msg.includes('socket') ||
    msg.includes('abort')
  );
}

export const DatabaseErrorModal: React.FC<DatabaseErrorModalProps> = ({
  error,
  onClose,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  if (!error) return null;

  const retryHandler = onRetry ?? error.onRetry;
  const isNet =
    error.isNetworkError ??
    (typeof navigator !== 'undefined' && !navigator.onLine);

  const handleRetryClick = async () => {
    if (!retryHandler || isRetrying) return;
    try {
      setIsRetrying(true);
      void NativeBridge.hapticLightImpact();
      await retryHandler();
      void NativeBridge.hapticSwipeAction();
      onClose();
    } catch (err) {
      void NativeBridge.hapticError();
      console.error('Falha ao tentar novamente operação no banco:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClose = () => {
    void NativeBridge.hapticLightImpact();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xs p-0 md:p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 md:p-6 space-y-4 shadow-2xl text-zinc-100 animate-in slide-in-from-bottom-6 duration-200"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                isNet
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {isNet ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <Database className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${
                    isNet
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-red-500/15 border-red-500/30 text-red-300'
                  }`}
                >
                  {isNet ? 'Conexão Offline' : 'Erro no Banco'}
                </span>
              </div>
              <h3 className="text-base font-bold text-zinc-100 mt-1">
                {error.title ??
                  (isNet
                    ? 'Sem Conexão com o Banco'
                    : 'Falha na Operação do Banco')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Descrição e Operação */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {error.message ??
              (isNet
                ? 'Não foi possível sincronizar suas alterações devido à falta de conexão com a internet. Verifique sua rede e tente novamente.'
                : 'Ocorreu um erro inesperado ao executar a operação no banco de dados. Os dados podem não ter sido persistidos na nuvem.')}
          </p>

          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Operação:</span>
            <span className="text-indigo-300 font-medium truncate">
              {error.operation}
            </span>
          </div>
        </div>

        {/* Detalhes Técnicos Expansíveis */}
        {error.detail && (
          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/40">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80" />
                <span>Detalhes técnicos</span>
              </span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showDetails && (
              <div className="p-3 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-400 bg-zinc-950/90 break-words max-h-36 overflow-y-auto select-text">
                {error.detail}
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Fechar
          </button>
          {retryHandler && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={() => void handleRetryClick()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
              />
              <span>{isRetrying ? 'Tentando...' : 'Tentar Novamente'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
