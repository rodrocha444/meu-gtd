import React from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code,
  FileCode,
  Minus,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'codeblock'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'checklist'
  | 'bullet'
  | 'number'
  | 'quote'
  | 'divider';

interface NoteFormattingToolbarProps {
  onAction: (action: FormatAction) => void;
}

const TOOLBAR_BUTTONS: { action: FormatAction; icon: React.ElementType; label: string }[] = [
  { action: 'h1', icon: Heading1, label: 'Título 1' },
  { action: 'h2', icon: Heading2, label: 'Título 2' },
  { action: 'h3', icon: Heading3, label: 'Título 3' },
  { action: 'bold', icon: Bold, label: 'Negrito' },
  { action: 'italic', icon: Italic, label: 'Itálico' },
  { action: 'strike', icon: Strikethrough, label: 'Tachado' },
  { action: 'highlight', icon: Highlighter, label: 'Destaque' },
  { action: 'checklist', icon: CheckSquare, label: 'Lista de Tarefas' },
  { action: 'bullet', icon: List, label: 'Marcadores' },
  { action: 'number', icon: ListOrdered, label: 'Numeração' },
  { action: 'quote', icon: Quote, label: 'Citação' },
  { action: 'code', icon: Code, label: 'Código em Linha' },
  { action: 'codeblock', icon: FileCode, label: 'Bloco de Código' },
  { action: 'divider', icon: Minus, label: 'Linha Divisória' },
];

export const NoteFormattingToolbar: React.FC<NoteFormattingToolbarProps> = ({
  onAction,
}) => {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1 px-3 bg-zinc-950/70 border-y border-zinc-800/60 native-scroll-container shrink-0">
      {TOOLBAR_BUTTONS.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.action}
            type="button"
            aria-label={btn.label}
            title={btn.label}
            onPointerDown={(e) => {
              // Previne a perda de foco/seleção do editor ao clicar ou tocar no botão no iOS/mobile
              e.preventDefault();
              void NativeBridge.hapticLightImpact();
              onAction(btn.action);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95 transition-all shrink-0"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
};
