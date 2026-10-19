import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { parseQuickCaptureInput } from '../../utils/nlpParser';
import { NLPPreviewPills } from '../molecules/NLPPreviewPills';

interface QuickCaptureBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  activeView: string;
}

export const QuickCaptureBar: React.FC<QuickCaptureBarProps> = ({
  value,
  onChange,
  onSubmit,
  activeView,
}) => {
  const liveParsed = useMemo(() => parseQuickCaptureInput(value), [value]);

  return (
    <div className="bottom-keyboard-aware shrink-0 px-3 pt-1 pb-0 mb-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
      {/* Pílulas de Preview dos Metadados Detectados pelo Parser NLP */}
      <NLPPreviewPills parsed={liveParsed} />

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 focus-within:border-indigo-500 rounded-xl px-3 py-2 shadow-lg"
      >
        <Plus className="w-5 h-5 text-zinc-400 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            activeView === 'completed'
              ? 'Capturar nova tarefa para Inbox...'
              : 'Capturar... ex: "Aniversário da Ana 25/10 todo ano" ou "Trocar filtro a cada 15 dias após concluir"'
          }
          className="flex-1 bg-transparent text-base sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-all active:scale-95"
        >
          Capturar
        </button>
      </form>
    </div>
  );
};
