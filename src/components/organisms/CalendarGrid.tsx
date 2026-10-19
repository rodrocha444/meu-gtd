import React from 'react';
import type { CalendarTaskItem } from '../CalendarView';
import { CalendarDayCell } from '../molecules/CalendarDayCell';

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarGridProps {
  calendarCells: Array<{ date: Date; inCurrentMonth: boolean }>;
  occurrencesByDateKey: Map<string, Array<{ task: CalendarTaskItem; isProjected: boolean }>>;
  selectedDay: Date;
  today: Date;
  onSelectDay: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calendarCells,
  occurrencesByDateKey,
  selectedDay,
  today,
  onSelectDay,
}) => {
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/90 overflow-hidden">
      {/* Cabeçalho dos Dias da Semana */}
      <div className="grid grid-cols-7 border-b border-zinc-800/80 bg-zinc-950/60">
        {WEEKDAY_NAMES_SHORT.map((dayName) => (
          <div
            key={dayName}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Células dos Dias */}
      <div className="grid grid-cols-7 divide-x divide-y divide-zinc-800/60">
        {calendarCells.map(({ date, inCurrentMonth }) => {
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayOccurrences = occurrencesByDateKey.get(key) ?? [];
          const isSelected = isSameDay(date, selectedDay);
          const isToday = isSameDay(date, today);

          return (
            <CalendarDayCell
              key={key}
              date={date}
              inCurrentMonth={inCurrentMonth}
              isSelected={isSelected}
              isToday={isToday}
              occurrences={dayOccurrences}
              onClick={onSelectDay}
            />
          );
        })}
      </div>
    </div>
  );
};
