import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { UITask } from '../types/task';
import { calculateReminderTimestamp } from '../utils/reminder';

/**
 * Gera um identificador numérico de 31 bits positivo para o LocalNotifications
 * a partir do ID da tarefa e do lembrete.
 */
function hashToNotificationId(taskId: string, reminderId: string): number {
  const str = `${taskId}:${reminderId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export const NotificationService = {
  /**
   * Solicita permissões de notificação ao usuário (Mobile e Web)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    } catch (err) {
      console.warn('Falha ao solicitar permissão de notificações:', err);
      return false;
    }
  },

  /**
   * Verifica se as permissões de notificação já foram concedidas
   */
  async checkPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        return status.display === 'granted';
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission === 'granted';
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Agenda todos os lembretes pendentes de uma tarefa no sistema operacional
   */
  async scheduleTaskReminders(task: UITask): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // No ambiente Web puro, mantemos fallback silencioso seguro
      return;
    }

    try {
      // 1. Sempre cancela agendamentos anteriores da tarefa para evitar duplicatas
      await this.cancelTaskReminders(task.id);

      // Se a tarefa estiver concluída ou não tiver data de vencimento ou não tiver lembretes, encerra
      if (
        task.status === 'completed' ||
        task.dueDate === null ||
        !task.reminders ||
        task.reminders.length === 0
      ) {
        return;
      }

      const now = Date.now();
      const notificationsToSchedule = [];

      for (const reminder of task.reminders) {
        const triggerTime = calculateReminderTimestamp(task.dueDate, reminder);
        // Só agenda lembretes futuros
        if (triggerTime > now) {
          const notifId = hashToNotificationId(task.id, reminder.id);
          const bodyText =
            reminder.offsetDays === 0
              ? 'Vence hoje!'
              : reminder.offsetDays === 1
              ? 'Vence amanhã!'
              : `Vence em ${reminder.offsetDays} dias!`;

          notificationsToSchedule.push({
            id: notifId,
            title: task.title,
            body: bodyText,
            schedule: { at: new Date(triggerTime) },
            extra: {
              taskId: task.id,
              reminderId: reminder.id,
            },
          });
        }
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
      }
    } catch (err) {
      console.warn(`Erro ao agendar lembretes para a tarefa ${task.id}:`, err);
    }
  },

  /**
   * Cancela todos os lembretes agendados associados a uma tarefa
   */
  async cancelTaskReminders(taskId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(
        (n) => n.extra?.taskId === taskId
      );

      if (toCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: toCancel.map((n) => ({ id: n.id })),
        });
      }
    } catch (err) {
      console.warn(`Erro ao cancelar lembretes da tarefa ${taskId}:`, err);
    }
  },

  /**
   * Sincroniza todas as tarefas ativas com o agendador nativo de notificações
   */
  async syncAllReminders(tasks: UITask[]): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      for (const t of tasks) {
        if (t.status === 'pending' && t.dueDate !== null && t.reminders?.length) {
          await this.scheduleTaskReminders(t);
        } else {
          await this.cancelTaskReminders(t.id);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar todos os lembretes nativos:', err);
    }
  },
};
