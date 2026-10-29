import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

let local = {};
try { local = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const token = process.env.API_TOKEN ?? local.API_TOKEN;
if (!token) throw new Error('Créer .env avec npm run setup ou fournir API_TOKEN.');
const port = process.env.API_PORT ?? local.API_PORT ?? '3000';
if (!/^\d{1,5}$/.test(port)) throw new Error('API_PORT invalide.');
// Fixed loopback target: never send a local credential to a caller-supplied URL.
const base = `http://127.0.0.1:${port}`;
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const created = await fetch(`${base}/v1/tasks`, {
  method: 'POST', headers: { ...headers, 'idempotency-key': randomUUID() },
  body: JSON.stringify({ title: 'Vérifier le premier circuit', objective: 'Tester la file persistante en mode démonstration.' }),
  signal: AbortSignal.timeout(5000),
});
if (!created.ok) throw new Error(`Création impossible : HTTP ${created.status}`);
const task = await created.json();
console.log(`Tâche créée : ${task.id}`);
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(`${base}/v1/tasks/${task.id}`, { headers, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Consultation impossible : HTTP ${response.status}`);
  const current = await response.json();
  if (current.status === 'result_ready') {
    console.log(JSON.stringify(current, null, 2));
    process.exit(0);
  }
  if (current.status === 'blocked' || current.status === 'cancelled') throw new Error(`Tâche ${current.status}.`);
  await sleep(1000);
}
throw new Error('Résultat non reçu en 30 secondes : vérifier le worker.');
