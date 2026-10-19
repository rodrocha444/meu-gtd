import React from 'react';
import { Bell } from 'lucide-react';
import type { TaskReminder } from '../../types/task';
import { formatReminderBadgeText } from '../../utils/reminder';

interface ReminderBadgeProps {
  reminders?: TaskReminder[];
  reminder?: TaskReminder;
  className?: string;
  size?: 'xs' | 'sm';
}

/**
 * Indicador visual minimalista de lembrete na tarefa:
 * Exibe exclusivamente o ícone de sininho, com tooltip contendo os detalhes.
 */
export const ReminderBadge: React.FC<ReminderBadgeProps> = ({
  reminders,
  reminder,
  className = '',
  size = 'xs',
}) => {
  const allReminders = reminders ?? (reminder ? [reminder] : []);
  if (allReminders.length === 0) return null;

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const tooltipText = allReminders.map(formatReminderBadgeText).join('; ');

  return (
    <span
      title={`Lembrete: ${tooltipText}`}
      aria-label={`Lembrete: ${tooltipText}`}
      className={`inline-flex items-center text-amber-400 shrink-0 ${className}`}
    >
      <Bell className={`${iconClass} fill-amber-400/20`} />
    </span>
  );
};
