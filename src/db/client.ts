import {
  createClient,
  type Client,
  type InStatement,
  type InValue,
} from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { asc } from 'drizzle-orm';
import * as schema from './schema';
import type { TaskPriority, TaskStatus, RecurrenceMode } from './schema';

/**
 * Cliente Turso Cloud direto via HTTP/Hrana + Drizzle ORM
 * Leitura e gravação 100% integradas ao banco remoto no Turso Cloud.
 */

export interface DatabaseEnvConfig {
  remoteUrl?: string;
  authToken?: string;
}

/**
 * Tempo limite padrão para operações de banco e requisições ao Turso (10 segundos).
 * Evita que o usuário aguarde o timeout longo nativo do browser (30s-120s) quando sem internet.
 */
export const DB_OPERATION_TIMEOUT_MS = 10_000;

export function createTursoClient(customConfig?: DatabaseEnvConfig): Client {
  const rawRemoteUrl =
    customConfig?.remoteUrl ??
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURSO_DATABASE_URL
      ? import.meta.env.VITE_TURSO_DATABASE_URL
      : typeof process !== 'undefined' && process.env?.VITE_TURSO_DATABASE_URL
      ? process.env.VITE_TURSO_DATABASE_URL
      : 'libsql://meu-gtd.turso.io');

  const remoteUrl = rawRemoteUrl.replace(/^turso:\/\//, 'libsql://');

  const authToken =
    customConfig?.authToken ??
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURSO_AUTH_TOKEN
      ? import.meta.env.VITE_TURSO_AUTH_TOKEN
      : typeof process !== 'undefined' && process.env?.VITE_TURSO_AUTH_TOKEN
      ? process.env.VITE_TURSO_AUTH_TOKEN
      : '');

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Dispositivo sem conexão com a internet (offline).');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DB_OPERATION_TIMEOUT_MS);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Tempo limite esgotado (${DB_OPERATION_TIMEOUT_MS / 1000}s). Falha na comunicação por falta de conexão.`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  return createClient({
    url: remoteUrl,
    authToken,
    fetch: customFetch,
  });
}

export const libsqlClient: Client = createTursoClient();

export const db: LibSQLDatabase<typeof schema> = drizzle(libsqlClient, {
  schema,
});

/**
 * Executa uma operação assíncrona com timeout estrito de 10s e detecção imediata de offline.
 */
