import React from 'react';

interface DateBadgeProps {
  label: string;
  variant?: 'due' | 'completed';
  size?: 'xs' | 'sm';
}

export const DateBadge: React.FC<DateBadgeProps> = ({
  label,
  variant = 'due',
  size = 'xs',
}) => {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5';
  const colorClass =
    variant === 'completed'
      ? 'text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20'
      : 'text-amber-400/90 bg-amber-500/10';

  return (
    <span className={`${sizeClass} rounded ml-auto ${colorClass}`}>{label}</span>
  );
};
