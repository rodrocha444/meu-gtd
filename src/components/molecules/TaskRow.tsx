import React, { useMemo } from 'react';
import {
  ArrowRightLeft,
  Pin,
  Sparkles,
  Trash2,
  AlignLeft,
} from 'lucide-react';
import type { TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import { formatRecurrenceBadge, parseRRule } from '../../utils/recurrence';
import { PriorityCheckbox } from '../atoms/PriorityCheckbox';
import { TaskMetaBadges } from './TaskMetaBadges';
import type { UITask } from '../../types/task';

export interface TaskRowProps {
  task: UITask;
  subtasks: UITask[];
  listName: string;
  isSelected: boolean;
  onSelect: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onOpenTriage: (task: UITask) => void;
  onDelete: (task: UITask) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  subtasks,
  listName,
  isSelected,
  onSelect,
  onToggleStatus,
  onOpenTriage,
  onDelete,
}) => {
  const isDone = task.status === 'completed';

  const formattedDate = useMemo(() => {
    if (!task.dueDate) return null;
    const d = new Date(task.dueDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }, [task.dueDate]);

  const formattedCompletion = useMemo(() => {
    if (!task.completedAt) return null;
    const d = new Date(task.completedAt);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `Concluída hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Concluída em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  }, [task.completedAt]);

  const recurrenceLabel = useMemo(
    () => formatRecurrenceBadge(task.recurrenceRule, task.recurrenceMode, true),
    [task.recurrenceRule, task.recurrenceMode]
  );

  const isYearlyEvent = useMemo(
    () => parseRRule(task.recurrenceRule)?.freq === 'YEARLY',
    [task.recurrenceRule]
  );

  const hasDescription = useMemo(
    () => Boolean(task.description && task.description.trim().length > 0),
    [task.description]
  );

  const completedSubtasksCount = useMemo(
    () => subtasks.filter((s) => s.status === 'completed').length,
    [subtasks]
  );

  return (
    <div
      onClick={() => onSelect(task)}
      className={`group flex items-start gap-3 px-3.5 py-3 rounded-xl mb-1.5 border cursor-pointer transition-colors ${
        isSelected
          ? 'bg-zinc-800/95 border-zinc-700/80 shadow-sm'
          : 'bg-zinc-900 border-zinc-800/80 hover:bg-zinc-800/60 active:bg-zinc-800'
      }`}
    >
      {/* Checkbox Customizado TickTick (Muda de cor por Prioridade) */}
      <div className="mt-0.5">
        <PriorityCheckbox
          status={task.status}
          priority={task.priority}
          onToggle={() =>
            onToggleStatus(
              task,
              task.status === 'completed' ? 'pending' : 'completed'
            )
          }
        />
      </div>

      {/* Conteúdo Central da Tarefa */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {task.isPinned && (
            <Pin className="w-3.5 h-3.5 text-indigo-400 shrink-0 rotate-45" />
          )}
          {isYearlyEvent && (
            <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          )}
          <span
            className={`text-sm font-medium truncate ${
              isDone
                ? 'line-through text-zinc-500'
                : 'text-zinc-100'
            }`}
          >
            {task.title}
          </span>
          {hasDescription && (
            <span
              aria-label="Possui anotações"
              className="shrink-0 text-zinc-400 inline-flex items-center"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Metadados GTD: Contextos (@tag), Lista, Subtarefas, Recorrência e Data */}
        <TaskMetaBadges
          listName={listName}
          recurrenceLabel={recurrenceLabel}
          recurrenceMode={task.recurrenceMode}
          isYearly={isYearlyEvent}
          tags={task.tags}
          hasDescription={hasDescription}
          subtasksTotal={subtasks.length}
          subtasksDone={completedSubtasksCount}
          status={task.status}
          formattedDate={formattedDate}
          formattedCompletion={formattedCompletion}
        />
      </div>

      {/* Ações Rápidas: Triagem GTD e Excluir Tarefa */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          aria-label="Triagem Rápida GTD"
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onOpenTriage(task);
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Excluir tarefa"
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onDelete(task);
          }}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
