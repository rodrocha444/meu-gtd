import React from 'react';
import { Check } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '../../db/schema';
import { getPriorityMeta } from '../../constants/priority';

interface PriorityCheckboxProps {
  status: TaskStatus;
  priority: TaskPriority;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

export const PriorityCheckbox: React.FC<PriorityCheckboxProps> = ({
  status,
  priority,
  onToggle,
  size = 'md',
}) => {
  const pMeta = getPriorityMeta(priority);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const iconClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <button
      type="button"
      aria-label="Alternar conclusão da tarefa"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`${sizeClass} rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
        status === 'completed' ? pMeta.checkboxBgActive : pMeta.checkboxBorder
      }`}
    >
      {status === 'completed' && <Check className={`${iconClass} stroke-[3]`} />}
    </button>
  );
};
