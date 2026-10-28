import type { TaskPriority, TaskStatus, RecurrenceMode } from './schema';
import type { TaskRecordUI, ListRecordUI } from './client';
import type { UINote, UINoteFolder } from '../types/note';

export const SYNC_QUEUE_STORAGE_KEY = 'meu_gtd_sync_outbox';

export type TaskMutationPayload = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  isPinned?: boolean;
  dueDate?: number | null;
  recurrenceRule?: string | null;
  recurrenceMode?: RecurrenceMode;
  reminders?: import('../types/task').TaskReminder[];
  listId?: string;
  parentTaskId?: string | null;
  sortOrder?: number;
  completedAt?: number | null;
  deletedAt?: number | null;
  updatedAt?: number;
};

export type NoteMutationPayload = {
  title?: string;
  content?: string;
  folderId?: string | null;
  isPinned?: boolean;
  color?: string | null;
  sortOrder?: number;
  deletedAt?: number | null;
  updatedAt?: number;
};

export type NoteFolderMutationPayload = {
  name?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  sortOrder?: number;
  updatedAt?: number;
};

export type SyncMutation =
  | {
      id: string;
      type: 'CREATE_TASK';
      task: TaskRecordUI;
      createdAt: number;
    }
  | {
      id: string;
      type: 'UPDATE_TASK';
      taskId: string;
      updates: TaskMutationPayload;
      updatedAt: number;
    }
  | {
      id: string;
      type: 'DELETE_TASK';
      taskId: string;
      deletedAt: number;
    }
  | {
      id: string;
      type: 'CREATE_LIST';
      list: ListRecordUI;
      createdAt: number;
    }
  | {
      id: string;
      type: 'DELETE_LIST';
      listId: string;
      deletedAt: number;
    }
  | {
      id: string;
      type: 'CREATE_NOTE';
      note: UINote;
      createdAt: number;
    }
  | {
      id: string;
      type: 'UPDATE_NOTE';
      noteId: string;
      updates: NoteMutationPayload;
      updatedAt: number;
    }
  | {
      id: string;
      type: 'DELETE_NOTE';
      noteId: string;
      deletedAt: number;
    }
  | {
      id: string;
      type: 'CREATE_NOTE_FOLDER';
      folder: UINoteFolder;
      createdAt: number;
    }
  | {
      id: string;
      type: 'UPDATE_NOTE_FOLDER';
      folderId: string;
      updates: NoteFolderMutationPayload;
      updatedAt: number;
    }
  | {
      id: string;
      type: 'DELETE_NOTE_FOLDER';
      folderId: string;
      deletedAt: number;
    };

const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    try {
      return (globalThis as any).localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }
  return memoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  memoryStorage.set(key, value);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota excedida ou navegação anônima restrita
    }
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    try {
      (globalThis as any).localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

/**
 * Carrega todas as mutações pendentes salvas no storage local
 */
export function getPendingMutations(): SyncMutation[] {
  try {
    const raw = getStorageItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler fila de sincronização offline:', err);
    return [];
  }
}

/**
 * Salva a lista de mutações no storage local
 */
function persistQueue(queue: SyncMutation[]): void {
  try {
    setStorageItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    // Dispara evento customizado se estiver no browser
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('meu_gtd_sync_queue_change', {
          detail: { pendingCount: queue.length },
        })
      );
    }
  } catch (err) {
    console.error('Erro ao persistir fila de sincronização offline:', err);
  }
}

/**
 * Enfileira uma nova mutação para envio posterior à nuvem
 */
