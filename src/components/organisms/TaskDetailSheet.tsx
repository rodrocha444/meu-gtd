import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Pin,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import {
  getPriorityMeta,
  GTD_CONTEXT_SUGGESTIONS,
} from '../../constants/priority';
import { SheetHandle } from '../atoms/SheetHandle';
import { SubtaskItem } from '../molecules/SubtaskItem';
import {
  CustomDatePicker,
  CustomRecurrencePicker,
  CustomSelect,
  type CustomSelectOption,
} from '../ui/CustomControls';
import type { UIList, UITask } from '../../types/task';

interface TaskDetailSheetProps {
  selectedTask: UITask | null;
  onClose: () => void;
  listMap: Record<string, UIList>;
  listSelectOptions: CustomSelectOption<string>[];
  subtasks: UITask[];
  onUpdateTask: (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'title'
        | 'description'
        | 'listId'
        | 'priority'
        | 'tags'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
        | 'isPinned'
      >
    >
  ) => Promise<void> | void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
  onAddSubtask: (parentTask: UITask, title: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  selectedTask,
  onClose,
  listMap,
  listSelectOptions,
  subtasks,
  onUpdateTask,
  onToggleStatus,
  onDeleteTask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const [subtaskInput, setSubtaskInput] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');

  // Rascunho local de edição da tarefa
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftListId, setDraftListId] = useState('inbox');
  const [draftDueDate, setDraftDueDate] = useState<number | null>(null);
  const [draftRecurrenceRule, setDraftRecurrenceRule] = useState<string | null>(null);
  const [draftRecurrenceMode, setDraftRecurrenceMode] = useState<RecurrenceMode>('fixed');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(0);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  // Estados de persistência no banco de dados
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Inicializa o rascunho quando a tarefa selecionada muda
  useEffect(() => {
    if (selectedTask) {
      setDraftTitle(selectedTask.title);
      setDraftDescription(selectedTask.description);
      setDraftListId(selectedTask.listId);
      setDraftDueDate(selectedTask.dueDate);
      setDraftRecurrenceRule(selectedTask.recurrenceRule);
      setDraftRecurrenceMode(selectedTask.recurrenceMode);
      setDraftPriority(selectedTask.priority);
      setDraftTags([...selectedTask.tags]);
      setSaveStatus('idle');
    }
  }, [selectedTask?.id]);

  // Detector de alterações pendentes em relação ao objeto salvo no banco
  const hasPendingChanges = useMemo(() => {
    if (!selectedTask) return false;
    if (draftTitle !== selectedTask.title) return true;
    if (draftDescription !== selectedTask.description) return true;
    if (draftListId !== selectedTask.listId) return true;
    if (draftDueDate !== selectedTask.dueDate) return true;
    if (draftRecurrenceRule !== selectedTask.recurrenceRule) return true;
    if (draftRecurrenceMode !== selectedTask.recurrenceMode) return true;
    if (draftPriority !== selectedTask.priority) return true;
    if (draftTags.length !== selectedTask.tags.length) return true;
    const s = new Set(draftTags);
    for (const tag of selectedTask.tags) {
      if (!s.has(tag)) return true;
    }
    return false;
  }, [
    selectedTask,
    draftTitle,
    draftDescription,
    draftListId,
    draftDueDate,
    draftRecurrenceRule,
    draftRecurrenceMode,
    draftPriority,
    draftTags,
  ]);

