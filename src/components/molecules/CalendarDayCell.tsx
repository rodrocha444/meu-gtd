import React from 'react';
import { AlignLeft, Repeat } from 'lucide-react';
import type { TaskPriority } from '../../db/schema';
import { parseRRule } from '../../utils/recurrence';
import { NativeBridge } from '../../lib/native';
import type { CalendarTaskItem } from '../CalendarView';

const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  3: 'bg-red-500',
  2: 'bg-amber-400',
  1: 'bg-blue-500',
  0: 'bg-zinc-500',
};

const PRIORITY_PILL_CLASS: Record<TaskPriority, string> = {
  3: 'bg-red-500/15 text-red-300 border-red-500/30',
  2: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
  1: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  0: 'bg-zinc-800/90 text-zinc-300 border-zinc-700/70',
};

interface CalendarDayCellProps {
  date: Date;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  occurrences: Array<{ task: CalendarTaskItem; isProjected: boolean }>;
  onClick: (date: Date) => void;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  date,
  inCurrentMonth,
  isSelected,
  isToday,
  occurrences,
  onClick,
}) => {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return (
    <button
      key={key}
      type="button"
      onClick={() => {
        void NativeBridge.hapticLightImpact();
        onClick(date);
      }}
      className={`relative flex flex-col items-stretch text-left transition-colors p-1.5 sm:p-2 min-h-16 sm:min-h-24 ${
        isSelected
          ? 'bg-indigo-600/15 ring-1 ring-inset ring-indigo-500/70'
          : inCurrentMonth
          ? 'bg-zinc-900/40 hover:bg-zinc-800/50'
          : 'bg-zinc-950/60 text-zinc-600 hover:bg-zinc-900/60'
      }`}
    >
      {/* Número do Dia */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
            isToday
              ? 'bg-indigo-600 text-white font-bold shadow-sm'
              : isSelected
              ? 'text-indigo-300 font-bold'
              : inCurrentMonth
              ? 'text-zinc-200'
              : 'text-zinc-600'
          }`}
        >
          {date.getDate()}
        </span>

        {occurrences.length > 0 && (
          <span className="text-[10px] font-semibold text-zinc-400 sm:hidden">
            {occurrences.length}
          </span>
        )}
      </div>

      {/* Indicadores Compactos no Mobile (Dots por Prioridade/Evento) */}
      {occurrences.length > 0 && (
        <div className="flex sm:hidden flex-wrap items-center gap-1 mt-auto pb-0.5">
          {occurrences.slice(0, 4).map(({ task, isProjected }) => (
            <span
              key={`${task.id}-${isProjected ? 'proj' : 'real'}`}
              className={`w-1.5 h-1.5 rounded-full ${
                PRIORITY_DOT_CLASS[task.priority]
              } ${task.status !== 'pending' ? 'opacity-40' : ''}`}
            />
          ))}
        </div>
      )}

      {/* Mini-Pílulas de Tarefas/Eventos no Desktop */}
      <div className="hidden sm:flex flex-col gap-1 w-full overflow-hidden">
        {occurrences
          .slice(0, 2)
          .map(({ task, isProjected }) => {
            const parsedRec = parseRRule(task.recurrenceRule);
            const isDone = task.status === 'completed';

            return (
              <div
                key={`${task.id}-${isProjected ? 'proj' : 'real'}`}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border truncate flex items-center gap-1 ${
                  PRIORITY_PILL_CLASS[task.priority]
                } ${isDone ? 'line-through opacity-50' : ''} ${
                  isProjected ? 'border-dashed opacity-85' : ''
                }`}
              >
                {parsedRec && (
                  <Repeat className="w-2.5 h-2.5 shrink-0" />
                )}
                <span className="truncate">{task.title}</span>
                {task.description.trim().length > 0 && (
                  <AlignLeft className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                )}
              </div>
            );
          })}

        {occurrences.length > 2 && (
          <span className="text-[10px] font-semibold text-zinc-400 pl-1">
            +{occurrences.length - 2} mais
          </span>
        )}
      </div>
    </button>
  );
};
