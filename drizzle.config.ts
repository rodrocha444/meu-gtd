import { defineConfig } from 'drizzle-kit';

const rawUrl = process.env.VITE_TURSO_DATABASE_URL ?? 'file:local-meu-gtd.db';
const dbUrl = rawUrl.replace(/^turso:\/\//, 'libsql://');
const isLocalFile = dbUrl.startsWith('file:') || dbUrl.endsWith('.db');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: isLocalFile ? 'sqlite' : 'turso',
  dbCredentials: isLocalFile
    ? {
        url: dbUrl,
      }
    : {
        url: dbUrl,
        authToken: process.env.VITE_TURSO_AUTH_TOKEN ?? '',
      },
});
