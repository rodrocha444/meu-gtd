import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../db/schema';
import { NativeBridge } from '../lib/native';
import {
  getTaskOccurrenceOnDay,
  isSameCalendarDay,
  normalizeToNineAM,
} from '../utils/recurrence';
import { CustomSegmentedControl } from './ui/CustomControls';
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
  listId: string;
  parentTaskId: string | null;
  tags: string[];
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

type CalendarGridMode = 'month' | 'week';

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
  onOpenTriage,
  onDeleteTask,
  onCreateTaskOnDate,
}) => {
  const today = useMemo(() => normalizeToNineAM(new Date()), []);
  const [gridMode, setGridMode] = useState<CalendarGridMode>('month');
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [cursorDate, setCursorDate] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const rootTasks = useMemo(
    () => tasks.filter((t) => t.parentTaskId === null),
    [tasks]
  );

  // Gera as células de dias conforme o modo (Mês ou Semana)
  const calendarCells = useMemo(() => {
    if (gridMode === 'week') {
      const startOfWeek = new Date(cursorDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      startOfWeek.setHours(9, 0, 0, 0);

      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return {
          date: d,
          inCurrentMonth: d.getMonth() === cursorDate.getMonth(),
        };
      });
    }

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
  }, [cursorDate, gridMode]);

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
        return b.task.priority - a.task.priority;
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
    return list;
  }, [occurrencesByDateKey, rootTasks, selectedDay, selectedDayKey]);

  const handleNavigate = (direction: -1 | 1) => {
    void NativeBridge.hapticLightImpact();
    if (gridMode === 'week') {
      const next = new Date(cursorDate);
      next.setDate(next.getDate() + direction * 7);
      setCursorDate(next);
      setSelectedDay(next);
    } else {
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
    }
  };

  const handleGoToToday = () => {
    void NativeBridge.hapticLightImpact();
    const now = normalizeToNineAM(new Date());
    setSelectedDay(now);
    setCursorDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0));
  };

  const headerPeriodLabel = useMemo(() => {
    if (gridMode === 'week' && calendarCells.length === 7) {
      const first = calendarCells[0]!.date;
      const last = calendarCells[6]!.date;
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} – ${last.getDate()} de ${
          MONTH_NAMES_PT[first.getMonth()]
        } ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES_PT[first.getMonth()]?.slice(0, 3)} – ${last.getDate()} ${MONTH_NAMES_PT[last.getMonth()]?.slice(0, 3)}`;
    }
    return `${MONTH_NAMES_PT[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`;
  }, [calendarCells, cursorDate, gridMode]);

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
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/90">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 p-0.5">
            <button
              type="button"
              aria-label="Período anterior"
              onClick={() => handleNavigate(-1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:text-indigo-300 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label="Próximo período"
              onClick={() => handleNavigate(1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
            {headerPeriodLabel}
          </h2>
        </div>

        <CustomSegmentedControl<CalendarGridMode>
          size="sm"
          value={gridMode}
          onChange={(mode) => {
            setGridMode(mode);
            if (mode === 'week') {
              setCursorDate(new Date(selectedDay));
            } else {
              setCursorDate(
                new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1)
              );
            }
          }}
          options={[
            { value: 'month', label: 'Mês' },
            { value: 'week', label: 'Semana' },
          ]}
        />
      </div>

      {/* Grade do Calendário */}
      <CalendarGrid
        calendarCells={calendarCells}
        occurrencesByDateKey={occurrencesByDateKey}
        selectedDay={selectedDay}
        today={today}
        gridMode={gridMode}
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
        onOpenTriage={onOpenTriage}
        onDeleteTask={onDeleteTask}
        onCreateTaskOnDate={onCreateTaskOnDate}
      />
    </div>
  );
};
