import React from 'react';
import { Folder, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import type { UINoteFolder } from '../../types/note';

interface FolderListItemProps {
  folder: UINoteFolder;
  isActive: boolean;
  count: number;
  showDetails?: boolean;
  level?: number;
  onSelect: (folderId: string) => void;
  onDelete?: (folder: UINoteFolder) => void;
  onDropNote?: (noteId: string) => void;
  onDropFolder?: (draggedFolderId: string) => void;
}

export const FolderListItem: React.FC<FolderListItemProps> = ({
  folder,
  isActive,
  count,
  showDetails = true,
  level = 0,
  onSelect,
  onDelete,
  onDropNote,
  onDropFolder,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/x-folder-id', folder.id);
    e.dataTransfer.setData('text/plain', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    void NativeBridge.hapticLightImpact();
  };

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragOver={(e) => {
        if (!onDropNote && !onDropFolder) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!onDropNote && !onDropFolder) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!onDropNote && !onDropFolder) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        if (!onDropNote && !onDropFolder) return;
        e.preventDefault();
        setIsDragOver(false);
        const draggedFolderId = e.dataTransfer.getData('application/x-folder-id');
        const noteId =
          e.dataTransfer.getData('application/x-note-id') ||
          (!draggedFolderId ? e.dataTransfer.getData('text/plain') : null);

        if (draggedFolderId && onDropFolder) {
          if (draggedFolderId !== folder.id) {
            void NativeBridge.hapticMediumImpact();
            onDropFolder(draggedFolderId);
          }
        } else if (noteId && onDropNote) {
          void NativeBridge.hapticMediumImpact();
          onDropNote(noteId);
        }
      }}
      data-folder-drop-id={folder.id}
      style={{
        paddingLeft: level > 0 ? `${12 + level * 12}px` : undefined,
      }}
      className={`group relative flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragOver
          ? 'scale-105 ring-2 ring-violet-500 bg-violet-500/20 text-white shadow-lg'
          : isActive
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
    >
      <button
        type="button"
        draggable={false}
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onSelect(folder.id);
        }}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <Folder
          className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105"
          style={{ color: folder.color }}
        />
        {showDetails && (
          <span className="truncate flex-1 text-left text-zinc-200">
            {folder.name}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {count > 0 && (
            <span className="text-[11px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full bg-zinc-800/80">
              {count}
            </span>
          )}
          {onDelete && (
            <button
              type="button"
              draggable={false}
              aria-label={`Excluir pasta ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                void NativeBridge.hapticLightImpact();
                onDelete(folder);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-red-400 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
