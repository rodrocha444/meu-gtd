import {
  sqliteTable,
  text,
  integer,
  primaryKey,
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
  },
  (table) => [
    index('idx_tasks_list_status').on(table.listId, table.status),
    index('idx_tasks_due_date').on(table.dueDate),
    index('idx_tasks_parent').on(table.parentTaskId),
    index('idx_tasks_priority').on(table.priority),
  ]
);

/**
 * 3. TABELA DE TAGS E CONTEXTOS GTD (ex: @computador, @rua, #energia_baixa)
 */
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#10b981'),
});

/**
 * 4. TABELA PIVÔ TASK_TAGS (N:N)
 */
export const taskTags = sqliteTable(
  'task_tags',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('idx_task_tags_tag').on(table.tagId),
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
  taskTags: many(taskTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
}));

export type ListRecord = typeof lists.$inferSelect;
export type NewListRecord = typeof lists.$inferInsert;
export type TaskRecord = typeof tasks.$inferSelect;
export type NewTaskRecord = typeof tasks.$inferInsert;
export type TagRecord = typeof tags.$inferSelect;
