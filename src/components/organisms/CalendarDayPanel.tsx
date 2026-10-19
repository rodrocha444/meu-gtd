import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { TaskStatus } from '../../db/schema';
import { CalendarAgendaItem } from '../molecules/CalendarAgendaItem';
import type { CalendarTaskItem } from '../CalendarView';

interface CalendarDayPanelProps {
  selectedDay: Date;
  formattedSelectedDayTitle: string;
  selectedDayOccurrences: Array<{ task: CalendarTaskItem; isProjected: boolean }>;
  listMap: Record<string, { id: string; name: string; color: string }>;
  selectedTaskId: string | null;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleStatus: (task: CalendarTaskItem, status?: TaskStatus) => void;
  onDeleteTask?: (task: CalendarTaskItem) => void;
}

export const CalendarDayPanel: React.FC<CalendarDayPanelProps> = ({
  selectedDay: _selectedDay,
  formattedSelectedDayTitle,
  selectedDayOccurrences,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onDeleteTask,
}) => {
  return (
    <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/90 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-zinc-100 capitalize">
            {formattedSelectedDayTitle}
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-medium">
          {selectedDayOccurrences.length}{' '}
          {selectedDayOccurrences.length === 1 ? 'item agendado' : 'itens agendados'}
        </span>
      </div>

      {/* Lista de Tarefas e Eventos do Dia Selecionado */}
      {selectedDayOccurrences.length === 0 ? (
        <div className="py-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
          Nenhuma tarefa ou evento agendado para este dia.
        </div>
      ) : (
        <div className="space-y-1.5">
          {selectedDayOccurrences.map(({ task, isProjected }) => {
            const listName = listMap[task.listId]?.name ?? 'Inbox';
            return (
              <CalendarAgendaItem
                key={`${task.id}-${isProjected ? 'proj' : 'real'}`}
                task={task}
                isProjected={isProjected}
                listName={listName}
                isSelected={selectedTaskId === task.id}
                onSelect={onSelectTask}
                onToggleStatus={onToggleStatus}
                onDelete={onDeleteTask}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
