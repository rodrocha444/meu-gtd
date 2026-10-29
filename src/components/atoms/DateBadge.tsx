import React from 'react';

interface DateBadgeProps {
  label: string;
  variant?: 'due' | 'completed' | 'overdue';
  size?: 'xs' | 'sm';
}

export const DateBadge: React.FC<DateBadgeProps> = ({
  label,
  variant = 'due',
  size = 'xs',
}) => {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5';
  let colorClass = 'text-amber-400/90 bg-amber-500/10';

  if (variant === 'completed') {
    colorClass = 'text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20';
  } else if (variant === 'overdue') {
    colorClass = 'text-red-400/90 bg-red-500/10 border border-red-500/20';
  }

  return (
    <span className={`${sizeClass} rounded ml-auto ${colorClass}`}>{label}</span>
  );
};
