import React from 'react';
import { Folder } from 'lucide-react';

interface NoteFolderBadgeProps {
  name: string;
  color?: string;
  className?: string;
  size?: 'xs' | 'sm';
}

export const NoteFolderBadge: React.FC<NoteFolderBadgeProps> = ({
  name,
  color = '#8b5cf6',
  className = '',
  size = 'xs',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md px-1.5 py-0.5 border border-zinc-800 ${
        size === 'xs' ? 'text-[10px]' : 'text-xs'
      } ${className}`}
      style={{ backgroundColor: `${color}15`, color }}
    >
      <Folder className="w-3 h-3 shrink-0" style={{ color }} />
      <span className="truncate max-w-[120px]">{name}</span>
    </span>
  );
};
