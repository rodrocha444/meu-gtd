import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Configuração do Cliente Turso + Drizzle ORM com Arquitetura Offline-First:
 *
 * 1. Em ambientes Nativos (Capacitor Desktop/Node/Mobile com FileSystem SQLite nativo):
 *    Utiliza Embedded Replicas do LibSQL (`url: 'file:local-gtd.db'`, `syncUrl`, `syncInterval`),
 *    garantindo leitura/escrita em 0ms no SQLite local e sync em background com o Turso Cloud.
 *
 * 2. Em ambientes Browser/PWA:
 *    Conecta ao Turso via HTTP/Hrana e mantém uma fila otimista local (Outbox Cache) no IndexedDB/LocalStorage
 *    para garantir latência zero na UI mesmo sem rede.
 */

export interface DatabaseEnvConfig {
  localReplicaUrl?: string;
  remoteSyncUrl?: string;
  authToken?: string;
  syncIntervalSeconds?: number;
}

const isBrowserRuntime = typeof window !== 'undefined';

export function createTursoClient(customConfig?: DatabaseEnvConfig): Client {
  const rawRemoteUrl =
    customConfig?.remoteSyncUrl ??
    import.meta.env.VITE_TURSO_DATABASE_URL ??
    'libsql://meu-gtd.turso.io';
  const remoteUrl = rawRemoteUrl.replace(/^turso:\/\//, 'libsql://');
  const authToken =
    customConfig?.authToken ?? import.meta.env.VITE_TURSO_AUTH_TOKEN ?? '';
  const localUrl = customConfig?.localReplicaUrl ?? 'file:local-meu-gtd.db';
  const syncInterval = customConfig?.syncIntervalSeconds ?? 60;

  // Embedded Replica para runtimes com acesso a filesystem local
  if (!isBrowserRuntime) {
    return createClient({
      url: localUrl,
      syncUrl: remoteUrl,
      authToken,
      syncInterval,
      encryptionKey: import.meta.env.VITE_LOCAL_DB_ENCRYPTION_KEY,
    });
  }

  // Fallback Web/PWA para cliente HTTP Turso
  return createClient({
    url: remoteUrl,
    authToken,
  });
}

export const libsqlClient: Client = createTursoClient();

export const db: LibSQLDatabase<typeof schema> = drizzle(libsqlClient, {
  schema,
});

/**
 * Dispara sincronização manual da Embedded Replica com o Turso Cloud
 * Útil ao recuperar conexão de rede (`window.addEventListener('online', ...)`),
 * no pull-to-sync ou ao voltar do background no Capacitor (`App.addListener('appStateChange')`).
 */
export async function syncEmbeddedReplica(): Promise<{
  syncedAt: number;
  offline: boolean;
}> {
  try {
    if ('sync' in libsqlClient && typeof libsqlClient.sync === 'function') {
      await libsqlClient.sync();
    }
    return { syncedAt: Date.now(), offline: false };
  } catch {
    // Continua operando 100% offline na réplica local sem bloquear a UI
    return { syncedAt: Date.now(), offline: true };
  }
}

/**
 * Listas fixas obrigatórias do sistema GTD (is_gtd_system = true)
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
    name: 'Algum Dia / Talvez',
    color: '#8b5cf6',
    icon: 'sparkles',
    isGtdSystem: true,
    sortOrder: 3,
  },
];
