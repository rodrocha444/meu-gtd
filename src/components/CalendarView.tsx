import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../db/schema';
import type { TaskReminder } from '../types/task';
import { NativeBridge } from '../lib/native';
import {
  getTaskOccurrenceOnDay,
  isSameCalendarDay,
  normalizeToNineAM,
} from '../utils/recurrence';
import { CalendarGrid } from './organisms/CalendarGrid';
import { CalendarDayPanel } from './organisms/CalendarDayPanel';

export interface CalendarTaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  isPinned: boolean;
  dueDate: number | null;
  recurrenceRule: string | null;
  recurrenceMode: RecurrenceMode;
  reminders?: TaskReminder[];
  listId: string;
  parentTaskId: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

interface CalendarViewProps {
  tasks: CalendarTaskItem[];
  listMap: Record<string, { id: string; name: string; color: string }>;
  selectedTaskId: string | null;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleStatus: (task: CalendarTaskItem, targetStatus?: TaskStatus) => void;
  onDeleteTask?: (task: CalendarTaskItem) => void;
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onDeleteTask,
}) => {
  const today = useMemo(() => normalizeToNineAM(new Date()), []);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [cursorDate, setCursorDate] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const rootTasks = useMemo(
    () => tasks.filter((t) => t.parentTaskId === null),
    [tasks]
  );

  // Gera as células de dias do mês corrente
  const calendarCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    for (let i = firstWeekday - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month, -i, 9, 0, 0, 0),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      cells.push({
        date: new Date(year, month, day, 9, 0, 0, 0),
        inCurrentMonth: true,
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i, 9, 0, 0, 0),
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [cursorDate]);

  // Mapeia as tarefas/ocorrências para cada célula
  const occurrencesByDateKey = useMemo(() => {
    const map = new Map<
      string,
      Array<{ task: CalendarTaskItem; isProjected: boolean }>
    >();

    for (const cell of calendarCells) {
      const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
      const dayItems: Array<{ task: CalendarTaskItem; isProjected: boolean }> = [];

      for (const t of rootTasks) {
        const occ = getTaskOccurrenceOnDay(t, cell.date);
        if (occ.occurs) {
          dayItems.push({ task: t, isProjected: occ.isProjected });
        }
      }

      dayItems.sort((a, b) => {
        if ((a.task.status === 'pending') !== (b.task.status === 'pending')) {
          return a.task.status === 'pending' ? -1 : 1;
        }
        if (a.task.priority !== b.task.priority) {
          return b.task.priority - a.task.priority;
        }
        if (a.task.dueDate !== null && b.task.dueDate !== null && a.task.dueDate !== b.task.dueDate) {
          return a.task.dueDate - b.task.dueDate;
        }
        return a.task.sortOrder - b.task.sortOrder;
      });

      map.set(key, dayItems);
    }

    return map;
  }, [calendarCells, rootTasks]);

  const selectedDayKey = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
  const selectedDayOccurrences = useMemo(() => {
    const fromMap = occurrencesByDateKey.get(selectedDayKey);
    if (fromMap) return fromMap;

    const list: Array<{ task: CalendarTaskItem; isProjected: boolean }> = [];
    for (const t of rootTasks) {
      const occ = getTaskOccurrenceOnDay(t, selectedDay);
      if (occ.occurs) {
        list.push({ task: t, isProjected: occ.isProjected });
      }
    }
    list.sort((a, b) => {
      if ((a.task.status === 'pending') !== (b.task.status === 'pending')) {
        return a.task.status === 'pending' ? -1 : 1;
      }
      if (a.task.priority !== b.task.priority) {
        return b.task.priority - a.task.priority;
      }
      if (a.task.dueDate !== null && b.task.dueDate !== null && a.task.dueDate !== b.task.dueDate) {
        return a.task.dueDate - b.task.dueDate;
      }
      return a.task.sortOrder - b.task.sortOrder;
    });
    return list;
  }, [occurrencesByDateKey, rootTasks, selectedDay, selectedDayKey]);

  const handleNavigate = (direction: -1 | 1) => {
    void NativeBridge.hapticLightImpact();
    const next = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth() + direction,
      1,
      9,
      0,
      0,
      0
    );
    setCursorDate(next);
  };

  const isCurrentMonth =
    cursorDate.getFullYear() === today.getFullYear() &&
    cursorDate.getMonth() === today.getMonth();

  const handleGoToCurrentMonth = () => {
    void NativeBridge.hapticLightImpact();
    const now = normalizeToNineAM(new Date());
    setSelectedDay(now);
    setCursorDate(new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0));
  };

  const headerPeriodLabel = useMemo(() => {
    return `${MONTH_NAMES_PT[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`;
  }, [cursorDate]);

  const formattedSelectedDayTitle = useMemo(() => {
    if (isSameCalendarDay(selectedDay, today)) {
      return `Hoje • ${selectedDay.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })}`;
    }
    return selectedDay.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDay, today]);

  return (
    <div className="space-y-4">
      {/* Barra de Controles do Calendário */}
      <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/90">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => handleNavigate(-1)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h2 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight px-1 select-none text-center">
            {headerPeriodLabel}
          </h2>

          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => handleNavigate(1)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            type="button"
            onClick={handleGoToCurrentMonth}
            className="mt-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full text-zinc-300 hover:text-zinc-100 bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800/80 active:scale-95 transition-all"
          >
            Mês atual
          </button>
        )}
      </div>

      {/* Grade do Calendário */}
      <CalendarGrid
        calendarCells={calendarCells}
        occurrencesByDateKey={occurrencesByDateKey}
        selectedDay={selectedDay}
        today={today}
        onSelectDay={(d) => setSelectedDay(d)}
      />

      {/* Painel da Agenda do Dia Selecionado */}
      <CalendarDayPanel
        selectedDay={selectedDay}
        formattedSelectedDayTitle={formattedSelectedDayTitle}
        selectedDayOccurrences={selectedDayOccurrences}
        listMap={listMap}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleStatus={onToggleStatus}
        onDeleteTask={onDeleteTask}
      />
    </div>
  );
};
