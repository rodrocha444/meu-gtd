import React, { useEffect, useState } from 'react';
import {
  AlignLeft,
  Check,
  FolderPlus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { RecurrenceMode, TaskPriority } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import {
  getPriorityMeta,
  GTD_CONTEXT_SUGGESTIONS,
} from '../../constants/priority';
import { SheetHandle } from '../atoms/SheetHandle';
import {
  CustomDatePicker,
  CustomRecurrencePicker,
  CustomSelect,
  type CustomSelectOption,
} from '../ui/CustomControls';
import type { UITask } from '../../types/task';

interface TriageSheetProps {
  triageTask: UITask | null;
  onClose: () => void;
  listSelectOptions: CustomSelectOption<string>[];
  onApplyTriage: (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'listId'
        | 'priority'
        | 'tags'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
      >
    >
  ) => void;
  onPromoteToProject: (task: UITask) => void;
  onDeleteTask: (task: UITask) => void;
  setTriageTask?: React.Dispatch<React.SetStateAction<UITask | null>>;
}

export const TriageSheet: React.FC<TriageSheetProps> = ({
  triageTask,
  onClose,
  listSelectOptions,
  onApplyTriage,
  onPromoteToProject,
  onDeleteTask,
}) => {
  // Rascunho local de triagem — nada é salvo no banco até o usuário clicar em "Salvar Triagem"
  const [draftListId, setDraftListId] = useState(triageTask?.listId ?? 'inbox');
  const [draftDueDate, setDraftDueDate] = useState<number | null>(triageTask?.dueDate ?? null);
  const [draftRecurrenceRule, setDraftRecurrenceRule] = useState<string | null>(triageTask?.recurrenceRule ?? null);
  const [draftRecurrenceMode, setDraftRecurrenceMode] = useState<RecurrenceMode>(triageTask?.recurrenceMode ?? 'fixed');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(triageTask?.priority ?? 0);
  const [draftTags, setDraftTags] = useState<string[]>(triageTask ? [...triageTask.tags] : []);

  useEffect(() => {
    if (triageTask) {
      setDraftListId(triageTask.listId);
      setDraftDueDate(triageTask.dueDate);
      setDraftRecurrenceRule(triageTask.recurrenceRule);
      setDraftRecurrenceMode(triageTask.recurrenceMode);
      setDraftPriority(triageTask.priority);
      setDraftTags([...triageTask.tags]);
    }
  }, [triageTask?.id]);

  if (!triageTask) return null;

  const handleSaveTriage = () => {
    void NativeBridge.hapticSwipeAction();
    onApplyTriage(triageTask.id, {
      listId: draftListId,
      dueDate: draftDueDate,
      recurrenceRule: draftRecurrenceRule,
      recurrenceMode: draftRecurrenceMode,
      priority: draftPriority,
      tags: draftTags,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] native-scroll-container bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <SheetHandle />

        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              Triagem GTD (Clarificar & Organizar)
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <h3 className="text-sm font-bold text-zinc-100">
                {triageTask.title}
              </h3>
              {triageTask.description.trim().length > 0 && (
                <span
                  aria-label="Possui anotações"
                  className="shrink-0 text-zinc-400 inline-flex items-center"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            {triageTask.description.trim().length > 0 && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 italic bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                {triageTask.description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar triagem"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Destino GTD / Lista de Projeto via CustomSelect */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            1. Mover para Lista / Destino GTD
          </label>
          <CustomSelect<string>
            value={draftListId}
            options={listSelectOptions}
            onChange={(nextListId) => {
              void NativeBridge.hapticLightImpact();
              setDraftListId(nextListId);
            }}
          />
        </div>

        {/* 2. Agendar Data no Calendário via CustomDatePicker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            2. Data no Calendário
          </label>
          <CustomDatePicker
            value={draftDueDate}
            onChange={(nextDueDate) => {
              void NativeBridge.hapticLightImpact();
              setDraftDueDate(nextDueDate);
            }}
          />
        </div>

        {/* 3. Repetição via CustomRecurrencePicker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            3. Repetição / Recorrência
          </label>
          <CustomRecurrencePicker
            recurrenceRule={draftRecurrenceRule}
            recurrenceMode={draftRecurrenceMode}
            onChange={({ recurrenceRule, recurrenceMode }) => {
              void NativeBridge.hapticLightImpact();
              setDraftRecurrenceRule(recurrenceRule);
              setDraftRecurrenceMode(recurrenceMode);
              if (recurrenceRule && draftDueDate === null) {
                setDraftDueDate(Date.now());
              }
            }}
          />
        </div>

        {/* 4. Contexto GTD (@computador, @rua, #aniversario) */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            4. Contexto GTD & Energia (@tag)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {GTD_CONTEXT_SUGGESTIONS.map((ctx) => {
              const active = draftTags.includes(ctx);
              return (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => {
                    void NativeBridge.hapticLightImpact();
                    setDraftTags((prev) =>
                      active ? prev.filter((t) => t !== ctx) : [...prev, ctx]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${
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
        </div>

        {/* 5. Prioridade */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            5. Definir Prioridade
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 1, 2, 3] as TaskPriority[]).map((p) => {
              const meta = getPriorityMeta(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    void NativeBridge.hapticLightImpact();
                    setDraftPriority(p);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    draftPriority === p
                      ? meta.badgeClass
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Atalhos GTD: Transformar em Novo Projeto ou Excluir */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          <button
            type="button"
            onClick={() => onPromoteToProject(triageTask)}
            className="w-full py-2 px-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Transformar em Novo Projeto GTD (Multi-passos)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onDeleteTask(triageTask);
            }}
            className="w-full py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Excluir Tarefa (Descartar da Inbox)</span>
          </button>
        </div>

        {/* Botão de Salvar Triagem */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveTriage}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Salvar Triagem</span>
          </button>
        </div>
      </div>
    </div>
  );
};