export function enqueueMutation(
  mutationData:
    | { type: 'CREATE_TASK'; task: TaskRecordUI; createdAt?: number }
    | {
        type: 'UPDATE_TASK';
        taskId: string;
        updates: TaskMutationPayload;
        updatedAt?: number;
      }
    | { type: 'DELETE_TASK'; taskId: string; deletedAt?: number }
    | { type: 'CREATE_LIST'; list: ListRecordUI; createdAt?: number }
    | { type: 'DELETE_LIST'; listId: string; deletedAt?: number }
    | { type: 'CREATE_NOTE'; note: UINote; createdAt?: number }
    | {
        type: 'UPDATE_NOTE';
        noteId: string;
        updates: NoteMutationPayload;
        updatedAt?: number;
      }
    | { type: 'DELETE_NOTE'; noteId: string; deletedAt?: number }
    | { type: 'CREATE_NOTE_FOLDER'; folder: UINoteFolder; createdAt?: number }
    | {
        type: 'UPDATE_NOTE_FOLDER';
        folderId: string;
        updates: NoteFolderMutationPayload;
        updatedAt?: number;
      }
    | { type: 'DELETE_NOTE_FOLDER'; folderId: string; deletedAt?: number }
): SyncMutation {
  const queue = getPendingMutations();
  const now = Date.now();
  const id = `mut-${now}-${Math.random().toString(36).slice(2, 7)}`;

  let newMutation: SyncMutation;

  if (mutationData.type === 'CREATE_TASK') {
    newMutation = {
      id,
      type: 'CREATE_TASK',
      task: mutationData.task,
      createdAt: mutationData.createdAt ?? now,
    };
  } else if (mutationData.type === 'UPDATE_TASK') {
    newMutation = {
      id,
      type: 'UPDATE_TASK',
      taskId: mutationData.taskId,
      updates: mutationData.updates,
      updatedAt: mutationData.updatedAt ?? now,
    };
  } else if (mutationData.type === 'DELETE_TASK') {
    newMutation = {
      id,
      type: 'DELETE_TASK',
      taskId: mutationData.taskId,
      deletedAt: mutationData.deletedAt ?? now,
    };
  } else if (mutationData.type === 'CREATE_LIST') {
    newMutation = {
      id,
      type: 'CREATE_LIST',
      list: mutationData.list,
      createdAt: mutationData.createdAt ?? now,
    };
  } else if (mutationData.type === 'DELETE_LIST') {
    newMutation = {
      id,
      type: 'DELETE_LIST',
      listId: mutationData.listId,
      deletedAt: mutationData.deletedAt ?? now,
    };
  } else if (mutationData.type === 'CREATE_NOTE') {
    newMutation = {
      id,
      type: 'CREATE_NOTE',
      note: mutationData.note,
      createdAt: mutationData.createdAt ?? now,
    };
  } else if (mutationData.type === 'UPDATE_NOTE') {
    newMutation = {
      id,
      type: 'UPDATE_NOTE',
      noteId: mutationData.noteId,
      updates: mutationData.updates,
      updatedAt: mutationData.updatedAt ?? now,
    };
  } else if (mutationData.type === 'DELETE_NOTE') {
    newMutation = {
      id,
      type: 'DELETE_NOTE',
      noteId: mutationData.noteId,
      deletedAt: mutationData.deletedAt ?? now,
    };
  } else if (mutationData.type === 'CREATE_NOTE_FOLDER') {
    newMutation = {
      id,
      type: 'CREATE_NOTE_FOLDER',
      folder: mutationData.folder,
      createdAt: mutationData.createdAt ?? now,
    };
  } else if (mutationData.type === 'UPDATE_NOTE_FOLDER') {
    newMutation = {
      id,
      type: 'UPDATE_NOTE_FOLDER',
      folderId: mutationData.folderId,
      updates: mutationData.updates,
      updatedAt: mutationData.updatedAt ?? now,
    };
  } else {
    newMutation = {
      id,
      type: 'DELETE_NOTE_FOLDER',
      folderId: mutationData.folderId,
      deletedAt: mutationData.deletedAt ?? now,
    };
  }

  // Otimização: Se a mesma tarefa, projeto, nota ou pasta for deletada, remove mutações anteriores redundantes
  let updatedQueue: SyncMutation[];
  if (newMutation.type === 'DELETE_TASK') {
    const targetTaskId = newMutation.taskId;
    const wasCreatedOffline = queue.some(
      (m) => m.type === 'CREATE_TASK' && m.task.id === targetTaskId
    );
    if (wasCreatedOffline) {
      updatedQueue = queue.filter(
        (m) =>
          !(m.type === 'CREATE_TASK' && m.task.id === targetTaskId) &&
          !(m.type === 'UPDATE_TASK' && m.taskId === targetTaskId)
      );
    } else {
      updatedQueue = queue.filter(
        (m) => !(m.type === 'UPDATE_TASK' && m.taskId === targetTaskId)
      );
      updatedQueue.push(newMutation);
    }
  } else if (newMutation.type === 'DELETE_LIST') {
    const targetListId = newMutation.listId;
    const wasCreatedOffline = queue.some(
      (m) => m.type === 'CREATE_LIST' && m.list.id === targetListId
    );
    if (wasCreatedOffline) {
      updatedQueue = queue.filter(
        (m) =>
          !(m.type === 'CREATE_LIST' && m.list.id === targetListId) &&
          !(m.type === 'CREATE_TASK' && m.task.listId === targetListId) &&
          !(m.type === 'UPDATE_TASK' && m.updates.listId === targetListId)
      );
    } else {
      updatedQueue = queue.filter(
        (m) =>
          !(m.type === 'CREATE_TASK' && m.task.listId === targetListId) &&
          !(m.type === 'UPDATE_TASK' && m.updates.listId === targetListId)
      );
      updatedQueue.push(newMutation);
    }
  } else if (newMutation.type === 'DELETE_NOTE') {
    const targetNoteId = newMutation.noteId;
    const wasCreatedOffline = queue.some(
      (m) => m.type === 'CREATE_NOTE' && m.note.id === targetNoteId
    );
    if (wasCreatedOffline) {
      updatedQueue = queue.filter(
        (m) =>
          !(m.type === 'CREATE_NOTE' && m.note.id === targetNoteId) &&
          !(m.type === 'UPDATE_NOTE' && m.noteId === targetNoteId)
      );
    } else {
      updatedQueue = queue.filter(
        (m) => !(m.type === 'UPDATE_NOTE' && m.noteId === targetNoteId)
      );
      updatedQueue.push(newMutation);
    }
  } else if (newMutation.type === 'DELETE_NOTE_FOLDER') {
    const targetFolderId = newMutation.folderId;
    const wasCreatedOffline = queue.some(
      (m) => m.type === 'CREATE_NOTE_FOLDER' && m.folder.id === targetFolderId
    );
    if (wasCreatedOffline) {
      updatedQueue = queue.filter(
        (m) =>
          !(m.type === 'CREATE_NOTE_FOLDER' && m.folder.id === targetFolderId) &&
          !(m.type === 'UPDATE_NOTE_FOLDER' && m.folderId === targetFolderId)
      );
    } else {
      updatedQueue = queue.filter(
        (m) => !(m.type === 'UPDATE_NOTE_FOLDER' && m.folderId === targetFolderId)
      );
      updatedQueue.push(newMutation);
    }
  } else {
    updatedQueue = [...queue, newMutation];
  }

  persistQueue(updatedQueue);
  return newMutation;
}

