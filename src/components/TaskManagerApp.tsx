import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { TaskStatus } from '../db/schema';
import {
  getDefaultSystemLists,
  purgeExpiredTrashInDb,
  emptyTrashInDb,
} from '../db/client';
import { performFullSync } from '../db/syncManager';
import {
  enqueueMutation,
  getPendingCount,
  applyPendingMutationsToTasks,
  applyPendingMutationsToLists,
  applyPendingMutationsToNotes,
  applyPendingMutationsToNoteFolders,
} from '../db/syncQueue';
import { NativeBridge } from '../lib/native';
import { NotificationService } from '../lib/notifications';
import { parseQuickCaptureInput } from '../utils/nlpParser';
import { calculateNextDueDate } from '../utils/recurrence';
import {
  compareTasksByDayThenPriority,
  compareCompletedTasks,
} from '../utils/taskSorter';
import { getDefaultNoteFolders, getDefaultNotes } from '../utils/notesDefaults';
import { CalendarView } from './CalendarView';
import type { CustomSelectOption } from './ui/CustomControls';
import {
  DatabaseErrorModal,
  type DatabaseErrorInfo,
  isNetworkOrOfflineError,
} from './ui/DatabaseErrorModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { NewProjectModal } from './ui/NewProjectModal';
import { NewFolderModal } from './ui/NewFolderModal';
import { Sidebar, type AppNavigationMode } from './organisms/Sidebar';
import { MobileDrawer } from './organisms/MobileDrawer';
import { MainHeader } from './organisms/MainHeader';
import { TaskList } from './organisms/TaskList';
import { ProjectsHub } from './organisms/ProjectsHub';
import { NotesView } from './organisms/NotesView';
import { NoteEditorSheet } from './organisms/NoteEditorSheet';
import { TrashView } from './organisms/TrashView';
import { QuickCaptureBar } from './organisms/QuickCaptureBar';
import { TaskDetailSheet } from './organisms/TaskDetailSheet';
import { TriageSheet } from './organisms/TriageSheet';
import { isExpiredTrash } from '../utils/trash';
import type { ProjectStat } from './molecules/ProjectCard';
import type { UIList, UITask, SmartViewId } from '../types/task';
import type { UINote, UINoteFolder } from '../types/note';

export type { UIList, UITask, SmartViewId };

const CACHE_KEYS = {
  LISTS: 'meu_gtd_cached_lists',
  TASKS: 'meu_gtd_cached_tasks',
  NOTE_FOLDERS: 'meu_gtd_cached_note_folders',
  NOTES: 'meu_gtd_cached_notes',
};

function loadCachedLists(): UIList[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.LISTS);
    const parsed = raw ? JSON.parse(raw) : [];
    const filteredParsed = Array.isArray(parsed)
      ? parsed.filter((l: UIList) => l.id !== 'waiting_for')
      : [];
    const base: UIList[] =
      filteredParsed.length > 0
        ? filteredParsed
        : getDefaultSystemLists();
    return applyPendingMutationsToLists(base);
  } catch {
    return getDefaultSystemLists();
  }
}

function loadCachedTasks(): UITask[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.TASKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const base: UITask[] =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : [];
    const applied = applyPendingMutationsToTasks(base as any) as UITask[];
    return applied
      .filter((t) => !isExpiredTrash(t.deletedAt))
      .map((t) => (t.listId === 'waiting_for' ? { ...t, listId: 'inbox' } : t));
  } catch {
    return [];
  }
}

function loadCachedNoteFolders(): UINoteFolder[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.NOTE_FOLDERS);
    const parsed = raw ? JSON.parse(raw) : [];
    const base: UINoteFolder[] =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : getDefaultNoteFolders();
    return applyPendingMutationsToNoteFolders(base);
  } catch {
    return getDefaultNoteFolders();
  }
}

function loadCachedNotes(): UINote[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.NOTES);
    if (!raw) return getDefaultNotes();
    const parsed = JSON.parse(raw);
    const base: UINote[] =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : getDefaultNotes();
    const applied = applyPendingMutationsToNotes(base);
    return applied.filter((n) => !isExpiredTrash(n.deletedAt));
  } catch {
    return getDefaultNotes();
  }
}

