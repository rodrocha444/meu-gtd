import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { TaskStatus } from '../db/schema';
import { GTD_SYSTEM_LISTS } from '../db/client';
import { performFullSync } from '../db/syncManager';
import {
  enqueueMutation,
  getPendingCount,
  applyPendingMutationsToTasks,
  applyPendingMutationsToLists,
} from '../db/syncQueue';
import { NativeBridge } from '../lib/native';
import { NotificationService } from '../lib/notifications';
import { parseQuickCaptureInput } from '../utils/nlpParser';
import { calculateNextDueDate } from '../utils/recurrence';
import {
  compareTasksByDayThenPriority,
  compareCompletedTasks,
} from '../utils/taskSorter';
import { CalendarView } from './CalendarView';
import type { CustomSelectOption } from './ui/CustomControls';
import {
  DatabaseErrorModal,
  type DatabaseErrorInfo,
  isNetworkOrOfflineError,
} from './ui/DatabaseErrorModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { NewProjectModal } from './ui/NewProjectModal';
import { Sidebar } from './organisms/Sidebar';
import { MobileDrawer } from './organisms/MobileDrawer';
import { MainHeader } from './organisms/MainHeader';
import { TaskList } from './organisms/TaskList';
import { ProjectsHub } from './organisms/ProjectsHub';
import { QuickCaptureBar } from './organisms/QuickCaptureBar';
import { TaskDetailSheet } from './organisms/TaskDetailSheet';
import { TriageSheet } from './organisms/TriageSheet';
import type { ProjectStat } from './molecules/ProjectCard';
import type { UIList, UITask, SmartViewId } from '../types/task';

export type { UIList, UITask, SmartViewId };

const CACHE_KEYS = {
  LISTS: 'meu_gtd_cached_lists',
  TASKS: 'meu_gtd_cached_tasks',
};

function loadCachedLists(): UIList[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.LISTS);
    const parsed = raw ? JSON.parse(raw) : [];
    const base: UIList[] =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : GTD_SYSTEM_LISTS.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color ?? '#6366f1',
            icon: l.icon ?? 'inbox',
            isGtdSystem: Boolean(l.isGtdSystem),
            sortOrder: l.sortOrder ?? 0,
          }));
    return applyPendingMutationsToLists(base);
  } catch {
    return [];
  }
}

function loadCachedTasks(): UITask[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.TASKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const base: UITask[] = Array.isArray(parsed) ? parsed : [];
    return applyPendingMutationsToTasks(base as any) as UITask[];
  } catch {
    return [];
  }
}

function saveCache(lists: UIList[], tasks: UITask[]) {
  try {
    localStorage.setItem(CACHE_KEYS.LISTS, JSON.stringify(lists));
    localStorage.setItem(CACHE_KEYS.TASKS, JSON.stringify(tasks));
  } catch {
    // Modo anônimo ou limite de quota atingido
  }
}

/**
 * Componente Principal da Aplicação (TickTick Core + Método GTD + Calendário & Repetições)
 * Orquestrador estruturado segundo Atomic Design com arquitetura Offline-First (Local-First)
 */