/**
 * Remove mutações processadas com sucesso da fila
 */
export function removeMutations(mutationIds: string[]): void {
  if (mutationIds.length === 0) return;
  const set = new Set(mutationIds);
  const queue = getPendingMutations();
  const nextQueue = queue.filter((m) => !set.has(m.id));
  persistQueue(nextQueue);
}

/**
 * Limpa toda a fila de sincronização
 */
export function clearQueue(): void {
  persistQueue([]);
}

/**
 * Retorna o número de mutações pendentes na fila
 */
export function getPendingCount(): number {
  return getPendingMutations().length;
}

/**
 * Retorna os IDs de tarefas marcadas para exclusão que ainda não foram sincronizadas
 */
export function getPendingDeletedTaskIds(): Set<string> {
  const queue = getPendingMutations();
  const set = new Set<string>();
  for (const m of queue) {
    if (m.type === 'DELETE_TASK') {
      set.add(m.taskId);
    }
  }
  return set;
}

/**
 * Retorna os IDs de listas/projetos marcados para exclusão ainda não sincronizados
 */
export function getPendingDeletedListIds(): Set<string> {
  const queue = getPendingMutations();
  const set = new Set<string>();
  for (const m of queue) {
    if (m.type === 'DELETE_LIST') {
      set.add(m.listId);
    }
  }
  return set;
}

/**
 * Aplica todas as mutações pendentes locais sobre uma lista de tarefas,
 * garantindo que a UI nunca perca alterações recentes feitas offline.
 */
