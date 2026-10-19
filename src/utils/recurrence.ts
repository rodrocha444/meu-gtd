import type { RecurrenceMode, TaskStatus } from '../db/schema';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface ParsedRecurrence {
  freq: RecurrenceFrequency;
  interval: number;
}

const FREQ_LABELS_PT: Record<
  RecurrenceFrequency,
  { singular: string; plural: string; adverb: string }
> = {
  DAILY: { singular: 'dia', plural: 'dias', adverb: 'Diariamente' },
  WEEKLY: { singular: 'semana', plural: 'semanas', adverb: 'Semanalmente' },
  MONTHLY: { singular: 'mês', plural: 'meses', adverb: 'Mensalmente' },
  YEARLY: { singular: 'ano', plural: 'anos', adverb: 'Anualmente' },
};

/**
 * Converte uma string RRule RFC 5545 (ex: "FREQ=YEARLY;INTERVAL=1") em objeto tipado
 */
export function parseRRule(rule: string | null | undefined): ParsedRecurrence | null {
  if (!rule) return null;
  const freqMatch = rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i);
  if (!freqMatch || !freqMatch[1]) return null;

  const freq = freqMatch[1].toUpperCase() as RecurrenceFrequency;
  const intervalMatch = rule.match(/INTERVAL=(\d+)/i);
  const rawInterval = intervalMatch?.[1] ? Number.parseInt(intervalMatch[1], 10) : 1;
  const interval = Number.isFinite(rawInterval) && rawInterval >= 1 ? rawInterval : 1;

  return { freq, interval };
}

/**
 * Gera string RRule RFC 5545 padronizada
 */
export function buildRRule(freq: RecurrenceFrequency, interval = 1): string {
  const safeInterval = Math.max(1, Math.floor(interval));
  return `FREQ=${freq};INTERVAL=${safeInterval}`;
}

/**
 * Formata rótulo legível para UI indicando a frequência e o modo (Data Fixa vs Após Conclusão)
 */
export function formatRecurrenceBadge(
  rule: string | null | undefined,
  mode: RecurrenceMode = 'fixed',
  compact = false
): string | null {
  const parsed = parseRRule(rule);
  if (!parsed) return null;

  const meta = FREQ_LABELS_PT[parsed.freq];
  const baseLabel =
    parsed.interval === 1
      ? meta.adverb
      : `A cada ${parsed.interval} ${meta.plural}`;

  if (compact) {
    return mode === 'after_completion' ? `${baseLabel} • concl.` : baseLabel;
  }

  return mode === 'after_completion'
    ? `${baseLabel} (após concluir)`
    : `${baseLabel} (data fixa)`;
}

/**
 * Normaliza um Date para as 09:00 da manhã no fuso local
 */
