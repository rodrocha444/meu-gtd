import React, { useState } from 'react';
import { Folder, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import type { UINoteFolder } from '../../types/note';

interface FolderTileProps {
  folder: UINoteFolder;
  noteCount: number;
  subfolderCount?: number;
  onOpen: (folderId: string) => void;
  onDelete?: (folder: UINoteFolder) => void;
  onDropNote: (noteId: string, folderId: string) => void;
}

export const FolderTile: React.FC<FolderTileProps> = ({
  folder,
  noteCount,
  subfolderCount = 0,
  onOpen,
  onDelete,
  onDropNote,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

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
    const id =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('application/x-note-id');
    if (id) {
      void NativeBridge.hapticMediumImpact();
      onDropNote(id, folder.id);
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        void NativeBridge.hapticLightImpact();
        onOpen(folder.id);
      }}
      className={`group relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
        isDragOver
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