export function applyPendingMutationsToTasks(
  baseTasks: TaskRecordUI[]
): TaskRecordUI[] {
  const queue = getPendingMutations();
  if (queue.length === 0) return baseTasks;

  const deletedIds = getPendingDeletedTaskIds();
  const deletedListIds = getPendingDeletedListIds();
  // 1. Remove tarefas deletadas ou pertencentes a projetos deletados
  let tasks = baseTasks.filter(
    (t) => !deletedIds.has(t.id) && !deletedListIds.has(t.listId)
  );

  // 2. Aplica atualizações e criações em ordem
  for (const mut of queue) {
    if (mut.type === 'CREATE_TASK') {
      // Se não existir na lista, adiciona
      const exists = tasks.some((t) => t.id === mut.task.id);
      if (!exists) {
        tasks = [mut.task, ...tasks];
      }
    } else if (mut.type === 'UPDATE_TASK') {
      tasks = tasks.map((t) => {
        if (t.id !== mut.taskId) return t;
        return {
          ...t,
          ...mut.updates,
          updatedAt: Math.max(t.updatedAt, mut.updatedAt),
        };
      });
    }
  }

  return tasks;
}

/**
 * Aplica mutações pendentes sobre uma lista de listas/projetos
 */
export function applyPendingMutationsToLists(
  baseLists: ListRecordUI[]
): ListRecordUI[] {
  const queue = getPendingMutations();
  if (queue.length === 0) return baseLists;

  const deletedIds = getPendingDeletedListIds();
  let lists = baseLists.filter((l) => !deletedIds.has(l.id));

  for (const mut of queue) {
    if (mut.type === 'CREATE_LIST') {
      const exists = lists.some((l) => l.id === mut.list.id);
      if (!exists) {
        lists = [...lists, mut.list];
      }
    }
  }

  return lists;
}

/**
 * Retorna os IDs de notas marcadas para exclusão ainda não sincronizadas
 */
export function getPendingDeletedNoteIds(): Set<string> {
  const queue = getPendingMutations();
  const set = new Set<string>();
  for (const m of queue) {
    if (m.type === 'DELETE_NOTE') {
      set.add(m.noteId);
    }
  }
  return set;
}

/**
 * Retorna os IDs de pastas de notas marcadas para exclusão ainda não sincronizadas
 */
export function getPendingDeletedNoteFolderIds(): Set<string> {
  const queue = getPendingMutations();
  const set = new Set<string>();
  for (const m of queue) {
    if (m.type === 'DELETE_NOTE_FOLDER') {
      set.add(m.folderId);
    }
  }
  return set;
}

/**
 * Aplica todas as mutações pendentes locais sobre uma lista de notas
 */
export function applyPendingMutationsToNotes(baseNotes: UINote[]): UINote[] {
  const queue = getPendingMutations();
  if (queue.length === 0) return baseNotes;

  const deletedIds = getPendingDeletedNoteIds();
  const deletedFolderIds = getPendingDeletedNoteFolderIds();

  // 1. Remove notas deletadas ou desvincula pasta se a pasta foi deletada
  let notes = baseNotes
    .filter((n) => !deletedIds.has(n.id))
    .map((n) => {
      if (n.folderId && deletedFolderIds.has(n.folderId)) {
        return { ...n, folderId: null };
      }
      return n;
    });

  // 2. Aplica atualizações e criações em ordem
  for (const mut of queue) {
    if (mut.type === 'CREATE_NOTE') {
      const exists = notes.some((n) => n.id === mut.note.id);
      if (!exists) {
        notes = [mut.note, ...notes];
      }
    } else if (mut.type === 'UPDATE_NOTE') {
      notes = notes.map((n) => {
        if (n.id !== mut.noteId) return n;
        return {
          ...n,
          ...mut.updates,
          updatedAt: Math.max(n.updatedAt, mut.updatedAt),
        };
      });
    }
  }

  return notes;
}

/**
 * Aplica mutações pendentes sobre uma lista de pastas de notas
 */
export function applyPendingMutationsToNoteFolders(
  baseFolders: UINoteFolder[]
): UINoteFolder[] {
  const queue = getPendingMutations();
  if (queue.length === 0) return baseFolders;

  const deletedFolderIds = getPendingDeletedNoteFolderIds();
  let folders = baseFolders.filter((f) => !deletedFolderIds.has(f.id));

  for (const mut of queue) {
    if (mut.type === 'CREATE_NOTE_FOLDER') {
      const exists = folders.some((f) => f.id === mut.folder.id);
      if (!exists) {
        folders = [...folders, mut.folder];
      }
    } else if (mut.type === 'UPDATE_NOTE_FOLDER') {
      folders = folders.map((f) => {
        if (f.id !== mut.folderId) return f;
        return {
          ...f,
          ...mut.updates,
          updatedAt: Math.max(f.updatedAt, mut.updatedAt),
        };
      });
    }
  }

  return folders;
}
