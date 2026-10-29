import { readConfig } from './config.js';
import { createPool, migrate } from './database.js';

const pool = createPool(readConfig().DATABASE_URL);
try {
  await migrate(pool);
  console.log('Migrations appliquées.');
} catch {
  console.error('Migration impossible. Vérifier PostgreSQL et les migrations versionnées.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
