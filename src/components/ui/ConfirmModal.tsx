import React from 'react';
import { SheetHandle } from '../atoms/SheetHandle';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon: React.ReactNode;
  iconBgClass?: string;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel: string;
  confirmClass?: string;
  cancelLabel?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  icon,
  iconBgClass = 'bg-red-500/10 border-red-500/20 text-red-400',
  title,
  subtitle,
  description,
  confirmLabel,
  confirmClass = 'bg-red-600 hover:bg-red-500',
  cancelLabel = 'Cancelar',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-xs p-0 md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom:
            'max(1.25rem, calc(var(--safe-bottom, 0px) - var(--keyboard-height, 0px)))',
        }}
        className="w-full max-w-sm max-h-full overflow-y-auto native-scroll-container bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 md:pb-5 space-y-4 shadow-2xl"
      >
        <SheetHandle />

        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconBgClass}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
            {subtitle && (
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-3 break-words whitespace-pre-wrap">&ldquo;{subtitle}&rdquo;</p>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
