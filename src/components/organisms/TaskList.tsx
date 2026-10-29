import React from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Zap,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { TaskRow } from '../molecules/TaskRow';
import { FutureTasksSection } from '../molecules/FutureTasksSection';
import { CompletedTasksSection } from '../molecules/CompletedTasksSection';
import type { TaskStatus } from '../../db/schema';
import type { UIList, UITask } from '../../types/task';

export interface TaskListProps {
  activeView: string;
  pendingTasks: UITask[];
  futureTasks?: UITask[];
  completedTasks: UITask[];
  allTasks: UITask[];
  listMap: Record<string, UIList>;
  selectedTaskId: string | null;
  onSelectTask: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
  onGoToToday?: () => void;
  todayCount?: number;
}

export const TaskList: React.FC<TaskListProps> = ({
  activeView,
  pendingTasks,
  futureTasks = [],
  completedTasks,
  allTasks,
  listMap,
  selectedTaskId,
  onSelectTask,
  onToggleStatus,
  onDeleteTask,
  onGoToToday,
  todayCount = 0,
}) => {
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

  // 3. Ações Seguintes vazias (sem tarefas imediatas, sem futuras e sem concluídas)
  if (
    activeView === 'next_actions' &&
    pendingTasks.length === 0 &&
    futureTasks.length === 0 &&
    completedTasks.length === 0
  ) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-400">
          <Zap className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-200">
          Nenhuma Ação Seguinte pendente
        </p>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Adicione ações imediatas ou agende tarefas para os próximos 10 dias para mantê-las em seu radar.
        </p>
      </div>
    );
  }

  // 4. Qualquer outra lista sem tarefas
  if (
    activeView !== 'completed' &&
    pendingTasks.length === 0 &&
    futureTasks.length === 0 &&
    completedTasks.length === 0
  ) {
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
          <code className="text-zinc-300">amanhã</code> ou{' '}
          <code className="text-zinc-300">todo mês</code>.
        </p>
      </div>
    );
  }

  // 5. Lista Dedicada de Tarefas Concluídas
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
              onDelete={onDeleteTask}
            />
          );
        })}
      </div>
    );
  }

  // 6. Lista Normal com suporte a Ações Imediatas, Ações Futuras (> 10 dias) e Concluídas
  return (
    <div className="space-y-1">
      {/* Banner se não há ações imediatas na lista Ações Seguintes, mas existem futuras ou concluídas */}
      {activeView === 'next_actions' && pendingTasks.length === 0 && futureTasks.length > 0 && (
        <div className="py-4 px-3 mb-2 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-200">
              Sem ações imediatas para os próximos 10 dias
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Você tem {futureTasks.length} {futureTasks.length === 1 ? 'ação futura agendada' : 'ações futuras agendadas'} na seção abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Banner quando todas as pendentes normais foram concluídas e não há futuras */}
      {pendingTasks.length === 0 && futureTasks.length === 0 && completedTasks.length > 0 && (
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

      {/* Tarefas Pendentes / Imediatas */}
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
            onDelete={onDeleteTask}
          />
        );
      })}

      {/* Seção Retrátil de Ações Futuras (> 10 dias) para Ações Seguintes */}
      {futureTasks.length > 0 && (
        <FutureTasksSection
          futureTasks={futureTasks}
          allTasks={allTasks}
          listMap={listMap}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onToggleStatus={onToggleStatus}
          onDeleteTask={onDeleteTask}
        />
      )}

      {/* Seção Retrátil de Concluídas */}
      {completedTasks.length > 0 && (
        <CompletedTasksSection
          key={`completed-${activeView}`}
          completedTasks={completedTasks}
          allTasks={allTasks}
          listMap={listMap}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onToggleStatus={onToggleStatus}
          onDeleteTask={onDeleteTask}
        />
      )}
    </div>
  );
};
