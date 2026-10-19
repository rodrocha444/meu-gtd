import React from 'react';
import { Check, Trash2 } from 'lucide-react';
import type { UITask } from '../../types/task';

interface SubtaskItemProps {
  subtask: UITask;
  onToggle: (subtask: UITask) => void;
  onDelete: (subtaskId: string) => void;
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  onToggle,
  onDelete,
}) => (
  <div className="group flex items-start justify-between gap-2.5 px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
    <div
      onClick={() => onToggle(subtask)}
      className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer"
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
          subtask.status === 'completed'
            ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
            : 'border-zinc-600'
        }`}
      >
        {subtask.status === 'completed' && <Check className="w-3 h-3 stroke-[3]" />}
      </div>
      <span
        className={`text-xs break-words whitespace-pre-wrap flex-1 leading-snug ${
          subtask.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'
        }`}
      >
        {subtask.title}
      </span>
    </div>
    <button
      type="button"
      aria-label="Excluir subtarefa"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(subtask.id);
      }}
      className="opacity-60 hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 -mt-0.5"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);
