import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { MemoryStore } from './memory-store';
import { PostgresStore } from './postgres-store';
import { SCHEMA_SQL } from './schema';
import type { Store } from './store';

export * from './store';

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
  const snapshotPath = config.isServerless
    ? null
    : path.join(process.cwd(), 'data', 'bonfils-store.json');
  if (config.isServerless) {
    console.warn('[db] POSTGRES_URL / DATABASE_URL is not set. Running WITHOUT a database (data is not durable).');
  } else {
    console.log('[db] no POSTGRES_URL / DATABASE_URL set - using local JSON store at ./data/bonfils-store.json');
  }
  return new MemoryStore(snapshotPath);
}

export async function initStore(): Promise<Store> {
  if (storeInstance) return storeInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const store = buildStore();
    await store.init();
    if (store instanceof PostgresStore && config.runMigrationsOnBoot) {
      await runMigrations(store);
    }
    storeInstance = store;
    console.log(`[db] store ready (${store.kind})`);
    return store;
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
