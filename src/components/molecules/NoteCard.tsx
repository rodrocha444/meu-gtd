import React from 'react';
import { CheckSquare, FileText, GripVertical, Pin, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { NoteFolderBadge } from '../atoms/NoteFolderBadge';
import {
  htmlToPlainText,
  countChecklistInContent,
} from '../../utils/markdownConverter';
import type { UINote, UINoteFolder } from '../../types/note';

interface NoteCardProps {
  note: UINote;
  folder?: UINoteFolder | null;
  onSelect: (note: UINote) => void;
  onTogglePin: (note: UINote) => void;
  onDelete: (note: UINote) => void;
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
  folder,
  onSelect,
  onTogglePin,
  onDelete,
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
          {folder && (
            <NoteFolderBadge name={folder.name} color={folder.color} size="xs" />
          )}
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

          <div className="flex items-center gap-0.5">
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
            <button
              type="button"
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Excluir anotação"
              onClick={(e) => {
                e.stopPropagation();
                void NativeBridge.hapticLightImpact();
                onDelete(note);
              }}
              className="p-1 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-red-400 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
        void NativeBridge.hapticLightImpact();
        onSelect(note);
      }}
      className={`group relative border rounded-xl p-3 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between select-none min-h-[110px] ${
        isDragging
          ? 'opacity-40 border-violet-500 bg-violet-500/10 shadow-2xl'
          : 'bg-zinc-900/80 hover:bg-zinc-800/80 active:bg-zinc-800/90 border-zinc-800/90 hover:border-zinc-700/80'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div
              title="Arraste para mover para uma pasta"
              className="text-zinc-600 group-hover:text-zinc-400 p-0.5 rounded transition-colors"
            >
              <GripVertical className="w-3.5 h-3.5 shrink-0" />
            </div>
            <h3 className="font-semibold text-xs sm:text-sm text-zinc-100 line-clamp-1 group-hover:text-violet-300 transition-colors">
              {note.title || 'Sem título'}
            </h3>
          </div>
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
            className={`p-1 rounded-md shrink-0 transition-colors ${
              note.isPinned
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-zinc-500 hover:text-zinc-300 opacity-60 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>

        {contentSnippet ? (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed pl-5">
            {contentSnippet}
          </p>
        ) : (
          <p className="text-xs text-zinc-600 italic pl-5">Anotação vazia...</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-800/50 text-[10px] sm:text-[11px] text-zinc-500">
        <div className="flex items-center gap-1.5 min-w-0">
          {folder && (
            <NoteFolderBadge name={folder.name} color={folder.color} size="xs" />
          )}
          {totalChecklist > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700/50">
              <CheckSquare className="w-3 h-3 text-violet-400" />
              <span>
                {completedChecklist}/{totalChecklist}
              </span>
            </span>
          )}
          <span>{formatRelativeDate(note.updatedAt)}</span>
        </div>

        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Excluir anotação"
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onDelete(note);
          }}
          className="p-1 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-red-400 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