export const TaskManagerApp: React.FC = () => {
  const [lists, setLists] = useState<UIList[]>(() => {
    const cached = loadCachedLists();
    if (cached.length > 0) return cached;
    return GTD_SYSTEM_LISTS.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color ?? '#6366f1',
      icon: l.icon ?? 'inbox',
      isGtdSystem: Boolean(l.isGtdSystem),
      sortOrder: l.sortOrder ?? 0,
    }));
  });
  const [tasks, setTasks] = useState<UITask[]>(() => loadCachedTasks());
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingCount());
  const [isLoading, setIsLoading] = useState<boolean>(() => loadCachedTasks().length === 0);
  const hasUserSelectedViewRef = useRef(false);
  const [activeView, setActiveView] = useState<SmartViewId>(() => {
    const cached = loadCachedTasks();
    const hasInboxTasks = cached.some(
      (t) => t.parentTaskId === null && t.status === 'pending' && t.listId === 'inbox'
    );
    return hasInboxTasks ? 'inbox' : 'today';
  });
  const [viewLayout, setViewLayout] = useState<'list' | 'calendar'>('list');

  // Refs para dados mais recentes durante sincronização assíncrona
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Navegação explícita com registro de escolha do usuário
  const handleSelectView = (viewId: SmartViewId) => {
    hasUserSelectedViewRef.current = true;
    setActiveView(viewId);
  };

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [triageTask, setTriageTask] = useState<UITask | null>(null);
  const [quickInput, setQuickInput] = useState<string>('');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  });
  const [recurrenceBanner, setRecurrenceBanner] = useState<string | null>(null);
  const [dbError, setDbError] = useState<DatabaseErrorInfo | null>(null);

  // Controle de Projetos GTD e Agrupamento
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<UIList | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<UITask | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<UITask | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isClearCompletedModalOpen, setIsClearCompletedModalOpen] = useState<boolean>(false);

  // Helper unificado para contagem de tarefas pendentes ou concluídas por view
  const getTaskCountForView = (viewId: string): number => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayTime = endOfToday.getTime();

    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    tenDaysFromNow.setHours(23, 59, 59, 999);
    const tenDaysTime = tenDaysFromNow.getTime();

    return tasks.filter(
      (t) =>
        t.parentTaskId === null &&
        (viewId === 'completed'
          ? t.status === 'completed'
          : t.status === 'pending' &&
            (viewId === 'today'
              ? t.dueDate !== null && t.dueDate <= endOfTodayTime
              : viewId === 'next_days' || viewId === 'next_7_days'
              ? t.dueDate !== null && t.dueDate > endOfTodayTime
              : viewId === 'next_actions'
              ? t.listId === 'next_actions' &&
                (t.dueDate === null || t.dueDate <= tenDaysTime)
              : t.listId === viewId))
    ).length;
  };

  // Notificador unificado de erros de persistência (apenas para erros críticos não relacionados a offline)
  const reportDbError = (params: {
    operation: string;
    error: unknown;
    customTitle?: string;
    customMessage?: string;
    onRetry?: () => Promise<void> | void;
  }) => {
    const isNet = isNetworkOrOfflineError(params.error);
    if (isNet) {
      setSyncState('offline');
      return;
    }

    void NativeBridge.hapticError();
    const detailMsg =
      params.error instanceof Error
        ? params.error.message
        : typeof params.error === 'string'
        ? params.error
        : 'Erro inesperado na comunicação com o banco de dados';

    setDbError({
      title: params.customTitle ?? 'Erro no Banco de Dados',
      message:
        params.customMessage ??
        'Ocorreu um erro ao comunicar com o banco de dados. A alteração foi salva localmente.',
      operation: params.operation,
      detail: detailMsg,
      isNetworkError: false,
      onRetry: params.onRetry,
    });
  };

  // Executa sincronização bidirecional em segundo plano (Push Outbox + Pull Remoto com reconciliação LWW)
  const triggerSync = async (isManual = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncState('offline');
      if (isManual) {
        void NativeBridge.hapticLightImpact();
      }
      return;
    }

    setSyncState('syncing');
    try {
      const result = await performFullSync(listsRef.current, tasksRef.current);
      if (result.offline) {
        setSyncState('offline');
        if (isManual) {
          void NativeBridge.hapticLightImpact();
        }
      } else if (result.success) {
        if (result.lists && result.tasks) {
          listsRef.current = result.lists;
          tasksRef.current = result.tasks;
          setLists(result.lists);
          setTasks(result.tasks);
          saveCache(result.lists, result.tasks);

          if (!hasUserSelectedViewRef.current) {
            const hasInboxTasks = result.tasks.some(
              (t) => t.parentTaskId === null && t.status === 'pending' && t.listId === 'inbox'
            );
            setActiveView(hasInboxTasks ? 'inbox' : 'today');
          }
        }
        setSyncState('synced');
        if (isManual) {
          void NativeBridge.hapticSwipeAction();
        }
      }
    } catch (err: unknown) {
      console.warn('Erro ao sincronizar com Turso Cloud:', err);
      setSyncState('offline');
      reportDbError({
        operation: 'Sincronização',
        error: err,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mantém o cache local atualizado após mutações em memória
  useEffect(() => {
    if (lists.length > 0 || tasks.length > 0) {
      saveCache(lists, tasks);
    }
  }, [lists, tasks]);

  // Listener para atualizações na fila de sincronização (outbox)
  useEffect(() => {
    const handleQueueChange = (e: Event) => {
      const custom = e as CustomEvent<{ pendingCount: number }>;
      if (custom.detail && typeof custom.detail.pendingCount === 'number') {
        setPendingCount(custom.detail.pendingCount);
      } else {
        setPendingCount(getPendingCount());
      }
    };
    window.addEventListener('meu_gtd_sync_queue_change', handleQueueChange);
    return () => {
      window.removeEventListener('meu_gtd_sync_queue_change', handleQueueChange);
    };
  }, []);

  // Inicialização Local-First: dados locais já exibidos; sincroniza novidades se online
  useEffect(() => {
    void triggerSync(false);
    void NotificationService.requestPermissions().then((granted) => {
      if (granted && tasksRef.current.length > 0) {
        void NotificationService.syncAllReminders(tasksRef.current);
      }
    });
  }, []);

  // Monitora conectividade online/offline da rede
  useEffect(() => {
    const handleOnline = () => {
      void triggerSync(false);
    };
    const handleOffline = () => {
      setSyncState('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Auto-oculta o banner de confirmação de próxima recorrência
  useEffect(() => {
    if (!recurrenceBanner) return;
    const timer = window.setTimeout(() => setRecurrenceBanner(null), 4000);
    return () => window.clearTimeout(timer);
  }, [recurrenceBanner]);

  // Fecha modais e drawer ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (taskToComplete) {
          setTaskToComplete(null);
        } else if (taskToDelete) {
          setTaskToDelete(null);
        } else if (projectToDelete) {
          setProjectToDelete(null);
        } else if (isClearCompletedModalOpen) {
          setIsClearCompletedModalOpen(false);
        } else if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    taskToComplete,
    taskToDelete,
    projectToDelete,
    isClearCompletedModalOpen,
    isMobileDrawerOpen,
  ]);

  // Opções customizadas para o CustomSelect de Listas
  const listSelectOptions = useMemo<CustomSelectOption<string>[]>(
    () =>
      lists.map((l) => ({
        value: l.id,
        label: l.name,
        dotColor: l.color,
        description: l.isGtdSystem ? 'Lista do sistema GTD' : 'Projeto customizado',
      })),
    [lists]
  );

  // Filtra tarefas principais (sem parentTaskId) de acordo com a Smart List GTD ativa
  const filteredRootTasks = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return tasks
      .filter((t) => t.parentTaskId === null)
      .filter((t) => {
        if (activeView === 'calendar') {
          return true;
        }
        if (activeView === 'projects') {
          return false;
        }
        if (activeView === 'completed') {
          return t.status === 'completed';
        }
        if (activeView === 'today') {
          return (
            (t.dueDate !== null &&
              t.dueDate <= endOfToday.getTime() &&
              t.status === 'pending') ||
            (t.status === 'completed' &&
              t.completedAt !== null &&
              t.completedAt >= startOfToday.getTime() &&
              t.completedAt <= endOfToday.getTime())
          );
        }
        if (activeView === 'next_days' || activeView === 'next_7_days') {
          return (
            t.dueDate !== null &&
            t.dueDate > endOfToday.getTime() &&
            t.status === 'pending'
          );
        }
        return t.listId === activeView;
      })
      .sort((a, b) => {
        if (activeView === 'completed') {
          return compareCompletedTasks(a, b);
        }
        return compareTasksByDayThenPriority(a, b);
      });
  }, [tasks, activeView]);

  // Separa tarefas pendentes, futuras (para a lista especial Ações Seguintes) e concluídas
  const { pendingRootTasks, futureRootTasks, completedRootTasks } = useMemo(() => {
    if (activeView === 'completed') {
      return { pendingRootTasks: [], futureRootTasks: [], completedRootTasks: filteredRootTasks };
    }

    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    tenDaysFromNow.setHours(23, 59, 59, 999);
    const tenDaysTime = tenDaysFromNow.getTime();

    const pending: UITask[] = [];
    const future: UITask[] = [];
    const completed: UITask[] = [];

    for (const t of filteredRootTasks) {
      if (t.status === 'completed') {
        completed.push(t);
      } else if (
        activeView === 'next_actions' &&
        t.dueDate !== null &&
        t.dueDate > tenDaysTime
      ) {
        future.push(t);
      } else {
        pending.push(t);
      }
    }
    return {
      pendingRootTasks: pending,
      futureRootTasks: future,
      completedRootTasks: completed,
    };
  }, [filteredRootTasks, activeView]);

  // Estatísticas de saúde GTD dos Projetos (Weekly Review)
  const projectStats = useMemo<ProjectStat[]>(() => {
    const customProjects = lists.filter((l) => !l.isGtdSystem);
    return customProjects.map((p) => {
      const projTasks = tasks.filter(
        (t) => t.listId === p.id && t.parentTaskId === null
      );
      const completedTasks = projTasks.filter(
        (t) => t.status === 'completed'
      ).length;
      const pendingTasks = projTasks.filter(
        (t) => t.status === 'pending'
      ).length;
      const totalTasks = projTasks.length;
      const createdAt =
        typeof p.createdAt === 'number' && p.createdAt > 0
          ? p.createdAt
          : p.id.startsWith('proj-')
          ? Number(p.id.replace('proj-', '')) || Date.now()
          : Date.now();
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        totalTasks,
        completedTasks,
        pendingTasks,
        createdAt,
      };
    });
  }, [lists, tasks]);

  // Criar Novo Projeto GTD
  const handleCreateProject = (name: string, color: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const now = Date.now();
    const newProj: UIList = {
      id: `proj-${now}`,
      name: cleanName,
      color: color,
      icon: 'folder',
      isGtdSystem: false,
      sortOrder: lists.length + 1,
      createdAt: now,
    };

    setLists((prev) => [...prev, newProj]);
    setIsNewProjectModalOpen(false);
    void NativeBridge.hapticSwipeAction();
    setActiveView(newProj.id);

    enqueueMutation({ type: 'CREATE_LIST', list: newProj, createdAt: now });
    void triggerSync();
  };

  // Excluir Projeto GTD (remoção permanente do projeto e de suas ações vinculadas)
  const handleConfirmDeleteProject = () => {
    if (!projectToDelete || projectToDelete.isGtdSystem) return;
    const targetId = projectToDelete.id;

    void NativeBridge.hapticLightImpact();
    // Exclui todas as tarefas e subtarefas pertencentes a este projeto
    const updatedTasks = tasks.filter(
      (t) => t.listId !== targetId && t.parentTaskId !== targetId
    );
    const updatedLists = lists.filter((l) => l.id !== targetId);

    // Atualiza refs e cache imediatamente para que a sincronização assíncrona não ressuscite os dados
    tasksRef.current = updatedTasks;
    listsRef.current = updatedLists;
    setTasks(updatedTasks);
    setLists(updatedLists);
    saveCache(updatedLists, updatedTasks);

    if (selectedTaskId && tasks.some((t) => t.id === selectedTaskId && t.listId === targetId)) {
      setSelectedTaskId(null);
    }
    if (triageTask && triageTask.listId === targetId) {
      setTriageTask(null);
    }
    if (taskToDelete && taskToDelete.listId === targetId) {
      setTaskToDelete(null);
    }
    if (taskToComplete && taskToComplete.listId === targetId) {
      setTaskToComplete(null);
    }

    if (activeView === targetId) {
      setActiveView('projects');
    }
    setProjectToDelete(null);

    enqueueMutation({ type: 'DELETE_LIST', listId: targetId });
    void triggerSync();
  };

  // Excluir Tarefa GTD
  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    const targetId = taskToDelete.id;

    void NativeBridge.hapticLightImpact();
    const updatedTasks = tasks.filter((t) => t.id !== targetId && t.parentTaskId !== targetId);
    tasksRef.current = updatedTasks;
    setTasks(updatedTasks);
    saveCache(listsRef.current, updatedTasks);

    if (selectedTaskId === targetId) {
      setSelectedTaskId(null);
    }
    if (triageTask?.id === targetId) {
      setTriageTask(null);
    }
    if (taskToComplete?.id === targetId) {
      setTaskToComplete(null);
    }

    if (taskToDelete.listId === 'inbox' && activeView === 'inbox') {
      const remainingPendingInbox = tasks.filter(
        (t) =>
          t.parentTaskId === null &&
          t.status === 'pending' &&
          t.listId === 'inbox' &&
          t.id !== targetId
      ).length;
      if (remainingPendingInbox === 0) {
        setActiveView('today');
        setRecurrenceBanner('Inbox zerado! Mostrando tarefas de Hoje.');
      }
    }

    setTaskToDelete(null);

    void NotificationService.cancelTaskReminders(targetId);
    enqueueMutation({ type: 'DELETE_TASK', taskId: targetId });
    void triggerSync();
  };

  // Limpar todas as tarefas concluídas do sistema
  const handleConfirmClearCompleted = () => {
    void NativeBridge.hapticLightImpact();
    const completedTasksList = tasks.filter((t) => t.status === 'completed');
    const completedIds = completedTasksList.map((t) => t.id);

    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
    if (selectedTask && selectedTask.status === 'completed') {
      setSelectedTaskId(null);
    }
    setIsClearCompletedModalOpen(false);

    for (const id of completedIds) {
      enqueueMutation({ type: 'DELETE_TASK', taskId: id });
    }
    void triggerSync();
  };

  // Excluir Subtarefa individualmente
  const handleDeleteSubtask = (subtaskId: string) => {
    void NativeBridge.hapticLightImpact();
    setTasks((prev) => prev.filter((t) => t.id !== subtaskId));
    enqueueMutation({ type: 'DELETE_TASK', taskId: subtaskId });
    void triggerSync();
  };

  // Promover Tarefa Multi-etapas da Inbox para Projeto GTD
  const handlePromoteTaskToProject = (task: UITask) => {
    const now = Date.now();
    void NativeBridge.hapticTaskComplete();
    const newProjId = `proj-${now}`;
    const newProj: UIList = {
      id: newProjId,
      name: task.title,
      color: '#ec4899',
      icon: 'folder',
      isGtdSystem: false,
      sortOrder: lists.length + 1,
      createdAt: now,
    };

    const subtasks = tasks.filter((t) => t.parentTaskId === task.id);

    setTasks((prev) =>
      prev
        .filter((t) => t.id !== task.id)
        .map((t) =>
          t.parentTaskId === task.id
            ? { ...t, parentTaskId: null, listId: newProjId, updatedAt: now }
            : t
        )
    );

    setLists((prev) => [...prev, newProj]);
    setTriageTask(null);
    setSelectedTaskId(null);
    setActiveView(newProjId);

    enqueueMutation({ type: 'CREATE_LIST', list: newProj, createdAt: now });
    enqueueMutation({ type: 'DELETE_TASK', taskId: task.id, deletedAt: now });
    for (const sub of subtasks) {
      enqueueMutation({
        type: 'UPDATE_TASK',
        taskId: sub.id,
        updates: { parentTaskId: null, listId: newProjId },
        updatedAt: now,
      });
    }
    void triggerSync();
  };

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const selectedTaskSubtasks = useMemo(
    () => (selectedTaskId ? tasks.filter((s) => s.parentTaskId === selectedTaskId) : []),
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

    let resolvedListId =
      activeView === 'today' ||
      activeView === 'next_days' ||
      activeView === 'next_7_days' ||
      activeView === 'calendar' ||
      activeView === 'completed'
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

    // Tarefas criadas sem data explícita nunca recebem vencimento automático, preservando o fluxo GTD
    const defaultDueDate = parsed.dueDate ?? null;

    const now = Date.now();
    const newTask: UITask = {
      id: `task-${now}`,
      title: finalTitle,
      description: '',
      status: 'pending',
      priority: parsed.priority,
      isPinned: false,
      dueDate: defaultDueDate,
      recurrenceRule: parsed.recurrenceRule,
      recurrenceMode: parsed.recurrenceMode,
      reminders: parsed.reminders ?? [],
      listId: resolvedListId,
      parentTaskId: null,
      sortOrder: tasks.length + 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    const nextTasks = [newTask, ...tasksRef.current];
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    saveCache(listsRef.current, nextTasks);
    setQuickInput('');
    void NativeBridge.hapticLightImpact();
    void NotificationService.scheduleTaskReminders(newTask);
    enqueueMutation({ type: 'CREATE_TASK', task: newTask, createdAt: now });
    void triggerSync();
  };

  // Executar a transição de status de fato (Pending / Completed) + Repetições GTD
  const executeToggleStatus = (task: UITask, nextStatus: TaskStatus) => {
    const now = Date.now();

    if (nextStatus === 'completed') {
      void NativeBridge.hapticTaskComplete();
    } else {
      void NativeBridge.hapticLightImpact();
    }

    // Se a tarefa é recorrente e está sendo concluída agora:
    if (
      nextStatus === 'completed' &&
      task.status !== 'completed' &&
      task.recurrenceRule
    ) {
      const nextDueDate = calculateNextDueDate(
        task.dueDate,
        now,
        task.recurrenceRule,
        task.recurrenceMode
      );

      const nextOccurrenceTask: UITask = {
        ...task,
        id: `task-${now}-rec`,
        status: 'pending',
        dueDate: nextDueDate,
        reminders: task.reminders,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      const formattedNextDate = new Date(nextDueDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const modeDescription =
        task.recurrenceMode === 'after_completion'
          ? 'calculada a partir da conclusão de hoje'
          : 'mantendo a data fixa do calendário';

      setRecurrenceBanner(
        `🔁 Próxima ocorrência de "${task.title}" agendada para ${formattedNextDate} (${modeDescription}).`
      );

      void NotificationService.cancelTaskReminders(task.id);
      void NotificationService.scheduleTaskReminders(nextOccurrenceTask);

      const nextTasks = [
        nextOccurrenceTask,
        ...tasksRef.current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: 'completed' as const,
                completedAt: now,
                updatedAt: now,
              }
            : item
        ),
      ];
      tasksRef.current = nextTasks;
      setTasks(nextTasks);
      saveCache(listsRef.current, nextTasks);

      // Enfileira atomicamente a criação da próxima ocorrência e a conclusão da atual
      enqueueMutation({ type: 'CREATE_TASK', task: nextOccurrenceTask, createdAt: now });
      enqueueMutation({
        type: 'UPDATE_TASK',
        taskId: task.id,
        updates: {
          status: 'completed',
          completedAt: now,
        },
        updatedAt: now,
      });
      void triggerSync();
      return;
    }

    const completedAt = nextStatus === 'completed' ? now : null;

    if (nextStatus === 'completed') {
      void NotificationService.cancelTaskReminders(task.id);
    } else {
      void NotificationService.scheduleTaskReminders({ ...task, status: 'pending' });
    }

    const nextTasks = tasksRef.current.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status: nextStatus,
            completedAt,
            updatedAt: now,
          }
        : item
    );
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    saveCache(listsRef.current, nextTasks);

    enqueueMutation({
      type: 'UPDATE_TASK',
      taskId: task.id,
      updates: {
        status: nextStatus,
        completedAt,
      },
      updatedAt: now,
    });
    void triggerSync();

    // Se estava na visualização do Inbox e concluiu a última tarefa pendente do Inbox, redireciona para Hoje
    if (activeView === 'inbox' && nextStatus === 'completed' && task.listId === 'inbox') {
      const remainingPendingInbox = tasks.filter(
        (t) =>
          t.parentTaskId === null &&
          t.status === 'pending' &&
          t.listId === 'inbox' &&
          t.id !== task.id
      ).length;
      if (remainingPendingInbox === 0) {
        setTimeout(() => {
          setActiveView('today');
          setRecurrenceBanner('Inbox zerado! Mostrando tarefas de Hoje.');
        }, 350);
      }
    }
  };

  // Alternar Status com confirmação para conclusão
  const handleToggleStatus = (task: UITask, targetStatus?: TaskStatus) => {
    const nextStatus: TaskStatus =
      targetStatus ?? (task.status === 'completed' ? 'pending' : 'completed');

    if (nextStatus === 'completed' && task.status !== 'completed') {
      void NativeBridge.hapticLightImpact();
      setTaskToComplete(task);
      return;
    }

    executeToggleStatus(task, nextStatus);
  };

  // Confirmar conclusão de tarefa no modal
  const handleConfirmCompleteTask = () => {
    if (!taskToComplete) return;
    const target = taskToComplete;
    setTaskToComplete(null);
    executeToggleStatus(target, 'completed');
  };

  // Atualizar propriedades da tarefa
  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'title'
        | 'description'
        | 'listId'
        | 'priority'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
        | 'reminders'
      >
    >
  ): Promise<void> => {
    const now = Date.now();
    const nextTasks = tasksRef.current.map((item) => {
      if (item.id === taskId) {
        const updated = { ...item, ...updates, updatedAt: now };
        void NotificationService.scheduleTaskReminders(updated);
        return updated;
      }
      return item;
    });
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    saveCache(listsRef.current, nextTasks);

    enqueueMutation({
      type: 'UPDATE_TASK',
      taskId,
      updates,
      updatedAt: now,
    });
    void triggerSync();
  };

  // Aplicar Triagem Rápida da Inbox
  const handleApplyTriage = (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'listId'
        | 'priority'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
        | 'reminders'
      >
    >
  ) => {
    void NativeBridge.hapticSwipeAction();
    handleUpdateTask(taskId, updates);
    setTriageTask((prev) => (prev && prev.id === taskId ? { ...prev, ...updates } : prev));

    // Se moveu a última tarefa pendente da Inbox para outra lista, redireciona para Hoje
    if (
      activeView === 'inbox' &&
      updates.listId &&
      updates.listId !== 'inbox'
    ) {
      const remainingPendingInbox = tasks.filter(
        (t) =>
          t.parentTaskId === null &&
          t.status === 'pending' &&
          t.listId === 'inbox' &&
          t.id !== taskId
      ).length;
      if (remainingPendingInbox === 0) {
        setActiveView('today');
        setRecurrenceBanner('Inbox zerado! Mostrando tarefas de Hoje.');
      }
    }
  };

  // Adicionar Subtarefa
  const handleAddSubtask = (parentTask: UITask, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    const now = Date.now();
    const sub: UITask = {
      id: `sub-${now}`,
      title: clean,
      description: '',
      status: 'pending',
      priority: 0,
      isPinned: false,
      dueDate: null,
      recurrenceRule: null,
      recurrenceMode: 'fixed',
      listId: parentTask.listId,
      parentTaskId: parentTask.id,
      sortOrder: tasks.length + 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    setTasks((prev) => [...prev, sub]);
    void NativeBridge.hapticLightImpact();
    enqueueMutation({ type: 'CREATE_TASK', task: sub, createdAt: now });
    void triggerSync();
  };

  const handleManualSync = async () => {
    await triggerSync(true);
  };

  const activeViewTitle = useMemo(() => {
    if (activeView === 'today') return 'Hoje';
    if (activeView === 'next_days' || activeView === 'next_7_days') return 'Próximos Dias';
    if (activeView === 'calendar') return 'Calendário & Eventos';
    if (activeView === 'projects') return 'Lista de Projetos GTD';
    if (activeView === 'completed') return 'Concluídas';
    return listMap[activeView]?.name ?? 'Inbox';
  }, [activeView, listMap]);

  const currentCustomProject = useMemo(
    () => lists.find((l) => !l.isGtdSystem && l.id === activeView) ?? null,
    [lists, activeView]
  );

  const isShowingCalendar =
    activeView === 'calendar' || viewLayout === 'calendar';

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 select-none"
    >
      {/* Sidebar Retrátil Desktop */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        activeView={activeView}
        onSelectView={handleSelectView}
        lists={lists}
        syncState={syncState}
        pendingCount={pendingCount}
        onSync={() => void handleManualSync()}
        onCreateProject={() => setIsNewProjectModalOpen(true)}
        getTaskCountForView={getTaskCountForView}
      />

      {/* Menu Lateral Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeView={activeView}
        onSelectView={handleSelectView}
        lists={lists}
        syncState={syncState}
        pendingCount={pendingCount}
        onSync={() => void handleManualSync()}
        onCreateProject={() => setIsNewProjectModalOpen(true)}
        getTaskCountForView={getTaskCountForView}
      />

      {/* Área Principal */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Banner de Aviso quando Offline */}
        {syncState === 'offline' && (
          <div
            onClick={() => void handleManualSync()}
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/15 border-b border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="truncate">
                <strong>Modo Offline (Local-First):</strong>{' '}
                {pendingCount > 0
                  ? `${pendingCount} alteração(ões) salva(s) localmente.`
                  : 'Você pode visualizar e concluir tarefas normalmente.'}{' '}
                Sincronização automática assim que reconectar.
              </span>
            </div>
            <span className="text-[11px] font-semibold underline shrink-0 hover:text-amber-200">
              Reconectar
            </span>
          </div>
        )}

        {/* Cabeçalho */}
        <MainHeader
          activeView={activeView}
          activeViewTitle={activeViewTitle}
          isShowingCalendar={isShowingCalendar}
          viewLayout={viewLayout}
          onSetViewLayout={setViewLayout}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          onOpenTriage={() => {
            const firstPending = filteredRootTasks.find((t) => t.status === 'pending');
            if (firstPending) setTriageTask(firstPending);
          }}
          hasInboxTasks={filteredRootTasks.length > 0}
          completedCount={completedRootTasks.length}
          onClearCompleted={() => setIsClearCompletedModalOpen(true)}
          currentCustomProject={currentCustomProject}
          onDeleteCustomProject={() => setProjectToDelete(currentCustomProject)}
        />

        {/* Banner de Confirmação de Recorrência Gerada */}
        {recurrenceBanner && (
          <div className="mx-4 mt-2.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs flex items-center justify-between gap-2">
            <span>{recurrenceBanner}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setRecurrenceBanner(null)}
              className="p-1 rounded-lg hover:bg-indigo-500/20 text-indigo-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Conteúdo Central */}
        <section className="flex-1 min-h-0 native-scroll-container px-4 py-3 pb-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-6">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-xs text-zinc-400">Carregando...</p>
            </div>
          ) : isShowingCalendar ? (
            <CalendarView
              tasks={tasks}
              listMap={listMap}
              selectedTaskId={selectedTaskId}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onToggleStatus={handleToggleStatus}
              onDeleteTask={(t) => setTaskToDelete(t as UITask)}
            />
          ) : activeView === 'projects' ? (
            <ProjectsHub
              projectStats={projectStats}
              onSelectView={handleSelectView}
              onDeleteProject={(p) => {
                const target = lists.find((l) => l.id === p.id);
                if (target) setProjectToDelete(target);
              }}
              onCreateProject={() => setIsNewProjectModalOpen(true)}
            />
          ) : (
            <TaskList
              activeView={activeView}
              pendingTasks={pendingRootTasks}
              futureTasks={futureRootTasks}
              completedTasks={completedRootTasks}
              allTasks={tasks}
              listMap={listMap}
              selectedTaskId={selectedTaskId}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onToggleStatus={handleToggleStatus}
              onDeleteTask={(t) => setTaskToDelete(t)}
              onGoToToday={() => handleSelectView('today')}
              todayCount={getTaskCountForView('today')}
            />
          )}
        </section>

        {/* Barra de Captura Rápida (Quick Capture) */}
        <QuickCaptureBar
          value={quickInput}
          onChange={setQuickInput}
          onSubmit={handleQuickAddSubmit}
          activeView={activeView}
        />
      </main>

      {/* Painel Lateral / Bottom Sheet de Detalhes da Tarefa */}
      <TaskDetailSheet
        selectedTask={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        listMap={listMap}
        listSelectOptions={listSelectOptions}
        subtasks={selectedTaskSubtasks}
        onUpdateTask={handleUpdateTask}
        onToggleStatus={handleToggleStatus}
        onDeleteTask={(t) => setTaskToDelete(t)}
        onAddSubtask={handleAddSubtask}
        onDeleteSubtask={handleDeleteSubtask}
      />

      {/* Bottom Sheet de Triagem Rápida da Inbox */}
      <TriageSheet
        triageTask={triageTask}
        onClose={() => setTriageTask(null)}
        listSelectOptions={listSelectOptions}
        onApplyTriage={handleApplyTriage}
        onPromoteToProject={handlePromoteTaskToProject}
        onDeleteTask={(t) => setTaskToDelete(t)}
        setTriageTask={setTriageTask}
      />

      {/* Modal de Criação de Projeto GTD */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={handleCreateProject}
      />

      {/* Modal de Confirmação de Exclusão de Projeto */}
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDeleteProject}
        icon={<Trash2 className="w-5 h-5" />}
        title="Excluir Projeto GTD?"
        subtitle={projectToDelete?.name}
        description="O projeto e todas as tarefas vinculadas a ele serão excluídos permanentemente."
        confirmLabel="Excluir Projeto"
        confirmClass="bg-red-600 hover:bg-red-500"
      />

      {/* Modal de Confirmação de Conclusão de Tarefa */}
      <ConfirmModal
        isOpen={Boolean(taskToComplete)}
        onClose={() => setTaskToComplete(null)}
        onConfirm={handleConfirmCompleteTask}
        icon={<CheckCircle2 className="w-5 h-5" />}
        iconBgClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        title="Concluir Tarefa?"
        subtitle={taskToComplete?.title}
        description={(() => {
          if (!taskToComplete) return '';
          const pendingSubtasks = tasks.filter(
            (t) => t.parentTaskId === taskToComplete.id && t.status === 'pending'
          ).length;
          if (pendingSubtasks > 0) {
            return `Esta tarefa possui ${pendingSubtasks} subtarefa(s) ainda pendente(s). Deseja marcá-la como concluída mesmo assim?`;
          }
          if (taskToComplete.recurrenceRule) {
            return 'Esta tarefa é recorrente. Ao confirmar a conclusão, a próxima ocorrência será gerada e agendada automaticamente.';
          }
          if (taskToComplete.parentTaskId !== null) {
            return 'Deseja confirmar a conclusão desta subtarefa?';
          }
          return 'Deseja confirmar a conclusão desta tarefa?';
        })()}
        confirmLabel="Concluir"
        confirmClass="bg-emerald-600 hover:bg-emerald-500"
      />

      {/* Modal de Confirmação de Exclusão de Tarefa */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
        icon={<Trash2 className="w-5 h-5" />}
        title="Excluir Tarefa?"
        subtitle={taskToDelete?.title}
        description={(() => {
          if (!taskToDelete) return '';
          const childCount = tasks.filter(
            (t) => t.parentTaskId === taskToDelete.id
          ).length;
          if (childCount > 0) {
            return `Esta tarefa e suas ${childCount} subtarefa(s) vinculadas serão removidas permanentemente.`;
          }
          if (taskToDelete.recurrenceRule) {
            return 'Esta tarefa recorrente e suas configurações de repetição serão removidas permanentemente.';
          }
          return 'Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.';
        })()}
        confirmLabel="Excluir Tarefa"
        confirmClass="bg-red-600 hover:bg-red-500"
      />

      {/* Modal de Confirmação de Limpeza de Concluídas */}
      <ConfirmModal
        isOpen={isClearCompletedModalOpen}
        onClose={() => setIsClearCompletedModalOpen(false)}
        onConfirm={handleConfirmClearCompleted}
        icon={<Trash2 className="w-5 h-5" />}
        title="Limpar Todas as Concluídas?"
        description="Deseja remover permanentemente todas as tarefas finalizadas do histórico? Esta operação não pode ser desfeita."
        confirmLabel="Limpar Tudo"
        confirmClass="bg-red-600 hover:bg-red-500"
      />

      {/* Modal de Erro de Banco de Dados */}
      <DatabaseErrorModal
        error={dbError}
        onClose={() => setDbError(null)}
      />
    </div>
  );
};
