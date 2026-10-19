import type { TaskReminder } from '../types/task';

/**
 * Cria uma nova instância de lembrete com valores padrão
 * Horário padrão: 09:00 conforme regra de negócio
 */
export function createDefaultReminder(
  offsetDays: number = 0,
  time: string = '09:00'
): TaskReminder {
  return {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    offsetDays,
    time: time || '09:00',
  };
}

/**
 * Calcula o timestamp (ms) exato em que o lembrete deve tocar
 * a partir da data de vencimento da tarefa (dueDate), subtraindo offsetDays
 * e aplicando a hora/minuto configurada.
 */
export function calculateReminderTimestamp(
  dueDate: number,
  reminder: TaskReminder
): number {
  const d = new Date(dueDate);
  // Subtrai os dias de antecedência
  d.setDate(d.getDate() - reminder.offsetDays);

  // Aplica o horário definido (ex: "09:00" ou "14:30")
  const [rawH, rawM] = (reminder.time || '09:00').split(':');
  const hours = Math.max(0, Math.min(23, Number(rawH) || 9));
  const minutes = Math.max(0, Math.min(59, Number(rawM) || 0));

  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/**
 * Retorna texto formatado para exibição do lembrete (ex: "15 dias antes às 09:00")
 */
export function formatReminderBadgeText(reminder: TaskReminder): string {
  const timeStr = reminder.time || '09:00';
  if (reminder.offsetDays === 0) {
    return `No dia às ${timeStr}`;
  }
  if (reminder.offsetDays === 1) {
    return `1 dia antes às ${timeStr}`;
  }
  if (reminder.offsetDays === 7) {
    return `1 semana antes às ${timeStr}`;
  }
  return `${reminder.offsetDays} dias antes às ${timeStr}`;
}

/**
 * Retorna uma descrição curta da antecedência (ex: "15 dias antes" ou "No dia")
 */
export function formatReminderShortLabel(reminder: TaskReminder): string {
  if (reminder.offsetDays === 0) return 'No dia';
  if (reminder.offsetDays === 1) return '1 dia antes';
  if (reminder.offsetDays === 7) return '1 semana antes';
  return `${reminder.offsetDays} dias antes`;
}
