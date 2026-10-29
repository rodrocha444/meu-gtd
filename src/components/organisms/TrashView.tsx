import React, { useMemo, useState } from 'react';
import {
  Clock,
  RotateCcw,
  Search,
  Trash2,
  CheckSquare,
  FileText,
  Folder,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { CustomSegmentedControl } from '../ui/CustomControls';
import { EmptyState } from '../atoms/EmptyState';
import { getTrashRemainingDays, formatDeletedDate } from '../../utils/trash';
import { htmlToPlainText } from '../../utils/markdownConverter';
import { extractImagesFromMarkdown } from '../../utils/imageUpload';
import { PRIORITY_META } from '../../constants/priority';
import type { UITask, UIList } from '../../types/task';
import type { UINote, UINoteFolder } from '../../types/note';

type TrashTab = 'all' | 'tasks' | 'notes';

interface TrashViewProps {
  tasks: UITask[];
  notes: UINote[];
  lists: UIList[];
  folders: UINoteFolder[];
  defaultTab?: TrashTab;
  onRestoreTask: (task: UITask) => void;
  onRestoreNote: (note: UINote) => void;
  onDeletePermanentlyTask: (task: UITask) => void;
  onDeletePermanentlyNote: (note: UINote) => void;
  onEmptyTrash: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  tasks,
  notes,
  lists,
  folders,
  defaultTab = 'all',
  onRestoreTask,
  onRestoreNote,
  onDeletePermanentlyTask,
  onDeletePermanentlyNote,
  onEmptyTrash,
}) => {
  const [activeTab, setActiveTab] = useState<TrashTab>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Mapas rápidos para nomes e cores de listas e pastas
  const listMap = useMemo(() => {
    const map = new Map<string, UIList>();
    for (const l of lists) map.set(l.id, l);
    return map;
  }, [lists]);

  const folderMap = useMemo(() => {
    const map = new Map<string, UINoteFolder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  // Filtra apenas itens da raiz (subtarefas são tratadas junto com suas tarefas pai)
  const rootTasks = useMemo(
    () => tasks.filter((t) => t.parentTaskId === null),
    [tasks]
  );

  // Subtarefas por id da tarefa pai
  const subtasksMap = useMemo(() => {
    const map = new Map<string, UITask[]>();
    for (const t of tasks) {
      if (t.parentTaskId) {
        const arr = map.get(t.parentTaskId) ?? [];
        arr.push(t);
        map.set(t.parentTaskId, arr);
      }
    }
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'notes') return [];
    return rootTasks
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }, [rootTasks, activeTab, searchQuery]);

  const filteredNotes = useMemo(() => {
    if (activeTab === 'tasks') return [];
    return notes
      .filter((n) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          n.title.toLowerCase().includes(q) ||
          htmlToPlainText(n.content).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }, [notes, activeTab, searchQuery]);

  const totalItemsCount = rootTasks.length + notes.length;
  const hasVisibleItems = filteredTasks.length > 0 || filteredNotes.length > 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Banner Informativo de Retenção de 30 Dias */}
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
        <Clock className="w-4 h-4 shrink-0 text-amber-400" />
        <div className="flex-1">
          <span className="font-semibold">Política da Lixeira:</span> Os itens enviados para a lixeira permanecem disponíveis por <strong className="text-amber-200">30 dias</strong>. Após esse período, são apagados permanentemente de forma automática.
        </div>
      </div>

      {/* Barra de Controles: Abas, Busca e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <CustomSegmentedControl<TrashTab>
          value={activeTab}
          onChange={(tab) => {
            void NativeBridge.hapticLightImpact();
            setActiveTab(tab);
          }}
          size="sm"
          options={[
            {
              value: 'all',
              label: `Todos (${totalItemsCount})`,
            },
            {
              value: 'tasks',
              label: `Tarefas (${rootTasks.length})`,
              icon: <CheckSquare className="w-3.5 h-3.5" />,
            },
            {
              value: 'notes',
              label: `Anotações (${notes.length})`,
              icon: <FileText className="w-3.5 h-3.5" />,
            },
          ]}
        />

        {totalItemsCount > 0 && (
          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onEmptyTrash();
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Esvaziar Lixeira</span>
          </button>
        )}
      </div>

      {/* Campo de Busca Rápida na Lixeira */}
      {totalItemsCount > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar itens na lixeira..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500/50"
          />
        </div>
      )}

      {/* Conteúdo: Lista de Itens na Lixeira */}
      {!hasVisibleItems ? (
        <EmptyState
          icon={<Trash2 className="w-6 h-6 text-zinc-500" />}
          title={searchQuery ? 'Nenhum resultado encontrado' : 'Lixeira vazia'}
          description={
            searchQuery
              ? `Nenhum item corresponde a "${searchQuery}".`
              : 'Tarefas e anotações excluídas aparecerão aqui e serão apagadas após 30 dias.'
          }
        />
      ) : (
        <div className="space-y-3">
          {/* SEÇÃO DE TAREFAS */}
          {filteredTasks.length > 0 && (
            <div className="space-y-2">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 pt-1 pb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tarefas ({filteredTasks.length})</span>
                </div>
              )}

              {filteredTasks.map((task) => {
                const list = listMap.get(task.listId);
                const subtasks = subtasksMap.get(task.id) || [];
                const remainingDays = getTrashRemainingDays(task.deletedAt);
                const priorityMeta = PRIORITY_META[task.priority];

                return (
                  <div
                    key={task.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Indicador de Prioridade */}
                      <div className="pt-0.5">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${priorityMeta.dotClass}`}
                          title={`Prioridade ${priorityMeta.label}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium text-zinc-200 line-through decoration-zinc-500/70 truncate">
                            {task.title}
                          </h4>

                          {/* Badge de Dias Restantes */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              remainingDays <= 3
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {remainingDays === 0
                              ? 'Exclui hoje'
                              : remainingDays === 1
                              ? 'Exclui amanhã'
                              : `Exclui em ${remainingDays} dias`}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-zinc-500 line-clamp-1">
                            {extractImagesFromMarkdown(task.description).cleanText || 'Anexo de imagem'}
                          </p>
                        )}

                        {/* Metadados: Lista de Origem, Subtarefas e Data da Exclusão */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-500">
                          {list && (
                            <span className="flex items-center gap-1 font-medium text-zinc-400">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: list.color }}
                              />
                              {list.name}
                            </span>
                          )}

                          {subtasks.length > 0 && (
                            <span className="text-zinc-500">
                              • {subtasks.length} subtarefa(s)
                            </span>
                          )}

                          {task.deletedAt && (
                            <span className="text-zinc-500">
                              • Excluída em {formatDeletedDate(task.deletedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação: Restaurar e Excluir Definitivamente */}
                    <div className="flex items-center gap-1.5 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void NativeBridge.hapticMediumImpact();
                          onRestoreTask(task);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 active:scale-95 transition-all"
                        title="Restaurar tarefa para a lista de origem"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void NativeBridge.hapticLightImpact();
                          onDeletePermanentlyTask(task);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                        title="Excluir permanentemente agora"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Apagar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SEÇÃO DE ANOTAÇÕES */}
          {filteredNotes.length > 0 && (
            <div className="space-y-2 pt-2">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 pt-1 pb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                  <span>Anotações ({filteredNotes.length})</span>
                </div>
              )}

              {filteredNotes.map((note) => {
                const folder = note.folderId ? folderMap.get(note.folderId) : null;
                const remainingDays = getTrashRemainingDays(note.deletedAt);
                const snippet = htmlToPlainText(note.content).trim();

                return (
                  <div
                    key={note.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="pt-0.5">
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium text-zinc-200 line-through decoration-zinc-500/70 truncate">
                            {note.title || 'Sem título'}
                          </h4>

                          {/* Badge de Dias Restantes */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              remainingDays <= 3
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {remainingDays === 0
                              ? 'Exclui hoje'
                              : remainingDays === 1
                              ? 'Exclui amanhã'
                              : `Exclui em ${remainingDays} dias`}
                          </span>
                        </div>

                        {snippet && (
                          <p className="text-xs text-zinc-500 line-clamp-1">
                            {snippet}
                          </p>
                        )}

                        {/* Metadados: Pasta de Origem e Data da Exclusão */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-500">
                          {folder ? (
                            <span className="flex items-center gap-1 font-medium text-zinc-400">
                              <Folder
                                className="w-3 h-3"
                                style={{ color: folder.color }}
                              />
                              {folder.name}
                            </span>
                          ) : (
                            <span className="text-zinc-500">Todas as Anotações</span>
                          )}

                          {note.deletedAt && (
                            <span className="text-zinc-500">
                              • Excluída em {formatDeletedDate(note.deletedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação: Restaurar e Excluir Definitivamente */}
                    <div className="flex items-center gap-1.5 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void NativeBridge.hapticMediumImpact();
                          onRestoreNote(note);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 active:scale-95 transition-all"
                        title="Restaurar anotação para sua pasta"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void NativeBridge.hapticLightImpact();
                          onDeletePermanentlyNote(note);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                        title="Excluir permanentemente agora"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Apagar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