  // Salvar explicitamente no banco de dados com feedback visual completo
  const handleSave = async () => {
    if (!selectedTask) return;
    const cleanTitle = draftTitle.trim();
    if (!cleanTitle) {
      setDraftTitle(selectedTask.title);
      return;
    }

    try {
      setSaveStatus('saving');
      void NativeBridge.hapticLightImpact();

      const updates = {
        title: cleanTitle,
        description: draftDescription,
        listId: draftListId,
        dueDate: draftDueDate,
        recurrenceRule: draftRecurrenceRule,
        recurrenceMode: draftRecurrenceMode,
        priority: draftPriority,
        tags: draftTags,
      };

      await onUpdateTask(selectedTask.id, updates);

      if (cleanTitle !== draftTitle) {
        setDraftTitle(cleanTitle);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedTime(timeStr);
      setSaveStatus('saved');
      void NativeBridge.hapticSwipeAction();

      setTimeout(() => {
        setSaveStatus((curr) => (curr === 'saved' ? 'idle' : curr));
      }, 4000);
    } catch {
      setSaveStatus('error');
    }
  };

  // Salva automaticamente ao fechar caso o usuário tenha esquecido de clicar em Salvar
  const handleClose = () => {
    if (selectedTask && hasPendingChanges) {
      const cleanTitle = draftTitle.trim() || selectedTask.title;
      void onUpdateTask(selectedTask.id, {
        title: cleanTitle,
        description: draftDescription,
        listId: draftListId,
        dueDate: draftDueDate,
        recurrenceRule: draftRecurrenceRule,
        recurrenceMode: draftRecurrenceMode,
        priority: draftPriority,
        tags: draftTags,
      });
    }
    onClose();
  };

  // Atalho de teclado Ctrl+S / Cmd+S para salvar a tarefa
  useEffect(() => {
    if (!selectedTask) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedTask?.id,
    draftTitle,
    draftDescription,
    draftListId,
    draftDueDate,
    draftRecurrenceRule,
    draftRecurrenceMode,
    draftPriority,
    draftTags,
  ]);

  if (!selectedTask) return null;

  const handlePriorityChange = (priority: TaskPriority) => {
    void NativeBridge.hapticLightImpact();
    setDraftPriority(priority);
  };

  const handlePinToggle = () => {
    void NativeBridge.hapticLightImpact();
    const nextPinned = !selectedTask.isPinned;
    const cleanTitle = draftTitle.trim() || selectedTask.title;
    void onUpdateTask(selectedTask.id, {
      title: cleanTitle,
      description: draftDescription,
      listId: draftListId,
      dueDate: draftDueDate,
      recurrenceRule: draftRecurrenceRule,
      recurrenceMode: draftRecurrenceMode,
      priority: draftPriority,
      tags: draftTags,
      isPinned: nextPinned,
    });
  };

  const handleToggleTaskStatus = () => {
    if (hasPendingChanges) {
      const cleanTitle = draftTitle.trim() || selectedTask.title;
      void onUpdateTask(selectedTask.id, {
        title: cleanTitle,
        description: draftDescription,
        listId: draftListId,
        dueDate: draftDueDate,
        recurrenceRule: draftRecurrenceRule,
        recurrenceMode: draftRecurrenceMode,
        priority: draftPriority,
        tags: draftTags,
      });
    }
    onToggleStatus(
      selectedTask,
      selectedTask.status === 'completed' ? 'pending' : 'completed'
    );
  };

  const handleAddStep = () => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    onAddSubtask(selectedTask, clean);
    setSubtaskInput('');
  };

  const handleAddCustomTag = () => {
    const raw = customTagInput.trim().toLowerCase();
    if (!raw) return;
    const formatted = raw.startsWith('@') || raw.startsWith('#') ? raw : `#${raw}`;
    if (!draftTags.includes(formatted)) {
      void NativeBridge.hapticLightImpact();
      setDraftTags((prev) => [...prev, formatted]);
    }
    setCustomTagInput('');
  };