function saveCache(lists: UIList[], tasks: UITask[]) {
  try {
    const cleanTasks = tasks.filter((t) => !isExpiredTrash(t.deletedAt));
    localStorage.setItem(CACHE_KEYS.LISTS, JSON.stringify(lists));
    localStorage.setItem(CACHE_KEYS.TASKS, JSON.stringify(cleanTasks));
  } catch {
    // Modo anônimo ou limite de quota atingido
  }
}

function saveNotesCache(folders: UINoteFolder[], notes: UINote[]) {
  try {
    const cleanNotes = notes.filter((n) => !isExpiredTrash(n.deletedAt));
    localStorage.setItem(CACHE_KEYS.NOTE_FOLDERS, JSON.stringify(folders));
    localStorage.setItem(CACHE_KEYS.NOTES, JSON.stringify(cleanNotes));
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
    return getDefaultSystemLists();
  });
  const [tasks, setTasks] = useState<UITask[]>(() => loadCachedTasks());
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingCount());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const raw = localStorage.getItem(CACHE_KEYS.LISTS);
    return !raw;
  });
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

  // Modo de Navegação Principal: Tarefas GTD vs Anotações / Rascunhos
  const [appMode, setAppMode] = useState<AppNavigationMode>('tasks');

  // Controle de Pastas e Anotações
  const [noteFolders, setNoteFolders] = useState<UINoteFolder[]>(() =>
    loadCachedNoteFolders()
  );
  const [notes, setNotes] = useState<UINote[]>(() => loadCachedNotes());
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [selectedNote, setSelectedNote] = useState<UINote | null>(null);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<UINoteFolder | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<UINote | null>(null);

  // Refs de pastas e notas para reconciliação atômica
  const noteFoldersRef = useRef(noteFolders);
  noteFoldersRef.current = noteFolders;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Controle de Projetos GTD e Agrupamento
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<UIList | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<UITask | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<UITask | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isClearCompletedModalOpen, setIsClearCompletedModalOpen] = useState<boolean>(false);
  const [isEmptyTrashModalOpen, setIsEmptyTrashModalOpen] = useState<boolean>(false);

  // Helper para contagem de notas por pasta
  const getNoteCountForFolder = (folderId: string): number => {
    return notes.filter((n) => !n.deletedAt && n.folderId === folderId).length;
  };

  // Helper unificado para contagem de tarefas pendentes ou concluídas por view
  const getTaskCountForView = (viewId: string): number => {
    if (viewId === 'trash') {
      return tasks.filter((t) => Boolean(t.deletedAt) && t.parentTaskId === null).length;
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayTime = endOfToday.getTime();

    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    tenDaysFromNow.setHours(23, 59, 59, 999);
    const tenDaysTime = tenDaysFromNow.getTime();

    return tasks.filter(
      (t) =>
        !t.deletedAt &&
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
      const result = await performFullSync(
        listsRef.current,
        tasksRef.current,
        noteFoldersRef.current,
        notesRef.current
      );
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
        if (result.noteFolders && result.notes) {
          noteFoldersRef.current = result.noteFolders;
          notesRef.current = result.notes;
          setNoteFolders(result.noteFolders);
          setNotes(result.notes);
          saveNotesCache(result.noteFolders, result.notes);
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
    void purgeExpiredTrashInDb();
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
        } else if (isEmptyTrashModalOpen) {
          setIsEmptyTrashModalOpen(false);
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
    isEmptyTrashModalOpen,
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

  // Itens ativos e lixeira filtrados
  const activeTasks = useMemo(() => tasks.filter((t) => !t.deletedAt), [tasks]);
  const trashTasks = useMemo(() => tasks.filter((t) => Boolean(t.deletedAt)), [tasks]);
  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const trashNotes = useMemo(() => notes.filter((n) => Boolean(n.deletedAt)), [notes]);
  const trashNotesCount = useMemo(() => trashNotes.length, [trashNotes]);
  const totalNotesCount = useMemo(() => activeNotes.length, [activeNotes]);

  // Filtra tarefas principais (sem parentTaskId) de acordo com a Smart List GTD ativa
  const filteredRootTasks = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return tasks
      .filter((t) => t.parentTaskId === null && !t.deletedAt)
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
        (t) => !t.deletedAt && t.listId === p.id && t.parentTaskId === null
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

  // --- OPERAÇÕES DE ANOTAÇÕES & PASTAS ---
  const handleCreateNote = (targetFolderId?: string | null) => {
    const now = Date.now();
    const newNote: UINote = {
      id: `note-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      content: '',
      folderId:
        targetFolderId ??
        (activeFolderId !== 'all' && activeFolderId !== 'unfiled'
          ? activeFolderId
          : null),
      isPinned: false,
      color: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    const updatedNotes = [newNote, ...notes];
    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
    saveNotesCache(noteFoldersRef.current, updatedNotes);
    enqueueMutation({
      type: 'CREATE_NOTE',
      note: newNote,
      createdAt: now,
    });
    setPendingCount(getPendingCount());
    setSelectedNote(newNote);
    void triggerSync();
  };

  const handleUpdateNote = (
    noteId: string,
    updates: Partial<Pick<UINote, 'title' | 'content' | 'folderId' | 'isPinned'>>
  ) => {
    const now = Date.now();
    const updatedNotes = notes.map((n) => {
      if (n.id !== noteId) return n;
      return {
        ...n,
        ...updates,
        updatedAt: now,
      };
    });
    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
    saveNotesCache(noteFoldersRef.current, updatedNotes);
    enqueueMutation({
      type: 'UPDATE_NOTE',
      noteId,
      updates: {
        ...updates,
        updatedAt: now,
      },
      updatedAt: now,
    });
    setPendingCount(getPendingCount());
    if (selectedNote && selectedNote.id === noteId) {
      setSelectedNote((prev) =>
        prev ? { ...prev, ...updates, updatedAt: now } : null
      );
    }
    void triggerSync();
  };

  const handleTogglePinNote = (note: UINote) => {
    handleUpdateNote(note.id, { isPinned: !note.isPinned });
  };

  const handleConfirmDeleteNote = () => {
    if (!noteToDelete) return;
    const targetId = noteToDelete.id;
    const now = Date.now();

    if (noteToDelete.deletedAt) {
      // Exclusão definitiva permanente
      const updatedNotes = notes.filter((n) => n.id !== targetId);
      notesRef.current = updatedNotes;
      setNotes(updatedNotes);
      saveNotesCache(noteFoldersRef.current, updatedNotes);
      enqueueMutation({
        type: 'DELETE_NOTE',
        noteId: targetId,
        deletedAt: now,
      });
      setPendingCount(getPendingCount());
      if (selectedNote?.id === targetId) {
        setSelectedNote(null);
      }
      setNoteToDelete(null);
      void NativeBridge.hapticSwipeAction();
      setRecurrenceBanner('Anotação apagada permanentemente');
      void triggerSync();
      return;
    }

    // Mover para a Lixeira
    const updatedNotes = notes.map((n) => {
      if (n.id === targetId) {
        return { ...n, deletedAt: now, updatedAt: now };
      }
      return n;
    });
    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
    saveNotesCache(noteFoldersRef.current, updatedNotes);
    enqueueMutation({
      type: 'UPDATE_NOTE',
      noteId: targetId,
      updates: { deletedAt: now },
      updatedAt: now,
    });
    setPendingCount(getPendingCount());
    if (selectedNote?.id === targetId) {
      setSelectedNote(null);
    }
    setNoteToDelete(null);
    void NativeBridge.hapticSwipeAction();
    setRecurrenceBanner('Anotação enviada para a Lixeira (apagada após 30 dias)');
    void triggerSync();
  };

  const handleRestoreNote = (note: UINote) => {
    const now = Date.now();
    void NativeBridge.hapticMediumImpact();

    const folderExists = note.folderId
      ? noteFolders.some((f) => f.id === note.folderId)
      : true;
    const targetFolderId = folderExists ? note.folderId : null;

    const updatedNotes = notes.map((n) => {
      if (n.id === note.id) {
        return {
          ...n,
          folderId: targetFolderId,
          deletedAt: null,
          updatedAt: now,
        };
      }
      return n;
    });

    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
    saveNotesCache(noteFoldersRef.current, updatedNotes);

    enqueueMutation({
      type: 'UPDATE_NOTE',
      noteId: note.id,
      updates: {
        folderId: targetFolderId,
        deletedAt: null,
      },
      updatedAt: now,
    });

    setRecurrenceBanner('Anotação restaurada com sucesso!');
    void triggerSync();
  };

  const handleMoveNoteToFolder = (noteId: string, folderId: string | null) => {
    handleUpdateNote(noteId, { folderId });
    void NativeBridge.hapticSwipeAction();
  };

  const handleOpenNewFolderModal = (parentId?: string | null) => {
    setNewFolderParentId(
      parentId !== undefined
        ? parentId
        : activeFolderId === 'all'
        ? null
        : activeFolderId
    );
    setIsNewFolderModalOpen(true);
  };

  const handleCreateFolder = (
    name: string,
    color: string,
    parentId?: string | null
  ) => {
    const targetParentId = parentId !== undefined ? parentId : newFolderParentId;
    const now = Date.now();
    const newFolder: UINoteFolder = {
      id: `folder-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color,
      icon: 'folder',
      parentId: targetParentId ?? null,
      sortOrder: noteFolders.length,
      createdAt: now,
      updatedAt: now,
    };
    const updatedFolders = [...noteFolders, newFolder];
    noteFoldersRef.current = updatedFolders;
    setNoteFolders(updatedFolders);
    saveNotesCache(updatedFolders, notesRef.current);
    enqueueMutation({
      type: 'CREATE_NOTE_FOLDER',
      folder: newFolder,
      createdAt: now,
    });
    setPendingCount(getPendingCount());
    setIsNewFolderModalOpen(false);
    setActiveFolderId(newFolder.id);
    void NativeBridge.hapticSwipeAction();
    void triggerSync();
  };

  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;
    const targetFolderId = folderToDelete.id;
    const fallbackParentId = folderToDelete.parentId ?? null;
    const now = Date.now();
    // Subpastas e anotações voltam para a pasta pai (ou raiz)
    const updatedFolders = noteFolders
      .filter((f) => f.id !== targetFolderId)
      .map((f) =>
        f.parentId === targetFolderId
          ? { ...f, parentId: fallbackParentId, updatedAt: now }
          : f
      );
    const updatedNotes = notes.map((n) =>
      n.folderId === targetFolderId
        ? { ...n, folderId: fallbackParentId, updatedAt: now }
        : n
    );
    noteFoldersRef.current = updatedFolders;
    notesRef.current = updatedNotes;
    setNoteFolders(updatedFolders);
    setNotes(updatedNotes);
    saveNotesCache(updatedFolders, updatedNotes);
    enqueueMutation({
      type: 'DELETE_NOTE_FOLDER',
      folderId: targetFolderId,
      deletedAt: now,
    });
    setPendingCount(getPendingCount());
    if (activeFolderId === targetFolderId) {
      setActiveFolderId(fallbackParentId ?? 'all');
    }
    setFolderToDelete(null);
    void NativeBridge.hapticSwipeAction();
    void triggerSync();
  };

  // Excluir Tarefa GTD (Mover para a Lixeira se ativa; Exclusão permanente se já estiver na lixeira)
  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    const targetId = taskToDelete.id;
    const now = Date.now();

    void NativeBridge.hapticLightImpact();

    if (taskToDelete.deletedAt) {
      // Exclusão definitiva permanente
      const updatedTasks = tasks.filter((t) => t.id !== targetId && t.parentTaskId !== targetId);
      tasksRef.current = updatedTasks;
      setTasks(updatedTasks);
      saveCache(listsRef.current, updatedTasks);

      if (selectedTaskId === targetId) {
        setSelectedTaskId(null);
      }
      setTaskToDelete(null);
      enqueueMutation({ type: 'DELETE_TASK', taskId: targetId });
      setRecurrenceBanner('Tarefa apagada permanentemente');
      void triggerSync();
      return;
    }

    // Mover para a Lixeira (tarefa e suas subtarefas)
    const updatedTasks = tasks.map((t) => {
      if (t.id === targetId || t.parentTaskId === targetId) {
        return { ...t, deletedAt: now, updatedAt: now };
      }
      return t;
    });
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
      const remainingPendingInbox = updatedTasks.filter(
        (t) =>
          !t.deletedAt &&
          t.parentTaskId === null &&
          t.status === 'pending' &&
          t.listId === 'inbox'
      ).length;
      if (remainingPendingInbox === 0) {
        setActiveView('today');
        setRecurrenceBanner('Inbox zerado! Mostrando tarefas de Hoje.');
      }
    }

    setTaskToDelete(null);
    void NotificationService.cancelTaskReminders(targetId);

    enqueueMutation({
      type: 'UPDATE_TASK',
      taskId: targetId,
      updates: { deletedAt: now },
      updatedAt: now,
    });
    const subtasks = tasks.filter((t) => t.parentTaskId === targetId);
    for (const sub of subtasks) {
      enqueueMutation({
        type: 'UPDATE_TASK',
        taskId: sub.id,
        updates: { deletedAt: now },
        updatedAt: now,
      });
    }

    setRecurrenceBanner('Tarefa enviada para a Lixeira (apagada após 30 dias)');
    void triggerSync();
  };

  // Restaurar Tarefa da Lixeira
  const handleRestoreTask = (task: UITask) => {
    const now = Date.now();
    void NativeBridge.hapticMediumImpact();

    const listExists = lists.some((l) => l.id === task.listId);
    const targetListId = listExists ? task.listId : 'inbox';

    const parentExists = task.parentTaskId
      ? tasks.some((t) => t.id === task.parentTaskId && !t.deletedAt)
      : false;
    const targetParentId = parentExists ? task.parentTaskId : null;

    const updatedTasks = tasks.map((t) => {
      if (t.id === task.id) {
        return {
          ...t,
          listId: targetListId,
          parentTaskId: targetParentId,
          deletedAt: null,
          updatedAt: now,
        };
      }
      if (t.parentTaskId === task.id) {
        return {
          ...t,
          deletedAt: null,
          updatedAt: now,
        };
      }
      return t;
    });

    tasksRef.current = updatedTasks;
    setTasks(updatedTasks);
    saveCache(listsRef.current, updatedTasks);

    enqueueMutation({
      type: 'UPDATE_TASK',
      taskId: task.id,
      updates: {
        listId: targetListId,
        parentTaskId: targetParentId,
        deletedAt: null,
      },
      updatedAt: now,
    });

    const subtasks = tasks.filter((t) => t.parentTaskId === task.id);
    for (const sub of subtasks) {
      enqueueMutation({
        type: 'UPDATE_TASK',
        taskId: sub.id,
        updates: { deletedAt: null },
        updatedAt: now,
      });
    }

    if (task.dueDate && task.dueDate > now) {
      void NotificationService.scheduleTaskReminders({
        ...task,
        deletedAt: null,
      });
    }

    setRecurrenceBanner('Tarefa restaurada com sucesso!');
    void triggerSync();
  };

  // Limpar todas as tarefas concluídas do sistema (Mover para a Lixeira)
  const handleConfirmClearCompleted = () => {
    void NativeBridge.hapticLightImpact();
    const now = Date.now();
    const completedTasksList = tasks.filter((t) => t.status === 'completed' && !t.deletedAt);
    const completedIds = new Set(completedTasksList.map((t) => t.id));

    const updatedTasks = tasks.map((t) => {
      if (completedIds.has(t.id)) {
        return { ...t, deletedAt: now, updatedAt: now };
      }
      return t;
    });

    tasksRef.current = updatedTasks;
    setTasks(updatedTasks);
    saveCache(listsRef.current, updatedTasks);

    if (selectedTask && selectedTask.status === 'completed') {
      setSelectedTaskId(null);
    }
    setIsClearCompletedModalOpen(false);

    for (const t of completedTasksList) {
      enqueueMutation({
        type: 'UPDATE_TASK',
        taskId: t.id,
        updates: { deletedAt: now },
        updatedAt: now,
      });
    }

    setRecurrenceBanner('Tarefas concluídas enviadas para a Lixeira');
    void triggerSync();
  };

  // Esvaziar Lixeira completamente (Tarefas e Anotações)
  const handleConfirmEmptyTrash = () => {
    void NativeBridge.hapticLightImpact();
    const now = Date.now();

    const tasksToDeleteIds = tasks.filter((t) => t.deletedAt != null).map((t) => t.id);
    const notesToDeleteIds = notes.filter((n) => n.deletedAt != null).map((n) => n.id);

    const updatedTasks = tasks.filter((t) => t.deletedAt == null);
    const updatedNotes = notes.filter((n) => n.deletedAt == null);

    tasksRef.current = updatedTasks;
    setTasks(updatedTasks);
    saveCache(listsRef.current, updatedTasks);

    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
    saveNotesCache(noteFoldersRef.current, updatedNotes);

    for (const taskId of tasksToDeleteIds) {
      enqueueMutation({ type: 'DELETE_TASK', taskId, deletedAt: now });
    }
    for (const noteId of notesToDeleteIds) {
      enqueueMutation({ type: 'DELETE_NOTE', noteId, deletedAt: now });
    }

    setIsEmptyTrashModalOpen(false);
    setRecurrenceBanner('Lixeira esvaziada com sucesso!');
    void emptyTrashInDb('all');
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

  const currentFolder = useMemo(() => {
    if (activeFolderId === 'all') return null;
    return noteFolders.find((f) => f.id === activeFolderId) ?? null;
  }, [noteFolders, activeFolderId]);

  const activeViewTitle = useMemo(() => {
    if (activeView === 'trash') return 'Lixeira';
    if (appMode === 'notes') {
      if (activeFolderId === 'all') return 'Todas as Anotações';
      return currentFolder?.name ?? 'Anotações';
    }
    if (activeView === 'today') return 'Hoje';
    if (activeView === 'next_days' || activeView === 'next_7_days') return 'Próximos Dias';
    if (activeView === 'calendar') return 'Calendário & Eventos';
    if (activeView === 'projects') return 'Lista de Projetos GTD';
    if (activeView === 'completed') return 'Concluídas';
    return listMap[activeView]?.name ?? 'Inbox';
  }, [appMode, activeFolderId, currentFolder, activeView, listMap]);

  const currentCustomProject = useMemo(
    () => lists.find((l) => !l.isGtdSystem && l.id === activeView) ?? null,
    [lists, activeView]
  );

  const isShowingCalendar =
    (activeView === 'calendar' || viewLayout === 'calendar') &&
    activeView !== 'projects' &&
    activeView !== 'completed' &&
    activeView !== 'trash';

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 select-none"
    >
      {/* Sidebar Retrátil Desktop */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        appMode={appMode}
        onToggleMode={setAppMode}
        activeView={activeView}
        onSelectView={handleSelectView}
        lists={lists}
        noteFolders={noteFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={(fId) => {
          setActiveFolderId(fId);
          if (activeView === 'trash') {
            setActiveView('inbox');
          }
        }}
        onCreateFolder={() => handleOpenNewFolderModal()}
        onDeleteFolder={(f) => setFolderToDelete(f)}
        getNoteCountForFolder={getNoteCountForFolder}
        totalNotesCount={totalNotesCount}
        trashNotesCount={trashNotesCount}
        onMoveNoteToFolder={handleMoveNoteToFolder}
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
        appMode={appMode}
        onToggleMode={setAppMode}
        activeView={activeView}
        onSelectView={handleSelectView}
        lists={lists}
        noteFolders={noteFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={(fId) => {
          setActiveFolderId(fId);
          if (activeView === 'trash') {
            setActiveView('inbox');
          }
        }}
        onCreateFolder={() => handleOpenNewFolderModal()}
        onDeleteFolder={(f) => setFolderToDelete(f)}
        getNoteCountForFolder={getNoteCountForFolder}
        totalNotesCount={totalNotesCount}
        trashNotesCount={trashNotesCount}
        onMoveNoteToFolder={handleMoveNoteToFolder}
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
          appMode={appMode}
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
          currentFolder={currentFolder}
          onDeleteFolder={() => currentFolder && setFolderToDelete(currentFolder)}
          trashCount={trashTasks.length + trashNotes.length}
          onEmptyTrash={() => setIsEmptyTrashModalOpen(true)}
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
          ) : activeView === 'trash' ? (
            <TrashView
              tasks={trashTasks}
              notes={trashNotes}
              lists={lists}
              folders={noteFolders}
              defaultTab={appMode === 'notes' ? 'notes' : 'tasks'}
              onRestoreTask={handleRestoreTask}
              onRestoreNote={handleRestoreNote}
              onDeletePermanentlyTask={(t) => setTaskToDelete(t)}
              onDeletePermanentlyNote={(n) => setNoteToDelete(n)}
              onEmptyTrash={() => setIsEmptyTrashModalOpen(true)}
            />
          ) : appMode === 'notes' ? (
            <NotesView
              notes={activeNotes}
              folders={noteFolders}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              onSelectNote={(n) => setSelectedNote(n)}
              onCreateNote={handleCreateNote}
              onTogglePin={handleTogglePinNote}
              onDeleteNote={(n) => setNoteToDelete(n)}
              onCreateFolder={handleOpenNewFolderModal}
              onDeleteFolder={(f) => setFolderToDelete(f)}
              onMoveNoteToFolder={handleMoveNoteToFolder}
            />
          ) : isShowingCalendar ? (
            <CalendarView
              tasks={activeTasks}
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
              allTasks={activeTasks}
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

        {/* Barra de Captura Rápida (Quick Capture - apenas no modo Tarefas e fora da Lixeira) */}
        {appMode === 'tasks' && activeView !== 'trash' && (
          <QuickCaptureBar
            value={quickInput}
            onChange={setQuickInput}
            onSubmit={handleQuickAddSubmit}
            activeView={activeView}
          />
        )}
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

      {/* Drawer / Sheet de Leitura e Edição da Anotação */}
      <NoteEditorSheet
        note={selectedNote}
        isOpen={Boolean(selectedNote)}
        folders={noteFolders}
        onClose={() => setSelectedNote(null)}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={(n) => setNoteToDelete(n)}
      />

      {/* Modal de Criação de Pasta de Anotações */}
      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        parentFolder={
          newFolderParentId
            ? noteFolders.find((f) => f.id === newFolderParentId) ?? null
            : null
        }
        onClose={() => setIsNewFolderModalOpen(false)}
        onCreate={handleCreateFolder}
      />

      {/* Modal de Confirmação de Exclusão de Pasta */}
      <ConfirmModal
        isOpen={Boolean(folderToDelete)}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleConfirmDeleteFolder}
        icon={<Trash2 className="w-5 h-5" />}
        title="Excluir Pasta de Anotações?"
        subtitle={folderToDelete?.name}
        description="As anotações e subpastas desta pasta serão preservadas no diretório pai ou raiz."
        confirmLabel="Excluir Pasta"
        confirmClass="bg-red-600 hover:bg-red-500"
      />

      {/* Modal de Confirmação de Exclusão de Anotação */}
      <ConfirmModal
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleConfirmDeleteNote}
        icon={<Trash2 className="w-5 h-5" />}
        title={noteToDelete?.deletedAt ? 'Apagar Definitivamente?' : 'Mover para a Lixeira?'}
        subtitle={noteToDelete?.title || 'Sem título'}
        description={
          noteToDelete?.deletedAt
            ? 'Tem certeza que deseja remover esta anotação permanentemente? Esta ação não pode ser desfeita.'
            : 'A anotação será enviada para a Lixeira e permanecerá salva por 30 dias antes de ser apagada definitivamente.'
        }
        confirmLabel={noteToDelete?.deletedAt ? 'Apagar Definitivamente' : 'Mover para Lixeira'}
        confirmClass="bg-red-600 hover:bg-red-500"
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
        title={taskToDelete?.deletedAt ? 'Apagar Definitivamente?' : 'Mover para a Lixeira?'}
        subtitle={taskToDelete?.title}
        description={(() => {
          if (!taskToDelete) return '';
          if (taskToDelete.deletedAt) {
            return 'Esta tarefa será excluída permanentemente agora. Esta ação não pode ser desfeita.';
          }
          const childCount = tasks.filter(
            (t) => t.parentTaskId === taskToDelete.id && !t.deletedAt
          ).length;
          if (childCount > 0) {
            return `Esta tarefa e suas ${childCount} subtarefa(s) vinculadas serão enviadas para a Lixeira e ficarão guardadas por 30 dias antes de serem apagadas.`;
          }
          if (taskToDelete.recurrenceRule) {
            return 'Esta tarefa recorrente será enviada para a Lixeira e ficará guardada por 30 dias.';
          }
          return 'A tarefa será enviada para a Lixeira e permanecerá salva por 30 dias antes de ser apagada definitivamente.';
        })()}
        confirmLabel={taskToDelete?.deletedAt ? 'Apagar Definitivamente' : 'Mover para Lixeira'}
        confirmClass="bg-red-600 hover:bg-red-500"
      />

      {/* Modal de Confirmação para Esvaziar Lixeira */}
      <ConfirmModal
        isOpen={isEmptyTrashModalOpen}
        onClose={() => setIsEmptyTrashModalOpen(false)}
        onConfirm={handleConfirmEmptyTrash}
        icon={<Trash2 className="w-5 h-5" />}
        title="Esvaziar Lixeira?"
        description="Tem certeza que deseja apagar permanentemente todas as tarefas e anotações da lixeira? Esta operação não pode ser desfeita."
        confirmLabel="Esvaziar Tudo"
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
