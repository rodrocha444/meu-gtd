import React from 'react';
import { AlignLeft, Repeat, Trash2 } from 'lucide-react';
import type { TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import { formatRecurrenceBadge } from '../../utils/recurrence';
import { PriorityCheckbox } from '../atoms/PriorityCheckbox';
import { ReminderBadge } from '../atoms/ReminderBadge';
import type { CalendarTaskItem } from '../CalendarView';

interface CalendarAgendaItemProps {
  task: CalendarTaskItem;
  isProjected: boolean;
  listName: string;
  isSelected: boolean;
  onSelect: (task: CalendarTaskItem) => void;
  onToggleStatus: (task: CalendarTaskItem, status?: TaskStatus) => void;
  onDelete?: (task: CalendarTaskItem) => void;
}

export const CalendarAgendaItem: React.FC<CalendarAgendaItemProps> = ({
  task,
  isProjected,
  listName,
  isSelected,
  onSelect,
  onToggleStatus,
  onDelete,
}) => {
  const isDone = task.status === 'completed';
  const recLabel = formatRecurrenceBadge(task.recurrenceRule, task.recurrenceMode, true);

  return (
    <div
      key={`${task.id}-${isProjected ? 'proj' : 'real'}`}
      onClick={() => onSelect(task)}
      className={`flex items-start gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
        isSelected
          ? 'bg-zinc-800 border-indigo-500/50'
          : 'bg-zinc-950/70 hover:bg-zinc-800/60 border-zinc-800/90'
      }`}
    >
      <div className="mt-0.5">
        <PriorityCheckbox
          status={task.status}
          priority={task.priority}
          onToggle={() =>
            onToggleStatus(task, task.status === 'completed' ? 'pending' : 'completed')
          }
          size="md"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <span
            className={`text-xs sm:text-sm font-medium break-words whitespace-pre-wrap flex-1 leading-snug ${
              isDone ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {task.title}
          </span>
          {isProjected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium shrink-0 mt-0.5">
              Ocorrência futura
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className="text-[10px] text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            {listName}
          </span>

          {recLabel && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 border ${
                task.recurrenceMode === 'after_completion'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
              }`}
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{recLabel}</span>
            </span>
          )}

          {task.description.trim().length > 0 && (
            <span
              aria-label="Possui anotações"
              className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 bg-zinc-900 text-zinc-400 border border-zinc-800"
            >
              <AlignLeft className="w-2.5 h-2.5 text-zinc-400" />
              <span>Nota</span>
            </span>
          )}

          {task.status === 'pending' &&
            task.reminders &&
            task.reminders.length > 0 && (
              <ReminderBadge reminders={task.reminders} size="xs" />
            )}
        </div>
      </div>

      {onDelete && (
        <div className="flex items-center shrink-0 -mt-0.5">
          <button
            type="button"
            aria-label="Excluir tarefa"
            onClick={(e) => {
              e.stopPropagation();
              void NativeBridge.hapticLightImpact();
              onDelete(task);
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