  return (
    <div
      className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto flex items-end md:items-stretch bg-black/60 md:bg-transparent backdrop-blur-xs md:backdrop-blur-none"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:w-[410px] max-h-[88dvh] md:max-h-none bg-zinc-900 md:border-l border-t md:border-t-0 border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col overflow-hidden shadow-2xl"
      >
        <SheetHandle />

        {/* Header do Detalhe */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">
              {listMap[draftListId]?.name ?? 'Inbox'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-500">Detalhes GTD</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botão Salvar no Header */}
            <button
              type="button"
              aria-label="Salvar alterações"
              disabled={saveStatus === 'saving'}
              onClick={() => void handleSave()}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                hasPendingChanges
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-400/50'
                  : saveStatus === 'saved'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                  : 'bg-zinc-800/70 text-zinc-300 border-zinc-700/60 hover:text-white hover:bg-zinc-800'
              }`}
              title="Salvar alterações no banco de dados (Ctrl+S)"
            >
              {saveStatus === 'saving' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
              ) : saveStatus === 'saved' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>
                {saveStatus === 'saving'
                  ? 'Salvando'
                  : saveStatus === 'saved'
                  ? 'Salvo'
                  : 'Salvar'}
              </span>
            </button>

            {/* Botão Fixar no Topo (Pin) */}
            <button
              type="button"
              aria-label="Fixar tarefa"
              onClick={handlePinToggle}
              className={`p-1.5 rounded-lg border transition-colors ${
                selectedTask.isPinned
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            {/* Botão Concluir Tarefa */}
            <button
              type="button"
              onClick={handleToggleTaskStatus}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                selectedTask.status === 'completed'
                  ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/35'
                  : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>{selectedTask.status === 'completed' ? 'Concluída' : 'Concluir'}</span>
            </button>

            {/* Botão Excluir Tarefa */}
            <button
              type="button"
              aria-label="Excluir tarefa"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onDeleteTask(selectedTask);
              }}
              className="p-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/70 text-zinc-400 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Detalhe com Scroll Nativo */}
        <div className="flex-1 native-scroll-container p-4 space-y-4">
          {/* Título Editável + Notas */}
          <div>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              className="w-full bg-transparent text-base font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-lg px-1.5 py-1 -mx-1.5"
            />
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <AlignLeft className="w-3 h-3 text-zinc-400" />
                  <span>Descrição / Notas</span>
                </span>
                {draftDescription.trim().length > 0 && (
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {draftDescription.trim().length} caracteres
                  </span>
                )}
              </div>
              <textarea
                rows={3}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Notas em Markdown, passos da ação ou link de referência..."
                className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Lista / Destino GTD usando CustomSelect */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Lista / Destino GTD
            </label>
            <CustomSelect<string>
              value={draftListId}
              options={listSelectOptions}
              onChange={(nextListId) => setDraftListId(nextListId)}
            />
          </div>

          {/* Data de Vencimento / Evento usando CustomDatePicker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Data Agendada / Calendário
            </label>
            <CustomDatePicker
              value={draftDueDate}
              onChange={(nextDueDate) => setDraftDueDate(nextDueDate)}
            />
          </div>

          {/* Repetições usando CustomRecurrencePicker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Repetição & Recorrência
            </label>
            <CustomRecurrencePicker
              recurrenceRule={draftRecurrenceRule}
              recurrenceMode={draftRecurrenceMode}
              onChange={({ recurrenceRule, recurrenceMode }) => {
                setDraftRecurrenceRule(recurrenceRule);
                setDraftRecurrenceMode(recurrenceMode);
                if (recurrenceRule && draftDueDate === null) {
                  setDraftDueDate(Date.now());
                }
              }}
            />
          </div>

          {/* Seletor de Prioridade com Haptics */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Prioridade (TickTick Color)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([0, 1, 2, 3] as TaskPriority[]).map((p) => {
                const meta = getPriorityMeta(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePriorityChange(p)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      draftPriority === p
                        ? meta.badgeClass
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contextos GTD & Tags */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Contextos GTD & Tags
            </label>

            {/* Chips de tags ativas vinculadas com botão de remoção */}
            {draftTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 rounded-xl bg-zinc-950/50 border border-zinc-800/70">
                {draftTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-xs"
                  >
                    <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      aria-label={`Remover tag ${tag}`}
                      onClick={() => {
                        void NativeBridge.hapticLightImpact();
                        setDraftTags((prev) => prev.filter((t) => t !== tag));
                      }}
                      className="hover:text-red-400 text-zinc-400 ml-0.5 transition-colors p-0.5 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-2">
              {GTD_CONTEXT_SUGGESTIONS.map((ctx) => {
                const active = draftTags.includes(ctx);
                return (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => {
                      void NativeBridge.hapticLightImpact();
                      const nextTags = active
                        ? draftTags.filter((t) => t !== ctx)
                        : [...draftTags, ctx];
                      setDraftTags(nextTags);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>{ctx}</span>
                  </button>
                );
              })}
            </div>

            {/* Adicionar Tag Customizada */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="Nova tag (@contexto ou #tag)..."
                className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
              >
                + Tag
              </button>
            </div>
          </div>

          {/* Subtarefas / Checklists (parent_task_id) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Subtarefas / Checklist
            </label>
            <div className="space-y-1.5 mb-2">
              {subtasks.map((sub) => (
                <SubtaskItem
                  key={sub.id}
                  subtask={sub}
                  onToggle={(s) => onToggleStatus(s)}
                  onDelete={onDeleteSubtask}
                />
              ))}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                placeholder="Adicionar passo da subtarefa..."
                className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
              >
                + Passo
              </button>
            </div>
          </div>

          {/* Botão Excluir Tarefa Principal */}
          <div className="pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onDeleteTask(selectedTask);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Tarefa</span>
            </button>
          </div>
        </div>

        {/* Rodapé Fixo com Status de Persistência no Banco e Botão Salvar Principal */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {saveStatus === 'saving' ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span className="font-medium truncate">Salvando no banco de dados...</span>
              </div>
            ) : saveStatus === 'saved' ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate">
                  Salvo no banco{lastSavedTime ? ` às ${lastSavedTime}` : ''}
                </span>
              </div>
            ) : hasPendingChanges ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="font-medium truncate">Alterações não salvas</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Check className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
                <span className="truncate">
                  {lastSavedTime ? `Salvo no banco às ${lastSavedTime}` : 'Sincronizado com o banco'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={saveStatus === 'saving'}
            onClick={() => void handleSave()}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shrink-0 shadow-sm ${
              hasPendingChanges
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                : saveStatus === 'saved'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvo no Banco!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{hasPendingChanges ? 'Salvar Alterações' : 'Salvar'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
