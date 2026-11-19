import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { MemoryStore } from './memory-store.js';
import { PostgresStore } from './postgres-store.js';
import { SCHEMA_SQL } from './schema.js';
import type { Store } from './store.js';

export * from './store.js';

let storeInstance: Store | null = null;
let initPromise: Promise<Store> | null = null;

export async function runMigrations(store: PostgresStore): Promise<void> {
  await store.query(SCHEMA_SQL);
  console.log('[db] schema migrations applied');
}

function buildStore(): Store {
  if (config.databaseUrl) {
    return new PostgresStore(config.databaseUrl);
  }
  if (config.isServerless) {
    console.warn('[db] no POSTGRES_URL / DATABASE_URL set in serverless environment - using ephemeral in-memory store for this instance');
    return new MemoryStore(null);
  }
  console.log('[db] no POSTGRES_URL / DATABASE_URL set - using local JSON store at ./data/bonfils-store.json');
  return new MemoryStore(path.join(process.cwd(), 'data', 'bonfils-store.json'));
}

export async function initStore(): Promise<Store> {
  if (storeInstance) return storeInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let store: Store | null = null;
    try {
      store = buildStore();
      await store.init();
      if (store instanceof PostgresStore && config.runMigrationsOnBoot) {
        await runMigrations(store);
      }
      storeInstance = store;
      console.log(`[db] store ready (${store.kind})`);
      return store;
    } catch (error) {
      initPromise = null;
      if (store) {
        await store.close().catch(() => {});
      }
      if (config.databaseUrl && config.isServerless) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[db] postgres init/migration failed, falling back to ephemeral memory store: ${message}`);
        try {
          const fallback = new MemoryStore(null);
          await fallback.init();
          storeInstance = fallback;
          console.warn('[db] fallback store ready (memory)');
          return fallback;
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.error(`[db] memory fallback failed: ${fallbackMessage}`);
        }
      }
      throw error;
    }
  })();

  return initPromise;
}

export function getStore(): Store {
  if (!storeInstance) {
    throw new Error('Database store has not been initialised. Call initStore() during startup.');
  }
  return storeInstance;
}

export async function ensureDataFile(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
