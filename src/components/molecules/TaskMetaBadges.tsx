import React from 'react';
import { AlignLeft, CornerDownRight } from 'lucide-react';
import type { RecurrenceMode, TaskStatus } from '../../db/schema';
import type { TaskReminder } from '../../types/task';
import { RecurrenceBadge } from '../atoms/RecurrenceBadge';
import { DateBadge } from '../atoms/DateBadge';
import { ReminderBadge } from '../atoms/ReminderBadge';

interface TaskMetaBadgesProps {
  listName: string;
  recurrenceLabel: string | null;
  recurrenceMode: RecurrenceMode;
  hasDescription: boolean;
  subtasksTotal: number;
  subtasksDone: number;
  status: TaskStatus;
  formattedDate: string | null;
  formattedCompletion: string | null;
  reminders?: TaskReminder[];
}

export const TaskMetaBadges: React.FC<TaskMetaBadgesProps> = ({
  listName,
  recurrenceLabel,
  recurrenceMode,
  hasDescription,
  subtasksTotal,
  subtasksDone,
  status,
  formattedDate,
  formattedCompletion,
  reminders,
}) => (
  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
    <span className="text-[11px] text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded">
      {listName}
    </span>

    {recurrenceLabel && (
      <RecurrenceBadge
        label={recurrenceLabel}
        recurrenceMode={recurrenceMode}
      />
    )}

    {hasDescription && (
      <span
        aria-label="Possui anotações"
        className="text-[11px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
      >
        <AlignLeft className="w-3 h-3 text-zinc-400" />
        <span>Nota</span>
      </span>
    )}

    {subtasksTotal > 0 && (
      <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">
        <CornerDownRight className="w-3 h-3" />
        {subtasksDone}/{subtasksTotal}
      </span>
    )}

    {status === 'completed' && formattedCompletion && (
      <DateBadge label={formattedCompletion} variant="completed" />
    )}

    {formattedDate && !formattedCompletion && (
      <DateBadge label={formattedDate} variant="due" />
    )}

    {status === 'pending' && reminders && reminders.length > 0 && (
      <ReminderBadge reminders={reminders} />
    )}
  </div>
);
