import React from 'react';
import { AlignLeft, ArrowRightLeft, Repeat, Sparkles, Trash2 } from 'lucide-react';
import type { TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import { formatRecurrenceBadge, parseRRule } from '../../utils/recurrence';
import { PriorityCheckbox } from '../atoms/PriorityCheckbox';
import type { CalendarTaskItem } from '../CalendarView';

interface CalendarAgendaItemProps {
  task: CalendarTaskItem;
  isProjected: boolean;
  listName: string;
  isSelected: boolean;
  onSelect: (task: CalendarTaskItem) => void;
  onToggleStatus: (task: CalendarTaskItem, status?: TaskStatus) => void;
  onOpenTriage: (task: CalendarTaskItem) => void;
  onDelete?: (task: CalendarTaskItem) => void;
}

export const CalendarAgendaItem: React.FC<CalendarAgendaItemProps> = ({
  task,
  isProjected,
  listName,
  isSelected,
  onSelect,
  onToggleStatus,
  onOpenTriage,
  onDelete,
}) => {
  const isDone = task.status === 'completed';
  const recLabel = formatRecurrenceBadge(task.recurrenceRule, task.recurrenceMode, true);
  const isYearly = parseRRule(task.recurrenceRule)?.freq === 'YEARLY';

  return (
    <div
      key={`${task.id}-${isProjected ? 'proj' : 'real'}`}
      onClick={() => onSelect(task)}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
        isSelected
          ? 'bg-zinc-800 border-indigo-500/50'
          : 'bg-zinc-950/70 hover:bg-zinc-800/60 border-zinc-800/90'
      }`}
    >
      <PriorityCheckbox
        status={task.status}
        priority={task.priority}
        onToggle={() =>
          onToggleStatus(task, task.status === 'completed' ? 'pending' : 'completed')
        }
        size="md"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isYearly && (
            <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          )}
          <span
            className={`text-xs sm:text-sm font-medium truncate ${
              isDone ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {task.title}
          </span>
          {task.description.trim().length > 0 && (
            <span
              aria-label="Possui anotações"
              className="shrink-0 text-zinc-400 inline-flex items-center"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </span>
          )}
          {isProjected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium shrink-0">
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
                  : isYearly
                  ? 'bg-pink-500/10 text-pink-300 border-pink-500/25'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
              }`}
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{recLabel}</span>
            </span>
          )}

          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800"
            >
              {tag}
            </span>
          ))}

          {task.description.trim().length > 0 && (
            <span
              aria-label="Possui anotações"
              className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 bg-zinc-900 text-zinc-400 border border-zinc-800"
            >
              <AlignLeft className="w-2.5 h-2.5 text-zinc-400" />
              <span>Nota</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          aria-label="Triagem rápida da tarefa"
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onOpenTriage(task);
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
        {onDelete && (
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
        )}
      </div>
    </div>
  );
};
