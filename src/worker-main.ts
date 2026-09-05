import { readConfig } from './config.js';
import { createPool } from './database.js';
import { TaskStore } from './tasks.js';
import { runDemoWorker } from './worker.js';

const config = readConfig();
const pool = createPool(config.DATABASE_URL);
pool.on('error', () => console.error('Connexion PostgreSQL interrompue.'));
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop.abort());
console.log('Worker DEMO actif. Aucun appel à un modèle.');
try {
  await runDemoWorker(new TaskStore(pool), {
    leaseSeconds: config.LEASE_SECONDS, pollIntervalMs: config.POLL_INTERVAL_MS, signal: stop.signal,
  });
} finally {
  await pool.end();
}
