import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox,
  Calendar,
  CalendarDays,
  Zap,
  Clock,
  Sparkles,
  FolderKanban,
  Plus,
  Check,
  X,
  Pin,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRightLeft,
  Tag,
  Flag,
  RefreshCw,
  Ban,
  CornerDownRight,
} from 'lucide-react';
import type { TaskPriority, TaskStatus } from '../db/schema';
import { syncEmbeddedReplica } from '../db/client';
import { NativeBridge } from '../lib/native';
import { parseQuickCaptureInput } from '../utils/nlpParser';

/**
 * Modelo em memória sincronizado com o schema Drizzle ORM (lists, tasks, tags, task_tags)
 */
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
  listId: string;
  parentTaskId: string | null;
  tags: string[]; // ex: ['@computador', '#energia_baixa']
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type SmartViewId =
  | 'inbox'
  | 'today'
  | 'next_7_days'
  | 'next_actions'
  | 'waiting_for'
  | 'someday'
  | string;

/**
 * Configuração visual de cores do Checkbox estilo TickTick por Prioridade
 */
const PRIORITY_META: Record<
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

const INITIAL_LISTS: UIList[] = [
  { id: 'inbox', name: 'Inbox', color: '#3b82f6', icon: 'inbox', isGtdSystem: true, sortOrder: 0 },
  { id: 'next_actions', name: 'Ações Seguintes', color: '#10b981', icon: 'zap', isGtdSystem: true, sortOrder: 1 },
  { id: 'waiting_for', name: 'Aguardando', color: '#f59e0b', icon: 'clock', isGtdSystem: true, sortOrder: 2 },
  { id: 'someday', name: 'Algum Dia', color: '#8b5cf6', icon: 'sparkles', isGtdSystem: true, sortOrder: 3 },
  // Listas de Projetos para Triagem GTD
  { id: 'trabalho', name: 'Trabalho', color: '#ec4899', icon: 'folder', isGtdSystem: false, sortOrder: 4 },
  { id: 'pessoal', name: 'Vida Pessoal', color: '#06b6d4', icon: 'folder', isGtdSystem: false, sortOrder: 5 },
];

const GTD_CONTEXT_SUGGESTIONS = [
  '@computador',
  '@rua',
  '@telefone',
  '@casa',
  '#energia_baixa',
  '#foco_profundo',
];

const nowMs = Date.now();
const today9am = new Date();
today9am.setHours(9, 0, 0, 0);

const INITIAL_TASKS: UITask[] = [
  {
    id: 't-1',
    title: 'Revisar proposta comercial do cliente Enterprise',
    description: 'Verificar cláusulas de SLA e aprovar com o jurídico.',
    status: 'pending',
    priority: 3,
    isPinned: true,
    dueDate: today9am.getTime(),
    recurrenceRule: null,
    listId: 'inbox',
    parentTaskId: null,
    tags: ['@computador', '#foco_profundo'],
    sortOrder: 1,
    createdAt: nowMs - 3600_000,
    updatedAt: nowMs - 3600_000,
    completedAt: null,
  },
  {
    id: 't-2',
    title: 'Passar na lavanderia e comprar café em grãos',
    description: '',
    status: 'pending',
    priority: 1,
    isPinned: false,
    dueDate: today9am.getTime(),
    recurrenceRule: null,
    listId: 'inbox',
    parentTaskId: null,
    tags: ['@rua', '#energia_baixa'],
    sortOrder: 2,
    createdAt: nowMs - 7200_000,
    updatedAt: nowMs - 7200_000,
    completedAt: null,
  },
  {
    id: 't-3',
    title: 'Configurar Embedded Replicas do Turso no app mobile',
    description: 'Validar sincronização offline-first com SQLite local.',
    status: 'pending',
    priority: 2,
    isPinned: false,
    dueDate: today9am.getTime() + 86_400_000 * 2,
    recurrenceRule: null,
    listId: 'next_actions',
    parentTaskId: null,
    tags: ['@computador'],
    sortOrder: 3,
    createdAt: nowMs - 10800_000,
    updatedAt: nowMs - 10800_000,
    completedAt: null,
  },
  {
    id: 't-4',
    title: 'Resposta do fornecedor sobre nota fiscal #409',
    description: 'Cobrar novamente na quinta-feira se não responderem.',
    status: 'pending',
    priority: 2,
    isPinned: false,
    dueDate: today9am.getTime() + 86_400_000 * 3,
    recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1',
    listId: 'waiting_for',
    parentTaskId: null,
    tags: ['@telefone'],
    sortOrder: 4,
    createdAt: nowMs - 14400_000,
    updatedAt: nowMs - 14400_000,
    completedAt: null,
  },
  {
    id: 't-5',
    title: 'Aprender Rust para módulos nativos WebAssembly',
    description: '',
    status: 'pending',
    priority: 0,
    isPinned: false,
    dueDate: null,
    recurrenceRule: null,
    listId: 'someday',
    parentTaskId: null,
    tags: ['#estudo'],
    sortOrder: 5,
    createdAt: nowMs - 20000_000,
    updatedAt: nowMs - 20000_000,
    completedAt: null,
  },
];

