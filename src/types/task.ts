import type { RecurrenceMode, TaskPriority, TaskStatus } from '../db/schema';

export interface UIList {
  id: string;
  name: string;
  color: string;
  icon: string;
  isGtdSystem: boolean;
  sortOrder: number;
  createdAt?: number;
}

export interface TaskReminder {
  id: string;
  offsetDays: number; // 0 = no dia, 1 = 1 dia antes, 15 = 15 dias antes, etc.
  time: string; // "HH:mm", padrão "09:00"
}

export interface UITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  isPinned: boolean;
  dueDate: number | null;
  recurrenceRule: string | null;
  recurrenceMode: RecurrenceMode;
  reminders?: TaskReminder[];
  listId: string;
  parentTaskId: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type SmartViewId =
  | 'inbox'
  | 'today'
  | 'next_days'
  | 'next_7_days'
  | 'calendar'
  | 'next_actions'
  | 'waiting_for'
  | 'someday'
  | 'projects'
  | 'completed'
  | string;
