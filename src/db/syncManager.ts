import type { InStatement, InValue } from '@libsql/client';
import {
  libsqlClient,
  fetchListsFromDb,
  fetchTasksFromDb,
  fetchNoteFoldersFromDb,
  fetchNotesFromDb,
  withDatabaseTimeout,
  DB_OPERATION_TIMEOUT_MS,
  type ListRecordUI,
  type TaskRecordUI,
} from './client';
import {
  getPendingMutations,
  removeMutations,
  getPendingDeletedTaskIds,
  getPendingDeletedListIds,
  getPendingDeletedNoteIds,
  getPendingDeletedNoteFolderIds,
  applyPendingMutationsToTasks,
  applyPendingMutationsToLists,
  applyPendingMutationsToNotes,
  applyPendingMutationsToNoteFolders,
  type SyncMutation,
} from './syncQueue';
import type { UITask, UIList } from '../types/task';
import type { UINote, UINoteFolder } from '../types/note';

/**
 * Converte uma mutação em statements SQL para serem executados em batch no Turso
 */
function mutationToStatements(mutation: SyncMutation): InStatement[] {
  const statements: InStatement[] = [];

  switch (mutation.type) {
    case 'CREATE_TASK': {
      const task = mutation.task;
      statements.push({
        sql: `INSERT OR REPLACE INTO tasks (
          id, title, description, status, priority, is_pinned, due_date,
          recurrence_rule, recurrence_mode, reminders, list_id, parent_task_id,
          sort_order, created_at, updated_at, completed_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          task.id,
          task.title,
          task.description ?? '',
          task.status,
          task.priority ?? 0,
          task.isPinned ? 1 : 0,
          task.dueDate !== null ? task.dueDate : null,
          task.recurrenceRule ?? null,
          task.recurrenceMode ?? 'fixed',
          task.reminders && task.reminders.length > 0
            ? JSON.stringify(task.reminders)
            : null,
          task.listId,
          task.parentTaskId ?? null,
          task.sortOrder ?? 0,
          task.createdAt,
          task.updatedAt,
          task.completedAt !== null ? task.completedAt : null,
          task.deletedAt !== null && task.deletedAt !== undefined ? task.deletedAt : null,
        ],
      });
      break;
    }

    case 'UPDATE_TASK': {
      const { taskId, updates, updatedAt } = mutation;
      const setClauses: string[] = ['updated_at = ?'];
      const setArgs: InValue[] = [updatedAt];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        setArgs.push(updates.title);
      }
      if (updates.description !== undefined) {
        setClauses.push('description = ?');
        setArgs.push(updates.description);
      }
      if (updates.status !== undefined) {
        setClauses.push('status = ?');
        setArgs.push(updates.status);
      }
      if (updates.priority !== undefined) {
        setClauses.push('priority = ?');
        setArgs.push(updates.priority);
      }
      if (updates.isPinned !== undefined) {
        setClauses.push('is_pinned = ?');
        setArgs.push(updates.isPinned ? 1 : 0);
      }
      if (updates.dueDate !== undefined) {
        setClauses.push('due_date = ?');
        setArgs.push(updates.dueDate !== null ? updates.dueDate : null);
      }
      if (updates.recurrenceRule !== undefined) {
        setClauses.push('recurrence_rule = ?');
        setArgs.push(updates.recurrenceRule);
      }
      if (updates.recurrenceMode !== undefined) {
        setClauses.push('recurrence_mode = ?');
        setArgs.push(updates.recurrenceMode);
      }
      if (updates.reminders !== undefined) {
        setClauses.push('reminders = ?');
        setArgs.push(
          updates.reminders && updates.reminders.length > 0
            ? JSON.stringify(updates.reminders)
            : null
        );
      }
      if (updates.listId !== undefined) {
        setClauses.push('list_id = ?');
        setArgs.push(updates.listId);
      }
      if (updates.parentTaskId !== undefined) {
        setClauses.push('parent_task_id = ?');
        setArgs.push(updates.parentTaskId);
      }
      if (updates.sortOrder !== undefined) {
        setClauses.push('sort_order = ?');
        setArgs.push(updates.sortOrder);
      }
      if (updates.completedAt !== undefined) {
        setClauses.push('completed_at = ?');
        setArgs.push(updates.completedAt !== null ? updates.completedAt : null);
      }
      if (updates.deletedAt !== undefined) {
        setClauses.push('deleted_at = ?');
        setArgs.push(updates.deletedAt !== null ? updates.deletedAt : null);
      }

      setArgs.push(taskId);
      statements.push({
        sql: `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
        args: setArgs,
      });
      break;
    }

    case 'DELETE_TASK': {
      statements.push(
        { sql: 'DELETE FROM tasks WHERE parent_task_id = ?', args: [mutation.taskId] },
        { sql: 'DELETE FROM tasks WHERE id = ?', args: [mutation.taskId] }
      );
      break;
    }

    case 'CREATE_LIST': {
      const list = mutation.list;
      statements.push({
        sql: `INSERT OR REPLACE INTO lists (id, name, color, icon, is_gtd_system, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          list.id,
          list.name,
          list.color ?? '#6366f1',
          list.icon ?? 'folder',
          list.isGtdSystem ? 1 : 0,
          list.sortOrder ?? 0,
          mutation.createdAt,
        ],
      });
      break;
    }

    case 'DELETE_LIST': {
      statements.push(
        {
          sql: 'DELETE FROM tasks WHERE parent_task_id IN (SELECT id FROM tasks WHERE list_id = ?)',
          args: [mutation.listId],
        },
        {
          sql: 'DELETE FROM tasks WHERE list_id = ?',
          args: [mutation.listId],
        },
        {
          sql: 'DELETE FROM lists WHERE id = ?',
          args: [mutation.listId],
        }
      );
      break;
    }

    case 'CREATE_NOTE': {
      const note = mutation.note;
      statements.push({
        sql: `INSERT OR REPLACE INTO notes (
          id, title, content, folder_id, is_pinned, color, sort_order, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          note.id,
          note.title,
          note.content ?? '',
          note.folderId ?? null,
          note.isPinned ? 1 : 0,
          note.color ?? null,
          note.sortOrder ?? 0,
          note.createdAt,
          note.updatedAt,
          note.deletedAt !== null && note.deletedAt !== undefined ? note.deletedAt : null,
        ],
      });
      break;
    }

    case 'UPDATE_NOTE': {
      const { noteId, updates, updatedAt } = mutation;
      const setClauses: string[] = ['updated_at = ?'];
      const setArgs: InValue[] = [updatedAt];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        setArgs.push(updates.title);
      }
      if (updates.content !== undefined) {
        setClauses.push('content = ?');
        setArgs.push(updates.content);
      }
      if (updates.folderId !== undefined) {
        setClauses.push('folder_id = ?');
        setArgs.push(updates.folderId);
      }
      if (updates.isPinned !== undefined) {
        setClauses.push('is_pinned = ?');
        setArgs.push(updates.isPinned ? 1 : 0);
      }
      if (updates.color !== undefined) {
        setClauses.push('color = ?');
        setArgs.push(updates.color);
      }
      if (updates.sortOrder !== undefined) {
        setClauses.push('sort_order = ?');
        setArgs.push(updates.sortOrder);
      }
      if (updates.deletedAt !== undefined) {
        setClauses.push('deleted_at = ?');
        setArgs.push(updates.deletedAt !== null ? updates.deletedAt : null);
      }

      setArgs.push(noteId);
      statements.push({
        sql: `UPDATE notes SET ${setClauses.join(', ')} WHERE id = ?`,
        args: setArgs,
      });
      break;
    }

    case 'DELETE_NOTE': {
      statements.push({
        sql: 'DELETE FROM notes WHERE id = ?',
        args: [mutation.noteId],
      });
      break;
    }

    case 'CREATE_NOTE_FOLDER': {
      const folder = mutation.folder;
      statements.push({
        sql: `INSERT OR REPLACE INTO note_folders (id, name, color, icon, parent_id, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          folder.id,
          folder.name,
          folder.color ?? '#8b5cf6',
          folder.icon ?? 'folder',
          folder.parentId ?? null,
          folder.sortOrder ?? 0,
          folder.createdAt,
          folder.updatedAt,
        ],
      });
      break;
    }

    case 'UPDATE_NOTE_FOLDER': {
      const { folderId, updates, updatedAt } = mutation;
      const setClauses: string[] = ['updated_at = ?'];
      const setArgs: InValue[] = [updatedAt];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        setArgs.push(updates.name);
      }
      if (updates.color !== undefined) {
        setClauses.push('color = ?');
        setArgs.push(updates.color);
      }
      if (updates.icon !== undefined) {
        setClauses.push('icon = ?');
        setArgs.push(updates.icon);
      }
      if (updates.parentId !== undefined) {
        setClauses.push('parent_id = ?');
        setArgs.push(updates.parentId);
      }
      if (updates.sortOrder !== undefined) {
        setClauses.push('sort_order = ?');
        setArgs.push(updates.sortOrder);
      }

      setArgs.push(folderId);
      statements.push({
        sql: `UPDATE note_folders SET ${setClauses.join(', ')} WHERE id = ?`,
        args: setArgs,
      });
      break;
    }

    case 'DELETE_NOTE_FOLDER': {
      statements.push(
        {
          sql: 'UPDATE notes SET folder_id = NULL WHERE folder_id = ?',
          args: [mutation.folderId],
        },
        {
          sql: 'DELETE FROM note_folders WHERE id = ?',
          args: [mutation.folderId],
        }
      );
      break;
    }
  }

  return statements;
}

/**
 * Envia as mutações locais acumuladas para o Turso Cloud em lote (Push)
 */
export async function pushPendingMutations(): Promise<number> {
  const pending = getPendingMutations();
  if (pending.length === 0) return 0;

  const allStatements: InStatement[] = [];
  for (const mut of pending) {
    allStatements.push(...mutationToStatements(mut));
  }

  if (allStatements.length === 0) {
    removeMutations(pending.map((m) => m.id));
    return 0;
  }

  // Executa o lote atômico no Turso
  await withDatabaseTimeout(
    () => libsqlClient.batch(allStatements, 'write'),
    DB_OPERATION_TIMEOUT_MS,
    'sincronização de alterações pendentes'
  );

  // Se o envio ocorreu sem erros, remove as mutações processadas da fila
  removeMutations(pending.map((m) => m.id));
  return pending.length;
}

/**
 * Reconcilia tarefas baixadas da nuvem com o estado local usando Last-Write-Wins (LWW)
 * e proteção contra ressurreição de itens excluídos offline.
 */
export function reconcileTasksWithLocal(
  remoteTasks: TaskRecordUI[],
  currentLocalTasks: UITask[]
): UITask[] {
  const deletedTaskIds = getPendingDeletedTaskIds();
  const deletedListIds = getPendingDeletedListIds();
  const queue = getPendingMutations();
  const pendingCreatedTaskIds = new Set(
    queue.filter((m) => m.type === 'CREATE_TASK').map((m) => m.task.id)
  );

  const localMap = new Map<string, UITask>();
  for (const t of currentLocalTasks) {
    localMap.set(t.id, t);
  }

  // 1. Processa tarefas da nuvem
  const reconciledTasks: UITask[] = [];
  const processedIds = new Set<string>();

  for (const remote of remoteTasks) {
    // Se a tarefa foi excluída localmente offline ou seu projeto foi excluído, descarta
    if (deletedTaskIds.has(remote.id) || deletedListIds.has(remote.listId)) {
      continue;
    }

    processedIds.add(remote.id);
    const local = localMap.get(remote.id);

    // Se existe localmente, compara updatedAt (Last-Write-Wins)
    if (local && local.updatedAt > remote.updatedAt) {
      // Local foi modificado mais recentemente offline, prevalece
      reconciledTasks.push(local);
    } else {
      // Remoto é mais novo ou igual
      reconciledTasks.push({
        id: remote.id,
        title: remote.title,
        description: remote.description,
        status: remote.status,
        priority: remote.priority,
        isPinned: remote.isPinned,
        dueDate: remote.dueDate,
        recurrenceRule: remote.recurrenceRule,
        recurrenceMode: remote.recurrenceMode,
        reminders: remote.reminders ?? [],
        listId: remote.listId,
        parentTaskId: remote.parentTaskId,
        sortOrder: remote.sortOrder,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        completedAt: remote.completedAt,
        deletedAt: remote.deletedAt ?? null,
      });
    }
  }

  // 2. Apenas tarefas locais criadas offline que ainda não subiram para a nuvem
  for (const local of currentLocalTasks) {
    if (
      !processedIds.has(local.id) &&
      pendingCreatedTaskIds.has(local.id) &&
      !deletedTaskIds.has(local.id) &&
      !deletedListIds.has(local.listId)
    ) {
      processedIds.add(local.id);
      reconciledTasks.push(local);
    }
  }

  // 3. Aplica quaisquer mutações pendentes residuais da fila
  const finalTasks = applyPendingMutationsToTasks(reconciledTasks);
  return finalTasks;
}

/**
 * Reconcilia listas da nuvem com o estado local
 */
export function reconcileListsWithLocal(
  remoteLists: ListRecordUI[],
  currentLocalLists: UIList[]
): UIList[] {
  const deletedListIds = getPendingDeletedListIds();
  const queue = getPendingMutations();
  const pendingCreatedListIds = new Set(
    queue.filter((m) => m.type === 'CREATE_LIST').map((m) => m.list.id)
  );

  const localMap = new Map<string, UIList>();
  for (const l of currentLocalLists) {
    localMap.set(l.id, l);
  }

  const reconciledLists: UIList[] = [];
  const processedIds = new Set<string>();

  for (const remote of remoteLists) {
    if (deletedListIds.has(remote.id)) continue;
    processedIds.add(remote.id);
    reconciledLists.push(remote);
  }

  // Apenas mantém listas locais que foram criadas offline e ainda não foram salvas na nuvem
  for (const local of currentLocalLists) {
    if (
      !processedIds.has(local.id) &&
      pendingCreatedListIds.has(local.id) &&
      !deletedListIds.has(local.id)
    ) {
      processedIds.add(local.id);
      reconciledLists.push(local);
    }
  }

  return applyPendingMutationsToLists(reconciledLists);
}

/**
 * Reconcilia notas da nuvem com o estado local
 */
export function reconcileNotesWithLocal(
  remoteNotes: UINote[],
  currentLocalNotes: UINote[]
): UINote[] {
  const deletedNoteIds = getPendingDeletedNoteIds();
  const queue = getPendingMutations();
  const pendingCreatedNoteIds = new Set(
    queue.filter((m) => m.type === 'CREATE_NOTE').map((m) => m.note.id)
  );

  const localMap = new Map<string, UINote>();
  for (const n of currentLocalNotes) {
    localMap.set(n.id, n);
  }

  const reconciledNotes: UINote[] = [];
  const processedIds = new Set<string>();

  for (const remote of remoteNotes) {
    if (deletedNoteIds.has(remote.id)) continue;
    processedIds.add(remote.id);
    const local = localMap.get(remote.id);

    if (local && local.updatedAt > remote.updatedAt) {
      reconciledNotes.push(local);
    } else {
      reconciledNotes.push(remote);
    }
  }

  for (const local of currentLocalNotes) {
    if (
      !processedIds.has(local.id) &&
      pendingCreatedNoteIds.has(local.id) &&
      !deletedNoteIds.has(local.id)
    ) {
      processedIds.add(local.id);
      reconciledNotes.push(local);
    }
  }

  return applyPendingMutationsToNotes(reconciledNotes);
}

/**
 * Reconcilia pastas de notas com o estado local
 */
export function reconcileNoteFoldersWithLocal(
  remoteFolders: UINoteFolder[],
  currentLocalFolders: UINoteFolder[]
): UINoteFolder[] {
  const deletedFolderIds = getPendingDeletedNoteFolderIds();
  const queue = getPendingMutations();
  const pendingCreatedFolderIds = new Set(
    queue.filter((m) => m.type === 'CREATE_NOTE_FOLDER').map((m) => m.folder.id)
  );

  const localMap = new Map<string, UINoteFolder>();
  for (const f of currentLocalFolders) {
    localMap.set(f.id, f);
  }

  const reconciledFolders: UINoteFolder[] = [];
  const processedIds = new Set<string>();

  for (const remote of remoteFolders) {
    if (deletedFolderIds.has(remote.id)) continue;
    processedIds.add(remote.id);
    const local = localMap.get(remote.id);

    if (local && local.updatedAt > remote.updatedAt) {
      reconciledFolders.push(local);
    } else {
      reconciledFolders.push(remote);
    }
  }

  for (const local of currentLocalFolders) {
    if (
      !processedIds.has(local.id) &&
      pendingCreatedFolderIds.has(local.id) &&
      !deletedFolderIds.has(local.id)
    ) {
      processedIds.add(local.id);
      reconciledFolders.push(local);
    }
  }

  return applyPendingMutationsToNoteFolders(reconciledFolders);
}

let isSyncRunning = false;

export interface SyncResult {
  success: boolean;
  offline: boolean;
  pushedCount: number;
  lists?: UIList[];
  tasks?: UITask[];
  noteFolders?: UINoteFolder[];
  notes?: UINote[];
  error?: unknown;
}

/**
 * Orquestrador principal de Sincronização Bidirecional (Push Outbox + Pull & Reconcile LWW)
 */
export async function performFullSync(
  currentLocalLists: UIList[],
  currentLocalTasks: UITask[],
  currentLocalFolders: UINoteFolder[] = [],
  currentLocalNotes: UINote[] = []
): Promise<SyncResult> {
  // Evita concorrência de sincronizações simultâneas
  if (isSyncRunning) {
    return {
      success: true,
      offline: false,
      pushedCount: 0,
      lists: currentLocalLists,
      tasks: currentLocalTasks,
      noteFolders: currentLocalFolders,
      notes: currentLocalNotes,
    };
  }

  // Verificação rápida de conexão do navegador
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      offline: true,
      pushedCount: 0,
      lists: currentLocalLists,
      tasks: currentLocalTasks,
      noteFolders: currentLocalFolders,
      notes: currentLocalNotes,
    };
  }

  isSyncRunning = true;
  try {
    // 1. PUSH: Envia todas as alterações pendentes da fila para o Turso
    const pushedCount = await pushPendingMutations();

    // 2. PULL: Baixa versão atualizada da nuvem
    const [remoteLists, remoteTasks, remoteFolders, remoteNotes] = await Promise.all([
      fetchListsFromDb(),
      fetchTasksFromDb(),
      fetchNoteFoldersFromDb().catch(() => []),
      fetchNotesFromDb().catch(() => []),
    ]);

    // 3. RECONCILE: Mescla com Last-Write-Wins e proteção contra dados perdidos
    const mergedLists = reconcileListsWithLocal(remoteLists, currentLocalLists);
    const mergedTasks = reconcileTasksWithLocal(remoteTasks, currentLocalTasks);
    const mergedFolders = reconcileNoteFoldersWithLocal(
      remoteFolders,
      currentLocalFolders
    );
    const mergedNotes = reconcileNotesWithLocal(remoteNotes, currentLocalNotes);

    return {
      success: true,
      offline: false,
      pushedCount,
      lists: mergedLists,
      tasks: mergedTasks,
      noteFolders: mergedFolders,
      notes: mergedNotes,
    };
  } catch (err: unknown) {
    console.warn('Falha na sincronização com o banco remoto (permanece offline):', err);
    return {
      success: false,
      offline: true,
      pushedCount: 0,
      lists: currentLocalLists,
      tasks: currentLocalTasks,
      noteFolders: currentLocalFolders,
      notes: currentLocalNotes,
      error: err,
    };
  } finally {
    isSyncRunning = false;
  }
}
