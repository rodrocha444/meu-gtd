import { defineConfig } from 'drizzle-kit';

const rawUrl = process.env.VITE_TURSO_DATABASE_URL ?? '';
const dbUrl = rawUrl.replace(/^turso:\/\//, 'libsql://');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: dbUrl,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN ?? '',
  },
});