export function normalizeToNineAM(date: Date): Date {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Verifica se duas datas caem no mesmo dia civil (Ano, Mês, Dia)
 */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Adiciona N unidades de frequência a uma data preservando o horário de 09:00
 */
export function addRecurrenceStep(
  baseDate: Date,
  freq: RecurrenceFrequency,
  interval: number
): Date {
  const next = normalizeToNineAM(baseDate);
  if (freq === 'DAILY') {
    next.setDate(next.getDate() + interval);
  } else if (freq === 'WEEKLY') {
    next.setDate(next.getDate() + interval * 7);
  } else if (freq === 'MONTHLY') {
    const originalDay = next.getDate();
    next.setMonth(next.getMonth() + interval);
    // Ajuste caso o mês seguinte tenha menos dias (ex: 31 de jan -> 28 de fev)
    if (next.getDate() !== originalDay) {
      next.setDate(0);
    }
  } else if (freq === 'YEARLY') {
    next.setFullYear(next.getFullYear() + interval);
  }
  return next;
}

/**
 * Calcula o próximo `dueDate` quando uma tarefa recorrente é concluída.
 *
 * - Modo `'fixed'` (Recorrência Padrão):
 *   Calcula a partir do `currentDueDate` original (mantendo aniversários/eventos no dia exato).
 * - Modo `'after_completion'` (Por Dia de Conclusão):
 *   Calcula somando o intervalo diretamente sobre o `completedAt` (dia em que foi concluída).
 */
export function calculateNextDueDate(
  currentDueDate: number | null,
  completedAt: number,
  rule: string,
  mode: RecurrenceMode
): number {
  const parsed = parseRRule(rule);
  if (!parsed) {
    return currentDueDate ?? completedAt;
  }

  if (mode === 'after_completion') {
    const completionBase = new Date(completedAt);
    return addRecurrenceStep(completionBase, parsed.freq, parsed.interval).getTime();
  }

  // Modo 'fixed': usa a data agendada original como âncora
  const anchor = new Date(currentDueDate ?? completedAt);
  let nextDate = addRecurrenceStep(anchor, parsed.freq, parsed.interval);

  // Caso a tarefa estivesse muito atrasada, garante avanço até a próxima ocorrência válida
  const todayStart = new Date(completedAt);
  todayStart.setHours(0, 0, 0, 0);
  let safetyCounter = 0;
  while (nextDate.getTime() < todayStart.getTime() && safetyCounter < 120) {
    nextDate = addRecurrenceStep(nextDate, parsed.freq, parsed.interval);
    safetyCounter += 1;
  }

  return nextDate.getTime();
}

/**
 * Determina se uma tarefa ocorre em um dia específico do calendário:
 * - Retorna `{ occurs: true, isProjected: false }` se a `dueDate` da tarefa é nesse dia.
 * - Retorna `{ occurs: true, isProjected: true }` se for uma ocorrência futura projetada
 *   de uma tarefa recorrente pendente com `recurrenceMode === 'fixed'`.
 */
export function getTaskOccurrenceOnDay(
  task: {
    dueDate: number | null;
    recurrenceRule: string | null;
    recurrenceMode: RecurrenceMode;
    status: TaskStatus;
  },
  targetDay: Date
): { occurs: boolean; isProjected: boolean } {
  if (task.dueDate === null) {
    return { occurs: false, isProjected: false };
  }

  const taskDate = new Date(task.dueDate);
  if (isSameCalendarDay(taskDate, targetDay)) {
    return { occurs: true, isProjected: false };
  }

  // Apenas projeta ocorrências futuras para tarefas pendentes com recorrência padrão (data fixa)
  if (
    task.status !== 'pending' ||
    !task.recurrenceRule ||
    task.recurrenceMode !== 'fixed'
  ) {
    return { occurs: false, isProjected: false };
  }

  const targetStart = new Date(targetDay);
  targetStart.setHours(0, 0, 0, 0);
  const taskStart = new Date(taskDate);
  taskStart.setHours(0, 0, 0, 0);

  if (targetStart.getTime() <= taskStart.getTime()) {
    return { occurs: false, isProjected: false };
  }

  const parsed = parseRRule(task.recurrenceRule);
  if (!parsed) {
    return { occurs: false, isProjected: false };
  }

  const diffDays = Math.round(
    (targetStart.getTime() - taskStart.getTime()) / 86_400_000
  );

  if (parsed.freq === 'DAILY') {
    if (diffDays > 0 && diffDays % parsed.interval === 0) {
      return { occurs: true, isProjected: true };
    }
    return { occurs: false, isProjected: false };
  }

  if (parsed.freq === 'WEEKLY') {
    if (diffDays > 0 && diffDays % (parsed.interval * 7) === 0) {
      return { occurs: true, isProjected: true };
    }
    return { occurs: false, isProjected: false };
  }

  if (parsed.freq === 'MONTHLY') {
    const monthsDiff =
      (targetStart.getFullYear() - taskStart.getFullYear()) * 12 +
      (targetStart.getMonth() - taskStart.getMonth());
    if (
      monthsDiff > 0 &&
      monthsDiff % parsed.interval === 0 &&
      targetStart.getDate() === taskStart.getDate()
    ) {
      return { occurs: true, isProjected: true };
    }
    return { occurs: false, isProjected: false };
  }

  if (parsed.freq === 'YEARLY') {
    const yearsDiff = targetStart.getFullYear() - taskStart.getFullYear();
    if (
      yearsDiff > 0 &&
      yearsDiff % parsed.interval === 0 &&
      targetStart.getMonth() === taskStart.getMonth() &&
      targetStart.getDate() === taskStart.getDate()
    ) {
      return { occurs: true, isProjected: true };
    }
  }

  return { occurs: false, isProjected: false };
}
