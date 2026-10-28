import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Pin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { FolderTile } from '../molecules/FolderTile';
import { NoteCard } from '../molecules/NoteCard';
import { htmlToPlainText } from '../../utils/markdownConverter';
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
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  folders,
  activeFolderId,
  onSelectFolder,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDeleteNote,
  onCreateFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('meu_gtd_notes_layout') as 'grid' | 'list') || 'list';
    } catch {
      return 'list';
    }
  });

  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverCrumbId, setDragOverCrumbId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const touchDragRef = useRef<{ noteId: string } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

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

  // Caminho hierárquico de Breadcrumbs (da raiz até a pasta ativa)
  const breadcrumbPath = useMemo(() => {
    if (activeFolderId === 'all') return [];
    const chain: UINoteFolder[] = [];
    let curr: UINoteFolder | undefined = folderMap.get(activeFolderId);
    while (curr) {
      chain.unshift(curr);
      curr = curr.parentId ? folderMap.get(curr.parentId) : undefined;
    }
    return chain;
  }, [activeFolderId, folderMap]);

  const handleDropOnFolder = (noteId: string, targetFolderId: string | null) => {
    onMoveNoteToFolder(noteId, targetFolderId);
    setDraggedNoteId(null);
    setDragOverCrumbId(null);

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

  // Suporte a Touch Dragging no Mobile
  const handleTouchStart = (noteId: string) => {
    touchDragRef.current = { noteId };
    setDraggedNoteId(noteId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropTarget = elem?.closest('[data-folder-drop-id]');
    if (dropTarget) {
      // Target visual se necessário
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const noteId = touchDragRef.current.noteId;
    const touch = e.changedTouches[0];
    if (touch && noteId) {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTarget = elem?.closest('[data-folder-drop-id]');
      if (dropTarget) {
        const targetFolderId = dropTarget.getAttribute('data-folder-drop-id');
        handleDropOnFolder(
          noteId,
          targetFolderId === 'root' ? null : targetFolderId
        );
      }
    }
    touchDragRef.current = null;
    setDraggedNoteId(null);
  };

  // Subpastas no diretório atual (ou raiz)
  const currentSubfolders = useMemo(() => {
    const targetParentId = activeFolderId === 'all' ? null : activeFolderId;
    return folders
      .filter((f) => (targetParentId === null ? !f.parentId : f.parentId === targetParentId))
      .filter((f) => {
        if (!searchQuery.trim()) return true;
        return f.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders, activeFolderId, searchQuery]);

  // Anotações no diretório atual (ou raiz)
  const currentNotes = useMemo(() => {
    const targetFolderId = activeFolderId === 'all' ? null : activeFolderId;
    return notes
      .filter((n) => (targetFolderId === null ? !n.folderId : n.folderId === targetFolderId))
      .filter((n) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          n.title.toLowerCase().includes(q) ||
          htmlToPlainText(n.content).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, activeFolderId, searchQuery]);

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
    >
      {/* =========================================================================
          BARRA DE ENDEREÇOS ESTILO EXPLORADOR DE ARQUIVOS DO WINDOWS
          ========================================================================= */}
      <div className="flex flex-col gap-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-black/20">
        {/* Linha 1: Navegação de Caminho (Breadcrumbs) e Ações de Diretório */}
        <div className="flex items-center gap-2">
          {/* Botão Subir Nível / Voltar (←) estilo Windows Explorer */}
          <button
            type="button"
            disabled={activeFolderId === 'all'}
            onClick={handleGoUp}
            className={`p-2 rounded-xl border transition-all ${
              activeFolderId !== 'all'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 active:scale-95 shadow-sm'
                : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-600 cursor-not-allowed opacity-40'
            }`}
            title="Subir um nível de pasta"
            aria-label="Subir nível"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Barra de Caminho (Address Bar) com Drop Zones para cada nível */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-medium text-zinc-300 overflow-x-auto native-scroll-container">
            {/* Crumb: Raiz (Anotações) - também funciona como Drop Zone */}
            <button
              type="button"
              data-folder-drop-id="root"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverCrumbId('root');
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCrumbId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id =
                  e.dataTransfer.getData('text/plain') ||
                  e.dataTransfer.getData('application/x-note-id') ||
                  draggedNoteId;
                if (id) handleDropOnFolder(id, null);
              }}
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onSelectFolder('all');
              }}
              className={`hover:text-violet-300 hover:underline flex items-center gap-1 shrink-0 px-1 py-0.5 rounded transition-all ${
                dragOverCrumbId === 'root'
                  ? 'bg-violet-500/25 ring-2 ring-violet-400 text-white'
                  : activeFolderId === 'all'
                  ? 'text-violet-400 font-semibold'
                  : 'text-zinc-400'
              }`}
              title="Ir para o diretório raiz (Solte aqui para mover para a raiz)"
            >
              <Folder className="w-3.5 h-3.5 text-violet-400 shrink-0 pointer-events-none" />
              <span className="pointer-events-none">Anotações</span>
            </button>

            {/* Crumbs das Subpastas no Caminho Hierárquico */}
            {breadcrumbPath.map((folder, idx) => {
              const isLast = idx === breadcrumbPath.length - 1;
              const isDragOver = dragOverCrumbId === folder.id;

              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <button
                    type="button"
                    data-folder-drop-id={folder.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragOverCrumbId(folder.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverCrumbId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id =
                        e.dataTransfer.getData('text/plain') ||
                        e.dataTransfer.getData('application/x-note-id') ||
                        draggedNoteId;
                      if (id) handleDropOnFolder(id, folder.id);
                    }}
                    onClick={() => {
                      void NativeBridge.hapticLightImpact();
                      onSelectFolder(folder.id);
                    }}
                    className={`flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md border transition-all ${
                      isDragOver
                        ? 'ring-2 ring-violet-400 bg-violet-500/30 text-white border-violet-400'
                        : isLast
                        ? 'font-semibold text-zinc-100 bg-zinc-900 border-zinc-800'
                        : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950 border-zinc-850 hover:bg-zinc-900'
                    }`}
                    title={`Abrir "${folder.name}" (Solte aqui para mover)`}
                  >
                    <Folder
                      className="w-3.5 h-3.5 shrink-0 pointer-events-none"
                      style={{ color: folder.color }}
                    />
                    <span className="truncate max-w-[130px] pointer-events-none">
                      {folder.name}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
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

        {/* Linha 2: Busca e Alternâncias de Visualização */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                currentFolder
                  ? `Pesquisar dentro de "${currentFolder.name}"...`
                  : 'Pesquisar no diretório raiz...'
              }
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

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
              aria-label="Exibir em Grade"
              onClick={() => handleSetLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                layout === 'grid'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Exibição em Grade (Ícones)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FEEDBACK FLUTUANTE DE ARRASTO E STATUS
          ========================================================================= */}
      {draggedNoteId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900/95 border border-violet-500/60 text-violet-200 text-xs font-semibold shadow-2xl backdrop-blur-md animate-pulse">
          <Folder className="w-4 h-4 text-violet-400 shrink-0" />
          <span>Solte sobre uma pasta ou na barra de endereços para mover</span>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-2 py-2 px-4 rounded-xl bg-zinc-900/95 border border-emerald-500/50 text-zinc-100 text-xs font-medium shadow-xl backdrop-blur-md">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          CONTEÚDO PRINCIPAL: DIRETÓRIO ATUAL (WINDOWS FILE EXPLORER)
          ========================================================================= */}
      <div className="space-y-6 pb-6">
        {/* SEÇÃO 1: PASTAS / SUBPASTAS DO DIRETÓRIO ATUAL */}
        {currentSubfolders.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {currentFolder
                    ? `Subpastas de "${currentFolder.name}" (${currentSubfolders.length})`
                    : `Pastas (${currentSubfolders.length})`}
                </span>
              </span>
              <span className="text-[11px] text-zinc-500">
                Arraste notas sobre uma pasta para organizá-las
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {currentSubfolders.map((folder) => {
                const { noteCount, subfolderCount } = getCountsForFolder(folder.id);
                return (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    noteCount={noteCount}
                    subfolderCount={subfolderCount}
                    onOpen={(id) => onSelectFolder(id)}
                    onDelete={onDeleteFolder}
                    onDropNote={handleDropOnFolder}
                  />
                );
              })}

              {/* Bloco de Criar Nova Subpasta */}
              <button
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onCreateFolder(activeFolderId === 'all' ? null : activeFolderId);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-zinc-800 hover:border-violet-500/60 bg-zinc-950/30 hover:bg-zinc-900/50 text-zinc-400 hover:text-violet-300 text-xs font-semibold transition-all group active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 group-hover:border-violet-500/40 group-hover:bg-violet-500/10 shrink-0 transition-colors">
                  <Plus className="w-5 h-5 text-zinc-500 group-hover:text-violet-400" />
                </div>
                <span>
                  {currentFolder ? 'Criar Nova Subpasta...' : 'Criar Nova Pasta...'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Divisor suave se houver tanto subpastas quanto notas */}
        {currentSubfolders.length > 0 && currentNotes.length > 0 && (
          <div className="border-t border-zinc-800/60" />
        )}

        {/* SEÇÃO 2: ANOTAÇÕES DO DIRETÓRIO ATUAL */}
        {currentNotes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {currentFolder
                    ? `Anotações em "${currentFolder.name}" (${currentNotes.length})`
                    : `Anotações no Diretório Raiz (${currentNotes.length})`}
                </span>
              </span>
            </div>

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
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5'
                      : 'flex flex-col space-y-2'
                  }
                >
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      folder={note.folderId ? folderMap.get(note.folderId) : null}
                      onSelect={onSelectNote}
                      onTogglePin={onTogglePin}
                      onDelete={onDeleteNote}
                      layout={layout}
                      isDragging={draggedNoteId === note.id}
                      onDragStart={() => setDraggedNoteId(note.id)}
                      onDragEnd={() => setDraggedNoteId(null)}
                      onTouchStart={() => handleTouchStart(note.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Outras Anotações */}
            {unpinnedNotes.length > 0 && (
              <div className="space-y-2">
                {pinnedNotes.length > 0 && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">
                    Outras Anotações ({unpinnedNotes.length})
                  </div>
                )}
                <div
                  className={
                    layout === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5'
                      : 'flex flex-col space-y-2'
                  }
                >
                  {unpinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      folder={note.folderId ? folderMap.get(note.folderId) : null}
                      onSelect={onSelectNote}
                      onTogglePin={onTogglePin}
                      onDelete={onDeleteNote}
                      layout={layout}
                      isDragging={draggedNoteId === note.id}
                      onDragStart={() => setDraggedNoteId(note.id)}
                      onDragEnd={() => setDraggedNoteId(null)}
                      onTouchStart={() => handleTouchStart(note.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DIRETÓRIO TOTALMENTE VAZIO (SEM PASTAS E SEM NOTAS) */}
        {currentSubfolders.length === 0 && currentNotes.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40 my-6">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-3">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              {searchQuery
                ? 'Nenhum item encontrado neste diretório'
                : currentFolder
                ? `Esta pasta "${currentFolder.name}" está vazia`
                : 'O diretório de anotações está vazio'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              {searchQuery
                ? 'Tente buscar com outros termos ou limpe o campo de pesquisa.'
                : 'Crie anotações diretamente aqui ou organize em subpastas.'}
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
