import React from 'react';

interface TagChipProps {
  tag: string;
  size?: 'sm' | 'xs';
}

export const TagChip: React.FC<TagChipProps> = ({ tag, size = 'xs' }) => {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 'text-[11px] px-1.5 py-0.5';
  const isContext = tag.startsWith('@');

  return (
    <span
      className={`${sizeClass} rounded font-medium ${
        isContext
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
      }`}
    >
      {tag}
    </span>
  );
};
