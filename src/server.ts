import { buildApp } from './app.js';
import { readServerConfig } from './config.js';
import { createPool } from './database.js';
import { TaskStore } from './tasks.js';

const config = readServerConfig();
const pool = createPool(config.DATABASE_URL);
pool.on('error', () => console.error('Connexion PostgreSQL interrompue.'));
const app = buildApp(new TaskStore(pool), config.API_TOKEN, true);
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  console.error('Démarrage API impossible. Vérifier le port et la configuration.');
  await app.close();
  process.exitCode = 1;
}
