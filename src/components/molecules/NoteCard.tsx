import React from 'react';
import { CheckSquare, FileText, GripVertical, Pin } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import {
  htmlToPlainText,
  countChecklistInContent,
} from '../../utils/markdownConverter';
import type { UINote } from '../../types/note';

interface NoteCardProps {
  note: UINote;
  onSelect: (note: UINote) => void;
  onTogglePin: (note: UINote) => void;
  layout?: 'grid' | 'list';
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
}

function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days}d atrás`;
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onSelect,
  onTogglePin,
  layout = 'list',
  isDragging = false,
  onDragStart,
  onDragEnd,
  onTouchStart,
}) => {
  const plainText = htmlToPlainText(note.content);
  const contentSnippet = plainText.slice(0, 160);
  const { total: totalChecklist, completed: completedChecklist } =
    countChecklistInContent(note.content);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', note.id);
    e.dataTransfer.setData('application/x-note-id', note.id);
    e.dataTransfer.effectAllowed = 'move';
    void NativeBridge.hapticLightImpact();
    if (onDragStart) {
      setTimeout(() => {
        onDragStart(e);
      }, 0);
    }
  };

  if (layout === 'list') {
    return (
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onTouchStart={onTouchStart}
        onClick={() => {
          if (isDragging) return;
          void NativeBridge.hapticLightImpact();
          onSelect(note);
        }}
        className={`group relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
          isDragging
            ? 'opacity-40 border-violet-500 bg-violet-500/10 shadow-2xl'
            : 'border-zinc-800/80 bg-zinc-900/90 hover:bg-zinc-800/70 hover:border-zinc-700/80 active:bg-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            title="Arraste para mover para uma pasta"
            className="text-zinc-600 group-hover:text-zinc-400 p-0.5 rounded transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <FileText className="w-4 h-4 text-zinc-500 shrink-0 group-hover:text-violet-400 transition-colors" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-zinc-100 group-hover:text-violet-300 transition-colors truncate">
                {note.title || 'Sem título'}
              </span>
              {note.isPinned && (
                <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/20" />
              )}
            </div>
            {contentSnippet ? (
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                {contentSnippet}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-600 italic">Vazia</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {totalChecklist > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700/50">
              <CheckSquare className="w-3 h-3 text-violet-400" />
              <span>
                {completedChecklist}/{totalChecklist}
              </span>
            </span>
          )}
          <span className="text-[10px] sm:text-[11px] text-zinc-500 whitespace-nowrap">
            {formatRelativeDate(note.updatedAt)}
          </span>

          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={note.isPinned ? 'Desafixar anotação' : 'Fixar anotação'}
            onClick={(e) => {
              e.stopPropagation();
              void NativeBridge.hapticLightImpact();
              onTogglePin(note);
            }}
            className={`p-1 rounded-md transition-colors ${
              note.isPinned
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-zinc-500 hover:text-zinc-300 opacity-60 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onClick={() => {
        if (isDragging) return;
        void NativeBridge.hapticLightImpact();
        onSelect(note);
      }}
      className={`group relative flex flex-col items-center justify-between text-center p-3 sm:p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none h-full min-h-[135px] ${
        isDragging
          ? 'opacity-40 border-violet-500 bg-violet-500/10 shadow-2xl scale-95 ring-2 ring-violet-500/50'
          : 'bg-zinc-900/60 hover:bg-zinc-800/80 active:bg-zinc-800 border-zinc-800/80 hover:border-zinc-700/80 shadow-sm'
      }`}
    >
      {/* Botões de Ação Flutuantes (Fixar / Excluir) estilo OS */}
      <div className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 flex items-center gap-1 transition-all z-10">
        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={note.isPinned ? 'Desafixar anotação' : 'Fixar anotação'}
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onTogglePin(note);
          }}
          className={`p-1 rounded-lg border transition-colors ${
            note.isPinned
              ? 'text-amber-400 bg-amber-400/20 border-amber-500/40'
              : 'text-zinc-400 hover:text-amber-300 bg-zinc-800/90 border-zinc-700/60'
          }`}
          title={note.isPinned ? 'Desafixar anotação' : 'Fixar anotação'}
        >
          <Pin className="w-3 h-3" />
        </button>
      </div>

      {/* Ícone de Documento / Arquivo Estilo OS */}
      <div className="relative my-auto flex items-center justify-center pt-1 pb-1">
        <div className="w-12 h-14 rounded-xl bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 border border-zinc-700/80 group-hover:border-violet-500/50 shadow-md flex flex-col items-center justify-center p-2 relative overflow-hidden transition-transform duration-200 group-hover:scale-105">
          {/* Canto dobrado clássico de documento OS */}
          <div className="absolute top-0 right-0 w-3 h-3 bg-zinc-700/70 border-b border-l border-zinc-600/70 rounded-bl-sm" />

          <FileText className="w-5 h-5 text-zinc-400 group-hover:text-violet-400 transition-colors mb-1" />

          {/* Linhas simuladas de texto do arquivo */}
          <div className="w-6 h-0.5 bg-zinc-600/60 rounded-full mb-0.5" />
          <div className="w-4 h-0.5 bg-zinc-600/40 rounded-full" />
        </div>

        {/* Badge de fixado no canto do documento */}
        {note.isPinned && (
          <div className="absolute -top-1.5 -left-1.5 p-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-sm">
            <Pin className="w-2.5 h-2.5 fill-amber-400" />
          </div>
        )}

        {/* Badge de progresso do checklist */}
        {totalChecklist > 0 && (
          <span className="absolute -bottom-1 -right-1.5 inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[9px] font-bold bg-zinc-900/95 border border-zinc-700/80 text-violet-300 shadow">
            <CheckSquare className="w-2.5 h-2.5 text-violet-400" />
            <span>
              {completedChecklist}/{totalChecklist}
            </span>
          </span>
        )}
      </div>

      {/* Título e Metadados abaixo do ícone (como pastas/arquivos de OS) */}
      <div className="w-full flex flex-col items-center min-w-0 mt-1">
        <h4 className="font-medium text-xs sm:text-sm text-zinc-200 group-hover:text-white transition-colors line-clamp-2 w-full break-words text-center leading-tight">
          {note.title || 'Sem título'}
        </h4>
        <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate w-full text-center mt-0.5">
          <span>{formatRelativeDate(note.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
};
