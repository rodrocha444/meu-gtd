import React from 'react';
import { Repeat } from 'lucide-react';
import type { RecurrenceMode } from '../../db/schema';

interface RecurrenceBadgeProps {
  label: string;
  recurrenceMode: RecurrenceMode;
  isYearly: boolean;
  size?: 'xs' | 'sm';
}

export const RecurrenceBadge: React.FC<RecurrenceBadgeProps> = ({
  label,
  recurrenceMode,
  isYearly,
  size = 'xs',
}) => {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5';
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const colorClass =
    recurrenceMode === 'after_completion'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
      : isYearly
      ? 'bg-pink-500/10 text-pink-300 border-pink-500/25'
      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';

  return (
    <span
      className={`${sizeClass} rounded font-medium flex items-center gap-1 border ${colorClass}`}
    >
      <Repeat className={iconClass} />
      <span>{label}</span>
    </span>
  );
};