export async function withDatabaseTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = DB_OPERATION_TIMEOUT_MS,
  operationName: string = 'operação de banco'
): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      `Sem conexão à internet. A ${operationName} não pôde ser executada.`
    );
  }

  return new Promise<T>((resolve, reject) => {
    let hasSettled = false;
    const timer = setTimeout(() => {
      if (!hasSettled) {
        hasSettled = true;
        reject(
          new Error(
            `Tempo limite esgotado (${timeoutMs / 1000}s) ao executar ${operationName}. Verifique sua conexão com a internet.`
          )
        );
      }
    }, timeoutMs);

    operation()
      .then((result) => {
        if (!hasSettled) {
          hasSettled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!hasSettled) {
          hasSettled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Verifica conectividade direta com o Turso Cloud com timeout de 10s
 */
export async function syncEmbeddedReplica(): Promise<{
  syncedAt: number;
  offline: boolean;
}> {
  try {
    await withDatabaseTimeout(
      () => libsqlClient.execute('SELECT 1'),
      DB_OPERATION_TIMEOUT_MS,
      'verificação de conexão'
    );
    return { syncedAt: Date.now(), offline: false };
  } catch {
    return { syncedAt: Date.now(), offline: true };
  }
}

/**
 * Listas fixas do sistema GTD (is_gtd_system = true) e listas padrão
 */
export const GTD_SYSTEM_LISTS: ReadonlyArray<schema.NewListRecord> = [
  {
    id: 'inbox',
    name: 'Inbox',
    color: '#3b82f6',
    icon: 'inbox',
    isGtdSystem: true,
    sortOrder: 0,
  },
  {
    id: 'next_actions',
    name: 'Ações Seguintes',
    color: '#10b981',
    icon: 'zap',
    isGtdSystem: true,
    sortOrder: 1,
  },
  {
    id: 'waiting_for',
    name: 'Aguardando',
    color: '#f59e0b',
    icon: 'clock',
    isGtdSystem: true,
    sortOrder: 2,
  },
  {
    id: 'someday',
    name: 'Algum Dia',
    color: '#8b5cf6',
    icon: 'sparkles',
    isGtdSystem: true,
    sortOrder: 3,
  },
];

export interface TaskRecordWithTags {
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

export interface ListRecordUI {
  id: string;
  name: string;
  color: string;
  icon: string;
  isGtdSystem: boolean;
  sortOrder: number;
}

/**
 * Carrega listas do Turso. Garante a integridade das listas GTD do sistema (inbox, etc.)
 */
export async function fetchListsFromDb(): Promise<ListRecordUI[]> {
  return withDatabaseTimeout(
    async () => {
      // 1. Garante que todas as listas do sistema GTD existam no banco com INSERT OR IGNORE
      const seedBatch = GTD_SYSTEM_LISTS.map((sysList) => ({
        sql: `INSERT OR IGNORE INTO lists (id, name, color, icon, is_gtd_system, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sysList.id,
          sysList.name,
          sysList.color ?? '#6366f1',
          sysList.icon ?? 'inbox',
          sysList.isGtdSystem ? 1 : 0,
          sysList.sortOrder ?? 0,
          Date.now(),
        ],
      }));
      await libsqlClient.batch(seedBatch, 'write');

      // 2. Busca todas as listas ordenadas
      const current = await db
        .select()
        .from(schema.lists)
        .orderBy(asc(schema.lists.sortOrder));

      return current.map((l) => ({
        id: String(l.id),
        name: String(l.name),
        color: String(l.color),
        icon: String(l.icon),
        isGtdSystem: Boolean(l.isGtdSystem),
        sortOrder: Number.isFinite(Number(l.sortOrder)) ? Number(l.sortOrder) : 0,
      }));
    },
    DB_OPERATION_TIMEOUT_MS,
    'carregamento de listas'
  );
}

/**
 * Sanitiza valores de campos para prevenir quebras com dados legados ou tipos inconsistentes
 */
function sanitizeTaskStatus(status: unknown): TaskStatus {
  return status === 'completed' ? 'completed' : 'pending';
}

function sanitizeTaskPriority(priority: unknown): TaskPriority {
  const p = Number(priority);
  return p === 1 || p === 2 || p === 3 ? (p as TaskPriority) : 0;
}

function parseSafeTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Carrega todas as tarefas com suas respectivas tags do Turso Cloud, com sanitização defensiva
 */
export async function fetchTasksFromDb(): Promise<TaskRecordWithTags[]> {
  return withDatabaseTimeout(
    async () => {
      const allTasks = await db
        .select()
        .from(schema.tasks)
        .orderBy(asc(schema.tasks.sortOrder));

      const allTaskTags = await db.select().from(schema.taskTags);

      const tagsByTaskId = new Map<string, string[]>();
      for (const tt of allTaskTags) {
        if (!tt.taskId || !tt.tagId) continue;
        const list = tagsByTaskId.get(tt.taskId) ?? [];
        list.push(String(tt.tagId));
        tagsByTaskId.set(tt.taskId, list);
      }

      return allTasks.map((t) => {
        const createdAtSafe = parseSafeTimestamp(t.createdAt) ?? Date.now();
        const updatedAtSafe = parseSafeTimestamp(t.updatedAt) ?? createdAtSafe;
        return {
          id: String(t.id),
          title: String(t.title ?? ''),
          description: String(t.description ?? ''),
          status: sanitizeTaskStatus(t.status),
          priority: sanitizeTaskPriority(t.priority),
          isPinned: Boolean(t.isPinned),
          dueDate: parseSafeTimestamp(t.dueDate),
          recurrenceRule: t.recurrenceRule ? String(t.recurrenceRule) : null,
          recurrenceMode: t.recurrenceMode === 'after_completion' ? 'after_completion' : 'fixed',
          listId: String(t.listId ?? 'inbox'),
          parentTaskId: t.parentTaskId ? String(t.parentTaskId) : null,
          tags: tagsByTaskId.get(t.id) ?? [],
          sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : 0,
          createdAt: createdAtSafe,
          updatedAt: updatedAtSafe,
          completedAt: parseSafeTimestamp(t.completedAt),
        };
      });
    },
    DB_OPERATION_TIMEOUT_MS,
    'carregamento de tarefas'
  );
}

/**
 * Insere uma nova tarefa no Turso Cloud em uma transação atômica única (batch)
 */
export async function createTaskInDb(task: TaskRecordWithTags): Promise<void> {
  return withDatabaseTimeout(
    async () => {
      const statements: InStatement[] = [
        {
          sql: `INSERT OR REPLACE INTO tasks (
            id, title, description, status, priority, is_pinned, due_date,
            recurrence_rule, recurrence_mode, list_id, parent_task_id,
            sort_order, created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            task.listId,
            task.parentTaskId ?? null,
            task.sortOrder ?? 0,
            task.createdAt,
            task.updatedAt,
            task.completedAt !== null ? task.completedAt : null,
          ],
        },
      ];

      if (task.tags && task.tags.length > 0) {
        for (const tag of task.tags) {
          statements.push({
            sql: 'INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)',
            args: [tag, tag, '#10b981'],
          });
          statements.push({
            sql: 'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)',
            args: [task.id, tag],
          });
        }
      }

      await libsqlClient.batch(statements, 'write');
    },
    DB_OPERATION_TIMEOUT_MS,
    'criação de tarefa'
  );
}

/**
 * Atualiza campos de uma tarefa no Turso Cloud em uma transação atômica única (batch)
 */
export async function updateTaskInDb(
  taskId: string,
  updates: Partial<Omit<TaskRecordWithTags, 'id'>>,
  tags?: string[]
): Promise<void> {
  return withDatabaseTimeout(
    async () => {
      const statements: InStatement[] = [];

      const setClauses: string[] = ['updated_at = ?'];
      const setArgs: InValue[] = [Date.now()];

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

      setArgs.push(taskId);
      statements.push({
        sql: `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
        args: setArgs,
      });

      if (tags !== undefined) {
        statements.push({
          sql: 'DELETE FROM task_tags WHERE task_id = ?',
          args: [taskId],
        });
        for (const tag of tags) {
          statements.push({
            sql: 'INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)',
            args: [tag, tag, '#10b981'],
          });
          statements.push({
            sql: 'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)',
            args: [taskId, tag],
          });
        }
      }

      await libsqlClient.batch(statements, 'write');
    },
    DB_OPERATION_TIMEOUT_MS,
    'atualização de tarefa'
  );
}

/**
 * Remove uma tarefa do Turso Cloud e suas relações em uma transação atômica única (batch)
 */
export async function deleteTaskInDb(taskId: string): Promise<void> {
  return withDatabaseTimeout(
    async () => {
      await libsqlClient.batch(
        [
          { sql: 'DELETE FROM task_tags WHERE task_id = ?', args: [taskId] },
          { sql: 'DELETE FROM tasks WHERE parent_task_id = ?', args: [taskId] },
          { sql: 'DELETE FROM tasks WHERE id = ?', args: [taskId] },
        ],
        'write'
      );
    },
    DB_OPERATION_TIMEOUT_MS,
    'exclusão de tarefa'
  );
}

/**
 * Cria uma nova lista ou projeto no Turso Cloud
 */
export async function createListInDb(list: ListRecordUI): Promise<void> {
  return withDatabaseTimeout(
    async () => {
      await db.insert(schema.lists).values({
        id: list.id,
        name: list.name,
        color: list.color,
        icon: list.icon,
        isGtdSystem: list.isGtdSystem,
        sortOrder: list.sortOrder,
        createdAt: new Date(),
      });
    },
    DB_OPERATION_TIMEOUT_MS,
    'criação de projeto/lista'
  );
}

/**
 * Remove uma lista ou projeto do Turso Cloud e move suas tarefas para a Inbox em transação atômica (batch)
 */
export async function deleteListInDb(listId: string): Promise<void> {
  return withDatabaseTimeout(
    async () => {
      await libsqlClient.batch(
        [
          {
            sql: 'UPDATE tasks SET list_id = ?, updated_at = ? WHERE list_id = ?',
            args: ['inbox', Date.now(), listId],
          },
          {
            sql: 'DELETE FROM lists WHERE id = ?',
            args: [listId],
          },
        ],
        'write'
      );
    },
    DB_OPERATION_TIMEOUT_MS,
    'exclusão de projeto/lista'
  );
}
