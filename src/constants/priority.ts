import type { TaskPriority } from '../db/schema';

export const PRIORITY_META: Record<
  TaskPriority,
  {
    label: string;
    checkboxBorder: string;
    checkboxBgActive: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  3: {
    label: 'Alta',
    checkboxBorder: 'border-red-500 hover:bg-red-500/15',
    checkboxBgActive: 'bg-red-500 border-red-500 text-white',
    badgeClass: 'text-red-400 bg-red-500/10 border-red-500/30',
    dotClass: 'bg-red-500',
  },
  2: {
    label: 'Média',
    checkboxBorder: 'border-amber-400 hover:bg-amber-400/15',
    checkboxBgActive: 'bg-amber-400 border-amber-400 text-zinc-950',
    badgeClass: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
    dotClass: 'bg-amber-400',
  },
  1: {
    label: 'Baixa',
    checkboxBorder: 'border-blue-500 hover:bg-blue-500/15',
    checkboxBgActive: 'bg-blue-500 border-blue-500 text-white',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    dotClass: 'bg-blue-500',
  },
  0: {
    label: 'Nenhuma',
    checkboxBorder: 'border-zinc-500 hover:bg-zinc-500/15',
    checkboxBgActive: 'bg-zinc-500 border-zinc-500 text-white',
    badgeClass: 'text-zinc-400 bg-zinc-800 border-zinc-700',
    dotClass: 'bg-zinc-500',
  },
};

export function getPriorityMeta(priority: TaskPriority) {
  return (
    PRIORITY_META[priority] ?? {
      label: 'Nenhuma',
      checkboxBorder: 'border-zinc-500 hover:bg-zinc-500/15',
      checkboxBgActive: 'bg-zinc-500 border-zinc-500 text-white',
      badgeClass: 'text-zinc-400 bg-zinc-800 border-zinc-700',
      dotClass: 'bg-zinc-500',
    }
  );
}

import {
  Inbox,
  Calendar,
  CalendarDays,
  Zap,
  Sparkles,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export const SMART_VIEW_ITEMS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-blue-400' },
  { id: 'today', label: 'Hoje', icon: Calendar, color: 'text-emerald-400' },
  { id: 'next_days', label: 'Próximos Dias', icon: CalendarDays, color: 'text-indigo-400' },
  { id: 'next_actions', label: 'Ações Seguintes', icon: Zap, color: 'text-amber-400' },
  { id: 'someday', label: 'Algum Dia', icon: Sparkles, color: 'text-purple-400' },
  { id: 'completed', label: 'Concluídas', icon: CheckCircle2, color: 'text-emerald-400' },
  { id: 'trash', label: 'Lixeira', icon: Trash2, color: 'text-zinc-400' },
];