/**
 * Item de Tarefa com suporte a Swipe Nativo (Direita = Concluir + Haptics, Esquerda = Triagem/Agendar)
 * e Checkbox TickTick colorido por prioridade + suporte a "Won't Do"
 */
interface SwipeableTaskRowProps {
  task: UITask;
  subtasks: UITask[];
  listName: string;
  isSelected: boolean;
  onSelect: (task: UITask) => void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onOpenTriage: (task: UITask) => void;
}

const SwipeableTaskRow: React.FC<SwipeableTaskRowProps> = ({
  task,
  subtasks,
  listName,
  isSelected,
  onSelect,
  onToggleStatus,
  onOpenTriage,
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef<number | null>(null);
  const thresholdTriggeredRef = useRef(false);

  const SWIPE_THRESHOLD = 76;

  const handleTouchStart = (e: React.TouchEvent) => {
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    startXRef.current = firstTouch.clientX;
    thresholdTriggeredRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    const deltaX = firstTouch.clientX - startXRef.current;
    const clamped = Math.max(-120, Math.min(120, deltaX));
    setDragOffset(clamped);

    if (Math.abs(clamped) >= SWIPE_THRESHOLD && !thresholdTriggeredRef.current) {
      thresholdTriggeredRef.current = true;
      void NativeBridge.hapticLightImpact();
    } else if (
      Math.abs(clamped) < SWIPE_THRESHOLD &&
      thresholdTriggeredRef.current
    ) {
      thresholdTriggeredRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset >= SWIPE_THRESHOLD) {
      // Swipe Direito -> Concluir com Haptics (ImpactStyle.Medium)
      onToggleStatus(task, task.status === 'completed' ? 'pending' : 'completed');
    } else if (dragOffset <= -SWIPE_THRESHOLD) {
      // Swipe Esquerdo -> Agendar data / Mover de lista (Triagem GTD)
      void NativeBridge.hapticSwipeAction();
      onOpenTriage(task);
    }
    setDragOffset(0);
    startXRef.current = null;
  };

  const pMeta = PRIORITY_META[task.priority];
  const isDoneOrWontDo = task.status === 'completed' || task.status === 'wont_do';

  const formattedDate = useMemo(() => {
    if (!task.dueDate) return null;
    const d = new Date(task.dueDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }, [task.dueDate]);

  return (
    <div className="relative overflow-hidden rounded-xl mb-1.5 bg-zinc-900/90 border border-zinc-800/80">
      {/* Camadas de fundo reveladas durante o gesto de Swipe */}
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        {/* Fundo Swipe Direito (Concluir) */}
        <div
          className={`flex items-center gap-2 text-xs font-semibold transition-opacity ${
            dragOffset > 15 ? 'opacity-100 text-emerald-400' : 'opacity-0'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Concluir</span>
        </div>

        {/* Fundo Swipe Esquerdo (Triagem / Agendar / Mover) */}
        <div
          className={`flex items-center gap-2 text-xs font-semibold transition-opacity ${
            dragOffset < -15 ? 'opacity-100 text-amber-400' : 'opacity-0'
          }`}
        >
          <span>Triagem / Mover</span>
          <ArrowRightLeft className="w-4 h-4" />
        </div>
      </div>

      {/* Superfície Deslizante Principal */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onSelect(task)}
        style={{
          transform: `translate3d(${dragOffset}px, 0, 0)`,
          transition: startXRef.current === null ? 'transform 180ms ease-out' : 'none',
        }}
        className={`relative z-10 flex items-start gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-zinc-800/95'
            : 'bg-zinc-900 hover:bg-zinc-800/60 active:bg-zinc-800'
        }`}
      >
        {/* Checkbox Customizado TickTick (Muda de cor por Prioridade + Suporte Won't Do) */}
        <button
          type="button"
          aria-label="Alternar conclusão da tarefa"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(
              task,
              task.status === 'completed' ? 'pending' : 'completed'
            );
          }}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
            task.status === 'completed'
              ? pMeta.checkboxBgActive
              : task.status === 'wont_do'
              ? 'bg-zinc-700 border-zinc-600 text-zinc-300'
              : pMeta.checkboxBorder
          }`}
        >
          {task.status === 'completed' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          {task.status === 'wont_do' && <X className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Conteúdo Central da Tarefa */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {task.isPinned && (
              <Pin className="w-3.5 h-3.5 text-indigo-400 shrink-0 rotate-45" />
            )}
            <span
              className={`text-sm font-medium truncate ${
                isDoneOrWontDo
                  ? 'line-through text-zinc-500'
                  : 'text-zinc-100'
              }`}
            >
              {task.title}
            </span>
            {task.status === 'wont_do' && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-semibold">
                Não farei
              </span>
            )}
          </div>

          {/* Metadados GTD: Contextos (@tag), Lista, Subtarefas e Data */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[11px] text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded">
              {listName}
            </span>

            {task.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                  tag.startsWith('@')
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                }`}
              >
                {tag}
              </span>
            ))}

            {subtasks.length > 0 && (
              <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">
                <CornerDownRight className="w-3 h-3" />
                {subtasks.filter((s) => s.status === 'completed').length}/
                {subtasks.length}
              </span>
            )}

            {formattedDate && (
              <span className="text-[11px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded ml-auto">
                {formattedDate}
              </span>
            )}
          </div>
        </div>

        {/* Botão Rápido de Triagem GTD (Especialmente útil na Inbox) */}
        <button
          type="button"
          title="Triagem Rápida GTD (Lista, @Contexto e Prioridade)"
          onClick={(e) => {
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onOpenTriage(task);
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Componente Principal da Aplicação (TickTick Core + Método GTD)
 */
export const TaskManagerApp: React.FC = () => {
  const [lists] = useState<UIList[]>(INITIAL_LISTS);
  const [tasks, setTasks] = useState<UITask[]>(INITIAL_TASKS);
  const [activeView, setActiveView] = useState<SmartViewId>('inbox');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [triageTask, setTriageTask] = useState<UITask | null>(null);
  const [quickInput, setQuickInput] = useState<string>('');
  const [subtaskInput, setSubtaskInput] = useState<string>('');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>('synced');

  // Inicializa listeners nativos do Capacitor (Teclado + StatusBar Dark)
  useEffect(() => {
    void NativeBridge.syncStatusBarTheme('dark');
    let cleanupKeyboard: (() => void) | undefined;
    void NativeBridge.registerKeyboardListeners().then((fn) => {
      cleanupKeyboard = fn;
    });
    return () => {
      if (cleanupKeyboard) cleanupKeyboard();
    };
  }, []);

  // Preview em tempo real do Parser NLP enquanto o usuário digita no Quick Capture
  const liveParsed = useMemo(
    () => parseQuickCaptureInput(quickInput),
    [quickInput]
  );

  // Filtra tarefas principais (sem parentTaskId) de acordo com a Smart List GTD ativa
  const filteredRootTasks = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfNext7Days = new Date(startOfToday.getTime() + 7 * 86_400_000);

    return tasks
      .filter((t) => t.parentTaskId === null)
      .filter((t) => {
        if (activeView === 'today') {
          return (
            t.dueDate !== null &&
            t.dueDate <= endOfToday.getTime() &&
            t.status === 'pending'
          );
        }
        if (activeView === 'next_7_days') {
          return (
            t.dueDate !== null &&
            t.dueDate >= startOfToday.getTime() &&
            t.dueDate <= endOfNext7Days.getTime()
          );
        }
        return t.listId === activeView;
      })
      .sort((a, b) => {
        // Pinned primeiro -> Pendentes antes de Concluídas -> Maior Prioridade -> Ordem
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if ((a.status === 'pending') !== (b.status === 'pending')) {
          return a.status === 'pending' ? -1 : 1;
        }
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.sortOrder - b.sortOrder;
      });
  }, [tasks, activeView]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const listMap = useMemo(() => {
    const map: Record<string, UIList> = {};
    for (const l of lists) map[l.id] = l;
    return map;
  }, [lists]);

  // Submeter Quick Capture com Parser NLP
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseQuickCaptureInput(quickInput);
    const finalTitle = parsed.cleanTitle || quickInput.trim();
    if (!finalTitle) return;

    // Resolve ~lista informada no NLP ou usa a lista atual (padrão: Inbox)
    let resolvedListId =
      activeView === 'today' || activeView === 'next_7_days'
        ? 'inbox'
        : activeView;

    if (parsed.targetListQuery) {
      const matchedList = lists.find(
        (l) =>
          l.id.toLowerCase() === parsed.targetListQuery ||
          l.name.toLowerCase().includes(parsed.targetListQuery ?? '')
      );
      if (matchedList) {
        resolvedListId = matchedList.id;
      }
    }

    const defaultDueDate =
      parsed.dueDate ?? (activeView === 'today' ? Date.now() : null);

    const newTask: UITask = {
      id: `task-${Date.now()}`,
      title: finalTitle,
      description: '',
      status: 'pending',
      priority: parsed.priority,
      isPinned: false,
      dueDate: defaultDueDate,
      recurrenceRule: null,
      listId: resolvedListId,
      parentTaskId: null,
      tags: parsed.tags,
      sortOrder: tasks.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };

    setTasks((prev) => [newTask, ...prev]);
    setQuickInput('');
    void NativeBridge.hapticLightImpact();
  };

  // Alternar Status (Pending / Completed / Won't Do) com Haptics
  const handleToggleStatus = (task: UITask, targetStatus?: TaskStatus) => {
    const nextStatus: TaskStatus =
      targetStatus ?? (task.status === 'completed' ? 'pending' : 'completed');

    if (nextStatus === 'completed') {
      void NativeBridge.hapticTaskComplete();
    } else {
      void NativeBridge.hapticLightImpact();
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
              completedAt: nextStatus === 'completed' ? Date.now() : null,
              updatedAt: Date.now(),
            }
          : item
      )
    );
  };

  // Mudar Prioridade com Haptics
  const handlePriorityChange = (taskId: string, priority: TaskPriority) => {
    void NativeBridge.hapticLightImpact();
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, priority, updatedAt: Date.now() }
          : item
      )
    );
  };

  // Aplicar Triagem Rápida da Inbox (Mover Lista + Contexto @tag + Prioridade + Data)
  const handleApplyTriage = (
    taskId: string,
    updates: Partial<Pick<UITask, 'listId' | 'priority' | 'tags' | 'dueDate'>>
  ) => {
    void NativeBridge.hapticSwipeAction();
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, ...updates, updatedAt: Date.now() }
          : item
      )
    );
  };

  // Adicionar Subtarefa (parent_task_id self-reference)
  const handleAddSubtask = (parentTask: UITask) => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    const sub: UITask = {
      id: `sub-${Date.now()}`,
      title: clean,
      description: '',
      status: 'pending',
      priority: 0,
      isPinned: false,
      dueDate: null,
      recurrenceRule: null,
      listId: parentTask.listId,
      parentTaskId: parentTask.id,
      tags: [],
      sortOrder: tasks.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };
    setTasks((prev) => [...prev, sub]);
    setSubtaskInput('');
    void NativeBridge.hapticLightImpact();
  };

  const handleManualSync = async () => {
    setSyncState('syncing');
    void NativeBridge.hapticLightImpact();
    const res = await syncEmbeddedReplica();
    setSyncState(res.offline ? 'offline' : 'synced');
  };

  const activeViewTitle = useMemo(() => {
    if (activeView === 'today') return 'Hoje';
    if (activeView === 'next_7_days') return 'Próximos 7 Dias';
    return listMap[activeView]?.name ?? 'Inbox';
  }, [activeView, listMap]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-dvh w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none pt-safe pb-safe pl-safe pr-safe"
    >
      {/* =====================================================================
          SIDEBAR RETRÁTIL (Web / Desktop / Tablet)
         ===================================================================== */}
      <aside
        className={`hidden md:flex flex-col border-r border-zinc-800/80 bg-zinc-900/50 transition-all duration-200 shrink-0 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/80">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <img
                src="/icon.svg"
                alt="GTD Flow"
                className="w-5 h-5 rounded-md shrink-0"
              />
              <span className="font-bold tracking-tight text-sm">
                Meu GTD
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            title="Alternar Sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 native-scroll-container p-2 space-y-1">
          {[
            { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-blue-400' },
            { id: 'today', label: 'Hoje', icon: Calendar, color: 'text-emerald-400' },
            {
              id: 'next_7_days',
              label: 'Próximos 7 Dias',
              icon: CalendarDays,
              color: 'text-indigo-400',
            },
            {
              id: 'next_actions',
              label: 'Ações Seguintes',
              icon: Zap,
              color: 'text-amber-400',
            },
            {
              id: 'waiting_for',
              label: 'Aguardando',
              icon: Clock,
              color: 'text-orange-400',
            },
            {
              id: 'someday',
              label: 'Algum Dia',
              icon: Sparkles,
              color: 'text-purple-400',
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const count = tasks.filter(
              (t) =>
                t.parentTaskId === null &&
                t.status === 'pending' &&
                (item.id === 'today'
                  ? t.dueDate !== null && t.dueDate <= Date.now() + 86_400_000
                  : item.id === 'next_7_days'
                  ? t.dueDate !== null
                  : t.listId === item.id)
            ).length;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  setActiveView(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                {sidebarOpen && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {count > 0 && (
                      <span className="text-[11px] text-zinc-400 font-semibold">
                        {count}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {sidebarOpen && (
            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Projetos GTD
            </div>
          )}

          {lists
            .filter((l) => !l.isGtdSystem)
            .map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  setActiveView(project.id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeView === project.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <FolderKanban
                  className="w-4 h-4 shrink-0"
                  style={{ color: project.color }}
                />
                {sidebarOpen && (
                  <span className="truncate flex-1 text-left">{project.name}</span>
                )}
              </button>
            ))}
        </nav>

        {/* Status do Turso Embedded Replica */}
        <div className="p-3 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => void handleManualSync()}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-400 border border-zinc-800"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                syncState === 'syncing' ? 'animate-spin text-indigo-400' : 'text-emerald-400'
              }`}
            />
            {sidebarOpen && (
              <span>
                Turso Replica: {syncState === 'offline' ? 'Local Offline' : '0ms Sync'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* =====================================================================
          ÁREA PRINCIPAL: SMART LIST HEADER + LISTA DE TAREFAS + QUICK CAPTURE
         ===================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Cabeçalho e Pílulas Horizontais de Smart Lists no Mobile */}
        <header className="px-4 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-100">
                {activeViewTitle}
              </h1>
              <p className="text-[11px] text-zinc-400">
                Swipe direita para concluir • Swipe esquerda para triagem GTD
              </p>
            </div>

            {activeView === 'inbox' && filteredRootTasks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const firstPending = filteredRootTasks.find(
                    (t) => t.status === 'pending'
                  );
                  if (firstPending) setTriageTask(firstPending);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium active:scale-95 transition-transform"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Triar Inbox</span>
              </button>
            )}
          </div>

          {/* Navegação rápida de Smart Lists GTD no Mobile */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'inbox', label: 'Inbox' },
              { id: 'today', label: 'Hoje' },
              { id: 'next_7_days', label: '7 Dias' },
              { id: 'next_actions', label: 'Ações Seguintes' },
              { id: 'waiting_for', label: 'Aguardando' },
              { id: 'someday', label: 'Algum Dia' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  setActiveView(tab.id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeView === tab.id
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Lista de Tarefas com Scroll Isolado (native-scroll-container) */}
        <section className="flex-1 native-scroll-container px-4 py-3 pb-28">
          {filteredRootTasks.length === 0 ? (
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
                <code className="text-zinc-300">~trabalho</code> ou{' '}
                <code className="text-zinc-300">amanhã</code>.
              </p>
            </div>
          ) : (
            filteredRootTasks.map((task) => {
              const subtasks = tasks.filter((s) => s.parentTaskId === task.id);
              const listName = listMap[task.listId]?.name ?? 'Inbox';
              return (
                <SwipeableTaskRow
                  key={task.id}
                  task={task}
                  subtasks={subtasks}
                  listName={listName}
                  isSelected={selectedTaskId === task.id}
                  onSelect={(t) => setSelectedTaskId(t.id)}
                  onToggleStatus={handleToggleStatus}
                  onOpenTriage={(t) => setTriageTask(t)}
                />
              );
            })
          )}
        </section>

        {/* ===================================================================
            BARRA DE QUICK CAPTURE COM PARSER NLP EM TEMPO REAL (Keyboard Aware)
           =================================================================== */}
        <div className="bottom-keyboard-aware sticky bottom-0 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
          {/* Pílulas de Preview dos Metadados Detectados pelo Parser NLP */}
          {quickInput.trim().length > 0 &&
            (liveParsed.priority > 0 ||
              liveParsed.tags.length > 0 ||
              liveParsed.targetListQuery !== null ||
              liveParsed.detectedDateLabel !== null) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
                {liveParsed.priority > 0 && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                      PRIORITY_META[liveParsed.priority].badgeClass
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    Prioridade {PRIORITY_META[liveParsed.priority].label}
                  </span>
                )}
                {liveParsed.targetListQuery && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 font-medium">
                    ~{liveParsed.targetListQuery}
                  </span>
                )}
                {liveParsed.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
                  >
                    {t}
                  </span>
                ))}
                {liveParsed.detectedDateLabel && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                    📅 {liveParsed.detectedDateLabel}
                  </span>
                )}
              </div>
            )}

          <form
            onSubmit={handleQuickAddSubmit}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 focus-within:border-indigo-500 rounded-2xl px-3.5 py-2.5 shadow-2xl"
          >
            <Plus className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder='Adicionar tarefa... ex: "Ligar p/ cliente !alta @telefone ~aguardando amanhã"'
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-all active:scale-95"
            >
              Capturar
            </button>
          </form>
        </div>
      </main>

      {/* =====================================================================
          PAINEL DE DETALHES DA TAREFA:
          - Desktop: Painel Lateral Direito
          - Mobile: Bottom Sheet Deslizante Nativo
         ===================================================================== */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto flex items-end md:items-stretch bg-black/60 md:bg-transparent backdrop-blur-xs md:backdrop-blur-none"
          onClick={() => setSelectedTaskId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-96 max-h-[85dvh] md:max-h-none bg-zinc-900 md:border-l border-t md:border-t-0 border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Alça Nativa do Bottom Sheet no Mobile */}
            <div className="md:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
            </div>

            {/* Header do Detalhe */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">
                  {listMap[selectedTask.listId]?.name ?? 'Inbox'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-xs text-zinc-500">Detalhes GTD</span>
              </div>

              <div className="flex items-center gap-1">
                {/* Botão Won't Do (Não Farei) */}
                <button
                  type="button"
                  title="Marcar como 'Não farei' (Won't Do)"
                  onClick={() =>
                    handleToggleStatus(
                      selectedTask,
                      selectedTask.status === 'wont_do' ? 'pending' : 'wont_do'
                    )
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                    selectedTask.status === 'wont_do'
                      ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                      : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                  }`}
                >
                  <Ban className="w-3 h-3" />
                  <span>Won&apos;t Do</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Corpo do Detalhe */}
            <div className="flex-1 native-scroll-container p-4 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  {selectedTask.title}
                </h2>
                <textarea
                  rows={3}
                  value={selectedTask.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTasks((prev) =>
                      prev.map((item) =>
                        item.id === selectedTask.id
                          ? { ...item, description: val, updatedAt: Date.now() }
                          : item
                      )
                    );
                  }}
                  placeholder="Notas em Markdown, passos da ação ou link de referência..."
                  className="w-full mt-2 bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Seletor de Prioridade com Haptics */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Prioridade (TickTick Color)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(selectedTask.id, p)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                        selectedTask.priority === p
                          ? PRIORITY_META[p].badgeClass
                          : 'border-zinc-800 bg-zinc-950/50 text-zinc-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${PRIORITY_META[p].dotClass}`}
                      />
                      <span>{PRIORITY_META[p].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtarefas / Checklists (parent_task_id) */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Subtarefas / Checklist
                </label>
                <div className="space-y-1.5 mb-2">
                  {tasks
                    .filter((s) => s.parentTaskId === selectedTask.id)
                    .map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleStatus(sub)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 cursor-pointer"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            sub.status === 'completed'
                              ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                              : 'border-zinc-600'
                          }`}
                        >
                          {sub.status === 'completed' && (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            sub.status === 'completed'
                              ? 'line-through text-zinc-500'
                              : 'text-zinc-200'
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask(selectedTask);
                      }
                    }}
                    placeholder="Adicionar passo da subtarefa..."
                    className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSubtask(selectedTask)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
                  >
                    + Passo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BOTTOM SHEET DE TRIAGEM RÁPIDA DA INBOX (Mover Lista + @Contexto + Prioridade)
         ===================================================================== */}
      {triageTask && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-xs"
          onClick={() => setTriageTask(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="md:hidden flex justify-center -mt-2 mb-1">
              <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
            </div>

            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                  Triagem GTD (Clarificar & Organizar)
                </span>
                <h3 className="text-sm font-bold text-zinc-100 mt-0.5">
                  {triageTask.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTriageTask(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Destino GTD / Lista de Projeto */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                1. Mover para Lista / Destino GTD
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      handleApplyTriage(triageTask.id, { listId: l.id });
                      setTriageTask((prev) =>
                        prev ? { ...prev, listId: l.id } : null
                      );
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-left flex items-center gap-2 ${
                      triageTask.listId === l.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate">{l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Contexto GTD (@computador, @rua, #energia_baixa) */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                2. Contexto GTD & Energia (@tag)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GTD_CONTEXT_SUGGESTIONS.map((ctx) => {
                  const active = triageTask.tags.includes(ctx);
                  return (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => {
                        const nextTags = active
                          ? triageTask.tags.filter((t) => t !== ctx)
                          : [...triageTask.tags, ctx];
                        handleApplyTriage(triageTask.id, { tags: nextTags });
                        setTriageTask((prev) =>
                          prev ? { ...prev, tags: nextTags } : null
                        );
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{ctx}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Prioridade */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                3. Definir Prioridade
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      handleApplyTriage(triageTask.id, { priority: p });
                      setTriageTask((prev) =>
                        prev ? { ...prev, priority: p } : null
                      );
                    }}
                    className={`py-1.5 rounded-lg text-xs font-medium border ${
                      triageTask.priority === p
                        ? PRIORITY_META[p].badgeClass
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTriageTask(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              Concluir Triagem
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
