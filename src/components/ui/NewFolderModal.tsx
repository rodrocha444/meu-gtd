import React, { useState, useRef, useEffect } from 'react';
import { Folder, X } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { SheetHandle } from '../atoms/SheetHandle';

import type { UINoteFolder } from '../../types/note';

const FOLDER_PRESET_COLORS = [
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
];

interface NewFolderModalProps {
  isOpen: boolean;
  parentFolder?: UINoteFolder | null;
  initialFolder?: UINoteFolder | null;
  onClose: () => void;
  onCreate: (name: string, color: string, parentId?: string | null) => void;
  onUpdate?: (folderId: string, updates: { name: string; color: string }) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  parentFolder,
  initialFolder,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_PRESET_COLORS[0] ?? '#8b5cf6');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialFolder) {
        setName(initialFolder.name);
        setColor(initialFolder.color);
      } else {
        setName('');
        setColor(FOLDER_PRESET_COLORS[0] ?? '#8b5cf6');
      }
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialFolder]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (initialFolder && onUpdate) {
      onUpdate(initialFolder.id, { name: clean, color });
    } else {
      onCreate(clean, color, parentFolder?.id ?? null);
    }
    setName('');
    setColor(FOLDER_PRESET_COLORS[0] ?? '#8b5cf6');
  };

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
        className="w-full max-w-md max-h-full overflow-y-auto native-scroll-container bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <SheetHandle />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                {initialFolder
                  ? 'Configurações da Pasta'
                  : parentFolder
                  ? `Subpasta de "${parentFolder.name}"`
                  : 'Diretório Raiz'}
              </span>
              <h3 className="text-sm font-bold text-zinc-100">
                {initialFolder
                  ? 'Renomear Pasta'
                  : parentFolder
                  ? 'Nova Subpasta'
                  : 'Nova Pasta'}
              </h3>
            </div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nome da Pasta
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instrução Policial, Estudos, Rascunhos..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:outline-none text-sm text-zinc-100 placeholder-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Cor de Identificação
            </label>
            <div className="flex flex-wrap gap-2.5">
              {FOLDER_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    void NativeBridge.hapticLightImpact();
                    setColor(c);
                  }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c
                      ? 'scale-115 ring-2 ring-offset-2 ring-offset-zinc-900 ring-white'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {initialFolder ? 'Salvar Alterações' : 'Criar Pasta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
