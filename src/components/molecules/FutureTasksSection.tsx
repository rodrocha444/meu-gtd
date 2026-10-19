import React, { useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { TaskRow } from './TaskRow';
import type { TaskStatus } from '../../db/schema';
import type { UIList, UITask } from '../../types/task';

export interface FutureTasksSectionProps {
  futureTasks: UITask[];
  allTasks: UITask[];
  listMap: Record<string, UIList>;
  selectedTaskId: string | null;
  onSelectTask: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
}

/**
 * Seção de Ações Futuras (tarefas agendadas com mais de 10 dias de distância).
 * Exibida contraída por padrão dentro da lista Ações Seguintes.
 */
export const FutureTasksSection: React.FC<FutureTasksSectionProps> = ({
  futureTasks,
  allTasks,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onDeleteTask,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (futureTasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-3 border-t border-zinc-800/80">
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          setIsExpanded((v) => !v);
        }}
        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/80 transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-3 h-3" />
          </div>
          <span className="truncate">Ações Futuras ({futureTasks.length})</span>
          <span className="text-[10px] font-normal text-zinc-400 px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 shrink-0">
            &gt; 10 dias
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 shrink-0 ${
            isExpanded ? 'rotate-90 text-zinc-300' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1">
          {futureTasks.map((task) => {
            const subtasks = allTasks.filter((s) => s.parentTaskId === task.id);
            const listName = listMap[task.listId]?.name ?? 'Ações Seguintes';
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
