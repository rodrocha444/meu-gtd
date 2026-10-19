import type { RecurrenceMode, TaskPriority, TaskStatus } from '../db/schema';

export interface UIList {
  id: string;
  name: string;
  color: string;
  icon: string;
  isGtdSystem: boolean;
  sortOrder: number;
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
  listId: string;
  parentTaskId: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type SmartViewId =
  | 'inbox'
  | 'today'
  | 'next_7_days'
  | 'calendar'
  | 'next_actions'
  | 'waiting_for'
  | 'someday'
  | 'projects'
  | 'completed'
  | string;
