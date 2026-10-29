import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Pin,
  Plus,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { FolderTile } from '../molecules/FolderTile';
import { NoteCard } from '../molecules/NoteCard';
import { isDescendantFolder } from '../../utils/folderUtils';
import type { UINote, UINoteFolder } from '../../types/note';

interface NotesViewProps {
  notes: UINote[];
  folders: UINoteFolder[];
  activeFolderId: string; // 'all' (raiz) ou ID da pasta atual
  onSelectFolder: (folderId: string) => void;
  onSelectNote: (note: UINote) => void;
  onCreateNote: (folderId?: string | null) => void;
  onTogglePin: (note: UINote) => void;
  onDeleteNote: (note: UINote) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onDeleteFolder?: (folder: UINoteFolder) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void;
  onMoveFolderToFolder?: (folderId: string, targetParentId: string | null) => void;
}

const DRAG_ACTIVATION_DELAY_MS = 450;

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  folders,
  activeFolderId,
  onSelectFolder,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDeleteNote: _onDeleteNote,
  onCreateFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
  onMoveFolderToFolder,
}) => {
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('meu_gtd_notes_layout') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverGoUp, setDragOverGoUp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const touchDragRef = useRef<{ noteId?: string; folderId?: string } | null>(null);
  const dragTimeoutRef = useRef<number | null>(null);
  const pendingTouchRef = useRef<{
    noteId?: string;
    folderId?: string;
    startX: number;
    startY: number;
  } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const cancelPendingDrag = () => {
    if (dragTimeoutRef.current !== null) {
      window.clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    pendingTouchRef.current = null;
  };

  useEffect(() => {
    return () => {
      cancelPendingDrag();
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleSetLayout = (newLayout: 'grid' | 'list') => {
    void NativeBridge.hapticLightImpact();
    setLayout(newLayout);
    try {
      localStorage.setItem('meu_gtd_notes_layout', newLayout);
    } catch {
      // ignore
    }
  };

  const folderMap = useMemo(() => {
    const map = new Map<string, UINoteFolder>();
    for (const f of folders) {
      map.set(f.id, f);
    }
    return map;
  }, [folders]);

  const currentFolder = useMemo(() => {
    if (activeFolderId === 'all') return null;
    return folderMap.get(activeFolderId) ?? null;
  }, [activeFolderId, folderMap]);

  const handleDropOnFolder = (noteId: string, targetFolderId: string | null) => {
    onMoveNoteToFolder(noteId, targetFolderId);
    setDraggedNoteId(null);

    const folderName = targetFolderId
      ? folderMap.get(targetFolderId)?.name ?? 'Pasta'
      : 'Diretório Raiz (Anotações)';

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(`Anotação movida para "${folderName}"`);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleDropFolderOnFolder = (folderId: string, targetFolderId: string | null) => {
    if (folderId === targetFolderId) return;

    if (targetFolderId && isDescendantFolder(folders, folderId, targetFolderId)) {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      setToastMessage('Não é possível mover uma pasta para dentro de si mesma ou de suas subpastas');
      toastTimeoutRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      setDraggedFolderId(null);
      return;
    }

    if (onMoveFolderToFolder) {
      onMoveFolderToFolder(folderId, targetFolderId);
    }
    setDraggedFolderId(null);

    const sourceFolder = folderMap.get(folderId);
    const targetFolder = targetFolderId ? folderMap.get(targetFolderId) : null;
    const folderName = sourceFolder?.name ?? 'Pasta';
    const destName = targetFolder ? `"${targetFolder.name}"` : 'Diretório Raiz (Anotações)';

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(`Pasta "${folderName}" movida para ${destName}`);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Suporte a Touch Dragging no Mobile com atraso intencional (press & hold)
  const handleTouchStartNote = (noteId: string, e: React.TouchEvent) => {
    cancelPendingDrag();
    const touch = e.touches[0];
    if (!touch) return;

    pendingTouchRef.current = {
      noteId,
      startX: touch.clientX,
      startY: touch.clientY,
    };

    dragTimeoutRef.current = window.setTimeout(() => {
      void NativeBridge.hapticMediumImpact();
      touchDragRef.current = { noteId };
      setDraggedNoteId(noteId);
      dragTimeoutRef.current = null;
    }, DRAG_ACTIVATION_DELAY_MS);
  };

  const handleTouchStartFolder = (folderId: string, e: React.TouchEvent) => {
    cancelPendingDrag();
    const touch = e.touches[0];
    if (!touch) return;

    pendingTouchRef.current = {
      folderId,
      startX: touch.clientX,
      startY: touch.clientY,
    };

    dragTimeoutRef.current = window.setTimeout(() => {
      void NativeBridge.hapticMediumImpact();
      touchDragRef.current = { folderId };
      setDraggedFolderId(folderId);
      dragTimeoutRef.current = null;
    }, DRAG_ACTIVATION_DELAY_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    // Se ainda estiver aguardando o tempo de ativação e o usuário mover o dedo (ex: rolando a lista), cancela o arrasto
    if (pendingTouchRef.current && !touchDragRef.current) {
      const dx = Math.abs(touch.clientX - pendingTouchRef.current.startX);
      const dy = Math.abs(touch.clientY - pendingTouchRef.current.startY);
      if (dx > 10 || dy > 10) {
        cancelPendingDrag();
      }
      return;
    }

    if (!touchDragRef.current) return;
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropTarget = elem?.closest('[data-folder-drop-id]');
    if (dropTarget) {
      // Target visual se necessário
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Se soltou o toque antes de atingir o tempo de ativação, cancela o timer
    cancelPendingDrag();

    if (!touchDragRef.current) return;
    const { noteId, folderId } = touchDragRef.current;
    const touch = e.changedTouches[0];
    if (touch) {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTarget = elem?.closest('[data-folder-drop-id]');
      if (dropTarget) {
        const rawTargetId = dropTarget.getAttribute('data-folder-drop-id');
        const targetFolderId =
          rawTargetId === 'root'
            ? null
            : rawTargetId === 'parent'
            ? currentFolder?.parentId ?? null
            : rawTargetId;

        if (folderId) {
          handleDropFolderOnFolder(folderId, targetFolderId);
        } else if (noteId) {
          handleDropOnFolder(noteId, targetFolderId);
        }
      }
    }
    touchDragRef.current = null;
    setDraggedNoteId(null);
    setDraggedFolderId(null);
  };

  const handleTouchCancel = () => {
    cancelPendingDrag();
    touchDragRef.current = null;
    setDraggedNoteId(null);
    setDraggedFolderId(null);
  };

  // Subpastas no diretório atual (ou raiz)
  const currentSubfolders = useMemo(() => {
    const targetParentId = activeFolderId === 'all' ? null : activeFolderId;
    return folders
      .filter((f) => (targetParentId === null ? !f.parentId : f.parentId === targetParentId))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders, activeFolderId]);

  // Anotações no diretório atual (ou notas sem pasta quando no diretório raiz)
  const currentNotes = useMemo(() => {
    const targetFolderId = activeFolderId === 'all' ? null : activeFolderId;
    return notes
      .filter((n) => (targetFolderId === null ? !n.folderId : n.folderId === targetFolderId))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, activeFolderId]);

  const pinnedNotes = useMemo(
    () => currentNotes.filter((n) => n.isPinned),
    [currentNotes]
  );
  const unpinnedNotes = useMemo(
    () => currentNotes.filter((n) => !n.isPinned),
    [currentNotes]
  );

  // Contagem de notas e subpastas para um diretório
  const getCountsForFolder = (folderId: string) => {
    const noteCount = notes.filter((n) => n.folderId === folderId).length;
    const subfolderCount = folders.filter((f) => f.parentId === folderId).length;
    return { noteCount, subfolderCount };
  };

  // Navegar um nível acima (ou para a raiz)
  const handleGoUp = () => {
    void NativeBridge.hapticLightImpact();
    if (activeFolderId === 'all') return;
    if (currentFolder?.parentId) {
      onSelectFolder(currentFolder.parentId);
    } else {
      onSelectFolder('all');
    }
  };

  return (
    <div
      className="flex flex-col h-full space-y-4"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* =========================================================================
          BARRA DE FERRAMENTAS / CABEÇALHO DE AÇÕES
          ========================================================================= */}
      <div className="flex items-center justify-between gap-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2">
          {/* Botão Subir Nível / Voltar (←) se estiver dentro de uma pasta */}
          {activeFolderId !== 'all' && (
            <button
              type="button"
              data-folder-drop-id="parent"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverGoUp(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverGoUp(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverGoUp(false);
                const fId =
                  e.dataTransfer.getData('application/x-folder-id') ||
                  draggedFolderId;
                const nId =
                  e.dataTransfer.getData('application/x-note-id') ||
                  (!fId ? e.dataTransfer.getData('text/plain') : null) ||
                  draggedNoteId;
                const targetParent = currentFolder?.parentId ?? null;
                if (fId) {
                  handleDropFolderOnFolder(fId, targetParent);
                } else if (nId) {
                  handleDropOnFolder(nId, targetParent);
                }
              }}
              onClick={handleGoUp}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border active:scale-95 shadow-sm text-xs font-medium transition-all ${
                dragOverGoUp
                  ? 'ring-2 ring-violet-400 bg-violet-500/30 text-white border-violet-400 scale-105'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700'
              }`}
              title={`Voltar / Subir um nível (Solte aqui para mover para ${
                currentFolder?.parentId ? 'a pasta superior' : 'o diretório raiz'
              })`}
              aria-label="Subir nível"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}

          {/* Alternâncias de Visualização (Lista / Grade) */}
          <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-xl border border-zinc-800 shrink-0">
            <button
              type="button"
              aria-label="Exibir em Lista"
              onClick={() => handleSetLayout('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                layout === 'list'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Exibição em Lista (Detalhes)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Exibir em Matriz"
              onClick={() => handleSetLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                layout === 'grid'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Exibição em Matriz (Ícones / Pastas OS)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botões de Ação no Diretório Atual */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onCreateFolder(activeFolderId === 'all' ? null : activeFolderId);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 text-xs font-semibold transition-all active:scale-95"
            title={
              currentFolder
                ? `Criar subpasta dentro de "${currentFolder.name}"`
                : 'Criar pasta no diretório raiz'
            }
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">
              {currentFolder ? 'Nova Subpasta' : 'Nova Pasta'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticMediumImpact();
              onCreateNote(activeFolderId === 'all' ? null : activeFolderId);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-900/20 transition-all active:scale-95"
            title={
              currentFolder
                ? `Criar anotação dentro de "${currentFolder.name}"`
                : 'Criar anotação no diretório raiz'
            }
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FEEDBACK FLUTUANTE DE ARRASTO E STATUS
          ========================================================================= */}
      {(draggedNoteId || draggedFolderId) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900/95 border border-violet-500/60 text-violet-200 text-xs font-semibold shadow-2xl backdrop-blur-md animate-pulse">
          <Folder className="w-4 h-4 text-violet-400 shrink-0" />
          <span>
            {draggedFolderId
              ? 'Solte sobre outra pasta ou no botão Voltar para mover a pasta'
              : 'Solte sobre uma pasta para mover a anotação'}
          </span>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 py-2 px-4 rounded-xl bg-zinc-900/95 border border-emerald-500/50 text-zinc-100 text-xs font-medium shadow-xl backdrop-blur-md">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          CONTEÚDO PRINCIPAL: LISTAGEM UNIFICADA (PASTAS E ANOTAÇÕES)
          ========================================================================= */}
      <div className="space-y-4 pb-6">
        {/* Anotações Fixadas */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400/90 px-1">
              <Pin className="w-3.5 h-3.5" />
              <span>Fixadas ({pinnedNotes.length})</span>
            </div>
            <div
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-3.5'
                  : 'flex flex-col space-y-2'
              }
            >
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onSelect={onSelectNote}
                  onTogglePin={onTogglePin}
                  layout={layout}
                  isDragging={draggedNoteId === note.id}
                  onDragStart={() => setDraggedNoteId(note.id)}
                  onDragEnd={() => setDraggedNoteId(null)}
                  onTouchStart={(e) => handleTouchStartNote(note.id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Listagem Unificada de Pastas e Outras Anotações */}
        {(currentSubfolders.length > 0 || unpinnedNotes.length > 0) && (
          <div className="space-y-2">
            {pinnedNotes.length > 0 && (
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">
                Outros ({currentSubfolders.length + unpinnedNotes.length})
              </div>
            )}
            <div
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-3.5'
                  : 'flex flex-col space-y-2'
              }
            >
              {currentSubfolders.map((folder) => {
                const { noteCount, subfolderCount } = getCountsForFolder(folder.id);
                return (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    noteCount={noteCount}
                    subfolderCount={subfolderCount}
                    layout={layout}
                    isDragging={draggedFolderId === folder.id}
                    onDragStart={() => setDraggedFolderId(folder.id)}
                    onDragEnd={() => setDraggedFolderId(null)}
                    onTouchStart={(e) => handleTouchStartFolder(folder.id, e)}
                    onOpen={(id) => onSelectFolder(id)}
                    onDelete={onDeleteFolder}
                    onDropNote={handleDropOnFolder}
                    onDropFolder={handleDropFolderOnFolder}
                  />
                );
              })}

              {unpinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onSelect={onSelectNote}
                  onTogglePin={onTogglePin}
                  layout={layout}
                  isDragging={draggedNoteId === note.id}
                  onDragStart={() => setDraggedNoteId(note.id)}
                  onDragEnd={() => setDraggedNoteId(null)}
                  onTouchStart={(e) => handleTouchStartNote(note.id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* DIRETÓRIO TOTALMENTE VAZIO (SEM PASTAS E SEM NOTAS) */}
        {currentSubfolders.length === 0 && currentNotes.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40 my-6">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-3">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              {currentFolder
                ? `Esta pasta "${currentFolder.name}" está vazia`
                : 'O diretório de anotações está vazio'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              Crie anotações diretamente aqui ou organize em subpastas.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onCreateFolder(activeFolderId === 'all' ? null : activeFolderId);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>{currentFolder ? 'Criar Subpasta' : 'Criar Pasta'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void NativeBridge.hapticMediumImpact();
                  onCreateNote(activeFolderId === 'all' ? null : activeFolderId);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Anotação</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
