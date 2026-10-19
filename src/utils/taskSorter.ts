import type { UITask } from '../types/task';

/**
 * Retorna o timestamp de início do dia (00:00:00.000) no fuso horário local.
 */
export function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Ordenação principal de tarefas (TickTick + GTD):
 * 1. Status: pendentes antes de concluídas
 * 2. Dia (data de vencimento): tarefas agendadas em ordem cronológica de dias (mais antigas/atrasadas primeiro)
 * 3. Tarefas sem data: posicionadas após as tarefas com data
 * 4. Prioridade: para tarefas no mesmo dia (ou ambas sem data), maior prioridade primeiro (3 -> 2 -> 1 -> 0)
 * 5. Desempate: horário exato da dueDate (mais cedo primeiro) -> sortOrder / ordem de criação
 */
export function compareTasksByDayThenPriority(a: UITask, b: UITask): number {
  // 1. Pendentes antes de Concluídas
  if ((a.status === 'pending') !== (b.status === 'pending')) {
    return a.status === 'pending' ? -1 : 1;
  }

  // 2. Ordenação por dia (data de vencimento)
  const hasDateA = a.dueDate !== null;
  const hasDateB = b.dueDate !== null;

  if (hasDateA && hasDateB) {
    const dayA = getStartOfDay(a.dueDate!);
    const dayB = getStartOfDay(b.dueDate!);
    if (dayA !== dayB) {
      return dayA - dayB;
    }
  } else if (hasDateA && !hasDateB) {
    // Tarefa com data vem antes de tarefa sem data
    return -1;
  } else if (!hasDateA && hasDateB) {
    // Tarefa sem data vem depois de tarefa com data
    return 1;
  }

  // 3. Após isso, por prioridade (maior prioridade primeiro: 3 -> 2 -> 1 -> 0)
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }

  // 4. Desempate por horário exato no mesmo dia (se ambos tiverem data e horários diferentes)
  if (a.dueDate !== null && b.dueDate !== null && a.dueDate !== b.dueDate) {
    return a.dueDate - b.dueDate;
  }

  // 5. Ordem manual / criação
  return a.sortOrder - b.sortOrder;
}

/**
 * Ordenação do histórico de tarefas concluídas:
 * - Agrupamento por dia de conclusão mais recente (dias mais recentes primeiro)
 * - No mesmo dia de conclusão, maior prioridade primeiro
 * - Desempate pelo horário exato de conclusão
 */
export function compareCompletedTasks(a: UITask, b: UITask): number {
  const timeA = a.completedAt ?? a.updatedAt;
  const timeB = b.completedAt ?? b.updatedAt;
  const dayA = getStartOfDay(timeA);
  const dayB = getStartOfDay(timeB);

  if (dayA !== dayB) {
    return dayB - dayA; // Dias mais recentes primeiro
  }

  if (a.priority !== b.priority) {
    return b.priority - a.priority; // Maior prioridade primeiro
  }

  return timeB - timeA;
}
