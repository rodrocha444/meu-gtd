import React, { useState } from 'react';
import { Folder, GripVertical, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import type { UINoteFolder } from '../../types/note';

interface FolderTileProps {
  folder: UINoteFolder;
  noteCount: number;
  subfolderCount?: number;
  layout?: 'grid' | 'list';
  isDragging?: boolean;
  onOpen: (folderId: string) => void;
  onDelete?: (folder: UINoteFolder) => void;
  onDropNote: (noteId: string, folderId: string) => void;
  onDropFolder?: (draggedFolderId: string, targetFolderId: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
}

export const FolderTile: React.FC<FolderTileProps> = ({
  folder,
  noteCount,
  subfolderCount = 0,
  layout = 'list',
  isDragging = false,
  onOpen,
  onDelete,
  onDropNote,
  onDropFolder,
  onDragStart,
  onDragEnd,
  onTouchStart,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/x-folder-id', folder.id);
    e.dataTransfer.setData('text/plain', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    void NativeBridge.hapticLightImpact();
    if (onDragStart) {
      setTimeout(() => {
        onDragStart(e);
      }, 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const folderId = e.dataTransfer.getData('application/x-folder-id');
    const noteId =
      e.dataTransfer.getData('application/x-note-id') ||
      (!folderId ? e.dataTransfer.getData('text/plain') : null);

    if (folderId) {
      if (folderId !== folder.id && onDropFolder) {
        void NativeBridge.hapticMediumImpact();
        onDropFolder(folderId, folder.id);
      }
    } else if (noteId) {
      void NativeBridge.hapticMediumImpact();
      onDropNote(noteId, folder.id);
    }
  };

  const subtitle = () => {
    const parts: string[] = [];
    if (subfolderCount > 0) {
      parts.push(subfolderCount === 1 ? '1 subpasta' : `${subfolderCount} subpastas`);
    }
    if (noteCount > 0) {
      parts.push(noteCount === 1 ? '1 anotação' : `${noteCount} anotações`);
    }
    if (parts.length === 0) return 'Vazia';
    return parts.join(' • ');
  };

  if (layout === 'grid') {
    return (
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTouchStart={onTouchStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-folder-drop-id={folder.id}
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onOpen(folder.id);
        }}
        className={`group relative flex flex-col items-center justify-between text-center p-3 sm:p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none h-full min-h-[135px] ${
          isDragging
            ? 'opacity-40 border-violet-500 bg-violet-500/10 shadow-2xl scale-95 ring-2 ring-violet-500/50'
            : isDragOver
            ? 'scale-105 ring-2 ring-violet-500 bg-violet-500/20 border-violet-500 shadow-xl'
            : 'bg-zinc-900/60 hover:bg-zinc-800/80 active:bg-zinc-800 border-zinc-800/80 hover:border-zinc-700/80 shadow-sm'
        }`}
        style={
          isDragOver
            ? {
                backgroundColor: `${folder.color}25`,
                borderColor: folder.color,
                boxShadow: `0 0 16px ${folder.color}40`,
              }
            : undefined
        }
      >
        {/* Botão de Excluir Flutuante */}
        {onDelete && (
          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={`Excluir pasta ${folder.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void NativeBridge.hapticLightImpact();
              onDelete(folder);
            }}
            className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 rounded-lg bg-zinc-800/90 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700/60 transition-all z-10"
            title="Excluir pasta"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        {/* Ícone de Pasta Estilo OS (com aba e profundidade) */}
        <div className="relative my-auto flex items-center justify-center pt-1 pb-1">
          <div
            className="w-14 h-12 rounded-xl flex items-center justify-center relative shadow-md transition-transform duration-200 group-hover:scale-105"
            style={{
              backgroundColor: `${folder.color}18`,
              border: `1.5px solid ${folder.color}45`,
              boxShadow: `0 4px 12px ${folder.color}15`,
            }}
          >
            <Folder
              className="w-7 h-7 drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
              style={{ color: folder.color }}
              fill={`${folder.color}35`}
            />
          </div>

          {(noteCount > 0 || subfolderCount > 0) && (
            <span
              className="absolute -bottom-1 -right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-zinc-900/95 border border-zinc-700/80 text-zinc-300 shadow"
              title={subtitle()}
            >
              {noteCount + subfolderCount}
            </span>
          )}
        </div>

        {/* Nome e subtítulo centralizados abaixo do ícone */}
        <div className="w-full flex flex-col items-center min-w-0 mt-1">
          <h4 className="font-medium text-xs sm:text-sm text-zinc-200 group-hover:text-white transition-colors line-clamp-2 w-full break-words text-center leading-tight">
            {folder.name}
          </h4>
          <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate w-full text-center mt-0.5">
            {subtitle()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={onTouchStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-folder-drop-id={folder.id}
      onClick={() => {
        if (isDragging) return;
        void NativeBridge.hapticLightImpact();
        onOpen(folder.id);
      }}
      className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
        isDragging
          ? 'opacity-40 border-violet-500 bg-violet-500/10 shadow-2xl scale-95 ring-2 ring-violet-500/50'
          : isDragOver
          ? 'scale-105 ring-2 ring-violet-500 bg-violet-500/20 border-violet-500 shadow-xl'
          : 'bg-zinc-900/80 hover:bg-zinc-800/80 active:bg-zinc-800 border-zinc-800/90 hover:border-zinc-700/80'
      }`}
      style={
        isDragOver
          ? {
              backgroundColor: `${folder.color}25`,
              borderColor: folder.color,
              boxShadow: `0 0 16px ${folder.color}40`,
            }
          : undefined
      }
    >
      <div
        title="Arraste para mover para outra pasta"
        className="text-zinc-600 group-hover:text-zinc-400 p-0.5 rounded transition-colors shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{
          backgroundColor: `${folder.color}20`,
          border: `1px solid ${folder.color}40`,
        }}
      >
        <Folder className="w-5 h-5 shrink-0" style={{ color: folder.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-xs sm:text-sm text-zinc-100 group-hover:text-violet-300 transition-colors truncate">
          {folder.name}
        </h4>
        <p className="text-[11px] text-zinc-400 truncate">{subtitle()}</p>
      </div>

      {onDelete && (
        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`Excluir pasta ${folder.name}`}
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onDelete(folder);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-zinc-700/60 text-zinc-500 hover:text-red-400 transition-opacity"
          title="Excluir pasta"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
