import {
  sqliteTable,
  text,
  integer,
  index,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Tipos de domínio estritos para Status e Prioridade (TickTick + GTD)
 */
export type TaskStatus = 'pending' | 'completed';
export type TaskPriority = 0 | 1 | 2 | 3; // 0: None, 1: Low, 2: Medium, 3: High
export type RecurrenceMode = 'fixed' | 'after_completion';

/**
 * 1. TABELA DE LISTAS (GTD System Lists + Projetos Customizados)
 */
export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6366f1'),
    icon: text('icon').notNull().default('inbox'),
    isGtdSystem: integer('is_gtd_system', { mode: 'boolean' })
      .notNull()
      .default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index('idx_lists_sort_order').on(table.sortOrder)]
);

/**
 * 2. TABELA DE TAREFAS (Suporte a hierarquia de subtarefas, recorrência RRule + Modo e GTD)
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''), // Markdown
    status: text('status', { enum: ['pending', 'completed'] })
      .$type<TaskStatus>()
      .notNull()
      .default('pending'),
    priority: integer('priority')
      .$type<TaskPriority>()
      .notNull()
      .default(0), // 0: None, 1: Low, 2: Medium, 3: High
    isPinned: integer('is_pinned', { mode: 'boolean' })
      .notNull()
      .default(false),
    dueDate: integer('due_date', { mode: 'timestamp_ms' }),
    recurrenceRule: text('recurrence_rule'), // RRule RFC 5545 (ex: "FREQ=DAILY;INTERVAL=1")
    recurrenceMode: text('recurrence_mode', {
      enum: ['fixed', 'after_completion'],
    })
      .$type<RecurrenceMode>()
      .notNull()
      .default('fixed'), // 'fixed' = pela data agendada; 'after_completion' = após o dia de conclusão
    reminders: text('reminders'), // JSON serializado de TaskReminder[]
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    parentTaskId: text('parent_task_id').references(
      (): AnySQLiteColumn => tasks.id,
      { onDelete: 'cascade' }
    ),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_tasks_list_status').on(table.listId, table.status),
    index('idx_tasks_due_date').on(table.dueDate),
    index('idx_tasks_parent').on(table.parentTaskId),
    index('idx_tasks_priority').on(table.priority),
    index('idx_tasks_deleted_at').on(table.deletedAt),
  ]
);

/**
 * RELAÇÕES DO DRIZZLE ORM
 */
export const listsRelations = relations(lists, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  list: one(lists, {
    fields: [tasks.listId],
    references: [lists.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
}));

export type ListRecord = typeof lists.$inferSelect;
export type NewListRecord = typeof lists.$inferInsert;
export type TaskRecord = typeof tasks.$inferSelect;
export type NewTaskRecord = typeof tasks.$inferInsert;

/**
 * 3. TABELA DE PASTAS DE ANOTAÇÕES (Note Folders)
 */
export const noteFolders = sqliteTable(
  'note_folders',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#8b5cf6'),
    icon: text('icon').notNull().default('folder'),
    parentId: text('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('idx_note_folders_sort_order').on(table.sortOrder),
    index('idx_note_folders_parent_id').on(table.parentId),
  ]
);

/**
 * 4. TABELA DE ANOTAÇÕES / RASCUNHOS (Notes)
 */
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''), // Markdown / texto
    folderId: text('folder_id').references(() => noteFolders.id, {
      onDelete: 'set null',
    }),
    isPinned: integer('is_pinned', { mode: 'boolean' })
      .notNull()
      .default(false),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_notes_folder').on(table.folderId),
    index('idx_notes_updated_at').on(table.updatedAt),
    index('idx_notes_pinned').on(table.isPinned),
    index('idx_notes_deleted_at').on(table.deletedAt),
  ]
);

export const noteFoldersRelations = relations(noteFolders, ({ many }) => ({
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  folder: one(noteFolders, {
    fields: [notes.folderId],
    references: [noteFolders.id],
  }),
}));

export type NoteFolderRecord = typeof noteFolders.$inferSelect;
export type NewNoteFolderRecord = typeof noteFolders.$inferInsert;
export type NoteRecord = typeof notes.$inferSelect;
export type NewNoteRecord = typeof notes.$inferInsert;
