import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { TaskRow } from '../molecules/TaskRow';
import type { TaskStatus } from '../../db/schema';
import type { UIList, UITask } from '../../types/task';

interface TaskListProps {
  activeView: string;
  pendingTasks: UITask[];
  completedTasks: UITask[];
  allTasks: UITask[];
  listMap: Record<string, UIList>;
  selectedTaskId: string | null;
  onSelectTask: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onOpenTriage: (task: UITask) => void;
  onDeleteTask: (task: UITask) => void;
  onGoToToday?: () => void;
  todayCount?: number;
}

export const TaskList: React.FC<TaskListProps> = ({
  activeView,
  pendingTasks,
  completedTasks,
  allTasks,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onOpenTriage,
  onDeleteTask,
  onGoToToday,
  todayCount = 0,
}) => {
  const [showCompletedSection, setShowCompletedSection] = useState(true);

  // 1. Visão de Concluídas vazia
  if (activeView === 'completed' && completedTasks.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-zinc-300">
          Nenhuma tarefa concluída
        </p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          As tarefas que você concluir em qualquer lista ou projeto aparecerão aqui no seu histórico.
        </p>
      </div>
    );
  }

  // 2. Inbox vazia (Inbox Zero)
  if (activeView === 'inbox' && pendingTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3 text-blue-400">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-200">
          Caixa de Entrada Vazia (Inbox Zero)
        </p>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Todas as suas ideias e tarefas capturadas foram triadas.
        </p>
        {onGoToToday && (
          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onGoToToday();
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ir para Tarefas de Hoje ({todayCount})</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Qualquer outra lista sem tarefas
  if (activeView !== 'completed' && pendingTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-500">
          <Check className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-zinc-300">
          Mente clara como água (Mind Like Water)
        </p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          Use a barra rápida abaixo com <code className="text-zinc-300">!alta</code>,{' '}
          <code className="text-zinc-300">@computador</code>,{' '}
          <code className="text-zinc-300">todo ano</code> ou{' '}
          <code className="text-zinc-300">após concluir</code>.
        </p>
      </div>
    );
  }

  // 4. Lista Dedicada de Tarefas Concluídas
  if (activeView === 'completed') {
    return (
      <div className="space-y-1">
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
              onOpenTriage={onOpenTriage}
              onDelete={onDeleteTask}
            />
          );
        })}
      </div>
    );
  }

  // 5. Lista Normal (com Pendentes e Concluídas colapsáveis)
  return (
    <div className="space-y-1">
      {pendingTasks.length === 0 && completedTasks.length > 0 && (
        <div className="py-6 flex flex-col items-center justify-center text-center px-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-zinc-300">
            Tudo pronto por aqui!
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Todas as tarefas pendentes desta lista foram concluídas.
          </p>
        </div>
      )}

      {pendingTasks.map((task) => {
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
            onOpenTriage={onOpenTriage}
            onDelete={onDeleteTask}
          />
        );
      })}

      {completedTasks.length > 0 && (
        <div className="mt-5 pt-3 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              setShowCompletedSection((v) => !v);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showCompletedSection ? 'rotate-90 text-zinc-300' : 'text-zinc-500'
              }`}
            />
            <span>Concluídas ({completedTasks.length})</span>
          </button>

          {showCompletedSection && (
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
                    onOpenTriage={onOpenTriage}
                    onDelete={onDeleteTask}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
