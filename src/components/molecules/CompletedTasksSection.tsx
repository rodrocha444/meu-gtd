import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { TaskRow } from './TaskRow';
import type { TaskStatus } from '../../db/schema';
import type { UIList, UITask } from '../../types/task';

export interface CompletedTasksSectionProps {
  completedTasks: UITask[];
  allTasks: UITask[];
  listMap: Record<string, UIList>;
  selectedTaskId: string | null;
  defaultExpanded?: boolean;
  onSelectTask: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
}

/**
 * Seção retrátil de tarefas concluídas exibida ao final das listas ativas.
 * Colapsada por padrão para manter o foco nas pendentes.
 */
export const CompletedTasksSection: React.FC<CompletedTasksSectionProps> = ({
  completedTasks,
  allTasks,
  listMap,
  selectedTaskId,
  defaultExpanded = false,
  onSelectTask,
  onToggleStatus,
  onDeleteTask,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (completedTasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 pt-3 border-t border-zinc-800/80">
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          setIsExpanded((v) => !v);
        }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isExpanded ? 'rotate-90 text-zinc-300' : 'text-zinc-500'
          }`}
        />
        <span>Concluídas ({completedTasks.length})</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1">
          {completedTasks.map((task) => {
            const subtasks = allTasks.filter((s) => s.parentTaskId === task.id);
            const listName = listMap[task.listId]?.name ?? 'Inbox';
            return (
              <TaskRow
                key={task.id}
                task={task}
                subtasks={subtasks}
                listName={listName}
                isSelected={selectedTaskId === task.id}
                onSelect={onSelectTask}
                onToggleStatus={onToggleStatus}
                onDelete={onDeleteTask}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
