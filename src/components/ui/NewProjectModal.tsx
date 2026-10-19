import React, { useState } from 'react';
import { X } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { SheetHandle } from '../atoms/SheetHandle';

const PROJECT_PRESET_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#3b82f6', // Blue
];

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_PRESET_COLORS[0] ?? '#6366f1');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onCreate(clean, color);
    setName('');
    setColor(PROJECT_PRESET_COLORS[0] ?? '#6366f1');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-xs p-0 md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <SheetHandle />

        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              Estrutura GTD (Horizonte 1)
            </span>
            <h3 className="text-sm font-bold text-zinc-100 mt-0.5">
              Novo Projeto GTD
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          No método GTD, um <strong>Projeto</strong> é qualquer compromisso que requer mais de uma ação física para ser concluído.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nome do Projeto / Resultado Desejado
            </label>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Reforma do Escritório, Lançamento v2..."
              className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Cor de Identificação
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PROJECT_PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  aria-label={`Selecionar cor ${col}`}
                  onClick={() => {
                    void NativeBridge.hapticLightImpact();
                    setColor(col);
                  }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === col
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white shadow-lg transition-colors"
            >
              Criar Projeto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
