import React from 'react';
import {
  AlignLeft,
  FolderPlus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { TaskPriority } from '../../db/schema';
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
  setTriageTask: React.Dispatch<React.SetStateAction<UITask | null>>;
}

export const TriageSheet: React.FC<TriageSheetProps> = ({
  triageTask,
  onClose,
  listSelectOptions,
  onApplyTriage,
  onPromoteToProject,
  onDeleteTask,
  setTriageTask,
}) => {
  if (!triageTask) return null;

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
            value={triageTask.listId}
            options={listSelectOptions}
            onChange={(nextListId) => {
              onApplyTriage(triageTask.id, { listId: nextListId });
              setTriageTask((prev) =>
                prev ? { ...prev, listId: nextListId } : null
              );
            }}
          />
        </div>

        {/* 2. Agendar Data no Calendário via CustomDatePicker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            2. Data no Calendário
          </label>
          <CustomDatePicker
            value={triageTask.dueDate}
            onChange={(nextDueDate) => {
              onApplyTriage(triageTask.id, { dueDate: nextDueDate });
              setTriageTask((prev) =>
                prev ? { ...prev, dueDate: nextDueDate } : null
              );
            }}
          />
        </div>

        {/* 3. Repetição via CustomRecurrencePicker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            3. Repetição / Recorrência
          </label>
          <CustomRecurrencePicker
            recurrenceRule={triageTask.recurrenceRule}
            recurrenceMode={triageTask.recurrenceMode}
            onChange={({ recurrenceRule, recurrenceMode }) => {
              const nextDue =
                recurrenceRule && triageTask.dueDate === null
                  ? Date.now()
                  : triageTask.dueDate;
              onApplyTriage(triageTask.id, {
                recurrenceRule,
                recurrenceMode,
                dueDate: nextDue,
              });
              setTriageTask((prev) =>
                prev
                  ? {
                      ...prev,
                      recurrenceRule,
                      recurrenceMode,
                      dueDate: nextDue,
                    }
                  : null
              );
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
              const active = triageTask.tags.includes(ctx);
              return (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => {
                    const nextTags = active
                      ? triageTask.tags.filter((t) => t !== ctx)
                      : [...triageTask.tags, ctx];
                    onApplyTriage(triageTask.id, { tags: nextTags });
                    setTriageTask((prev) =>
                      prev ? { ...prev, tags: nextTags } : null
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
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
                    onApplyTriage(triageTask.id, { priority: p });
                    setTriageTask((prev) =>
                      prev ? { ...prev, priority: p } : null
                    );
                  }}
                  className={`py-1.5 rounded-lg text-xs font-medium border ${
                    triageTask.priority === p
                      ? meta.badgeClass
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
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

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
        >
          Concluir Triagem
        </button>
      </div>
    </div>
  );
};
