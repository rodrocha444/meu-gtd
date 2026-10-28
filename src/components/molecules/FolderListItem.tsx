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
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (!onDropNote) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!onDropNote) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!onDropNote) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        if (!onDropNote) return;
        e.preventDefault();
        setIsDragOver(false);
        const id =
          e.dataTransfer.getData('text/plain') ||
          e.dataTransfer.getData('application/x-note-id');
        if (id) {
          void NativeBridge.hapticMediumImpact();
          onDropNote(id);
        }
      }}
      style={{
        paddingLeft: level > 0 ? `${12 + level * 12}px` : undefined,
      }}
      className={`group relative flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
        isDragOver
          ? 'scale-105 ring-2 ring-violet-500 bg-violet-500/20 text-white shadow-lg'
          : isActive
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
    >
      <button
        type="button"
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
