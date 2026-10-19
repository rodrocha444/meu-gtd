import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Sparkles } from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import { buildRRule, normalizeToNineAM } from '../../utils/recurrence';
import { CustomSegmentedControl } from '../ui/CustomControls';
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
  onOpenTriage: (task: CalendarTaskItem) => void;
  onDeleteTask?: (task: CalendarTaskItem) => void;
  onCreateTaskOnDate: (params: {
    title: string;
    dueDate: number;
    recurrenceRule: string | null;
    recurrenceMode: RecurrenceMode;
    tags: string[];
    priority: TaskPriority;
  }) => void;
}

export const CalendarDayPanel: React.FC<CalendarDayPanelProps> = ({
  selectedDay,
  formattedSelectedDayTitle,
  selectedDayOccurrences,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onOpenTriage,
  onDeleteTask,
  onCreateTaskOnDate,
}) => {
  const [dayInputTitle, setDayInputTitle] = useState('');
  const [dayEntryPreset, setDayEntryPreset] = useState<
    'task' | 'birthday' | 'routine_after'
  >('task');

  const handleAddOnSelectedDay = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = dayInputTitle.trim();
    if (!clean) return;

    const targetDueDate = normalizeToNineAM(selectedDay).getTime();

    if (dayEntryPreset === 'birthday') {
      onCreateTaskOnDate({
        title: clean,
        dueDate: targetDueDate,
        recurrenceRule: buildRRule('YEARLY', 1),
        recurrenceMode: 'fixed',
        tags: ['#aniversario', '@evento'],
        priority: 1,
      });
    } else if (dayEntryPreset === 'routine_after') {
      onCreateTaskOnDate({
        title: clean,
        dueDate: targetDueDate,
        recurrenceRule: buildRRule('WEEKLY', 1),
        recurrenceMode: 'after_completion',
        tags: ['#rotina'],
        priority: 2,
      });
    } else {
      onCreateTaskOnDate({
        title: clean,
        dueDate: targetDueDate,
        recurrenceRule: null,
        recurrenceMode: 'fixed',
        tags: [],
        priority: 0,
      });
    }

    setDayInputTitle('');
    void NativeBridge.hapticLightImpact();
  };

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

      {/* Formulário Rápido para Adicionar Tarefa / Aniversário / Rotina no Dia Selecionado */}
      <form onSubmit={handleAddOnSelectedDay} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Novo item para este dia:
          </span>
          <CustomSegmentedControl<'task' | 'birthday' | 'routine_after'>
            size="sm"
            value={dayEntryPreset}
            onChange={setDayEntryPreset}
            options={[
              { value: 'task', label: 'Tarefa' },
              {
                value: 'birthday',
                label: 'Aniversário / Evento Anual',
                icon: <Sparkles className="w-3 h-3 text-pink-400" />,
              },
              {
                value: 'routine_after',
                label: 'Repetir após Concluir',
                icon: <Clock className="w-3 h-3 text-emerald-400" />,
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 focus-within:border-indigo-500 rounded-xl px-3 py-2">
          <Plus className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={dayInputTitle}
            onChange={(e) => setDayInputTitle(e.target.value)}
            placeholder={
              dayEntryPreset === 'birthday'
                ? 'Ex: Aniversário do Rodrigo (repete todo ano nesta data)...'
                : dayEntryPreset === 'routine_after'
                ? 'Ex: Regar plantas / Revisar backup (repete após conclusão)...'
                : 'Adicionar tarefa para este dia...'
            }
            className="flex-1 bg-transparent text-base sm:text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!dayInputTitle.trim()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-all"
          >
            Agendar
          </button>
        </div>
      </form>

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
                onOpenTriage={onOpenTriage}
                onDelete={onDeleteTask}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
