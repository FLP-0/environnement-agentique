import { setTimeout as sleep } from 'node:timers/promises';
import { TaskStore } from './tasks.js';

// This executor deliberately cannot call an LLM, execute code or publish to GitHub.
export async function runDemoOnce(store: TaskStore, leaseSeconds: number) {
  await store.blockExpired();
  const task = await store.claim(leaseSeconds);
  if (!task?.lease_token) return undefined;
  const completed = await store.finish(task.id, task.lease_token, {
    mode: 'demo', simulated: true,
    summary: 'Circuit de tâche vérifié. Aucun code modifié, aucun appel API et aucune publication GitHub.',
    modelCalls: 0, inputTokens: 0, outputTokens: 0, apiCostUsd: 0,
  });
  return completed?.id;
}

export async function runDemoWorker(store: TaskStore, options: {
  leaseSeconds: number; pollIntervalMs: number; signal: AbortSignal;
}) {
  while (!options.signal.aborted) {
    let completed: string | undefined;
    try {
      completed = await runDemoOnce(store, options.leaseSeconds);
    } catch {
      console.error('Traitement temporairement indisponible. Nouvelle vérification après temporisation.');
    }
    if (options.signal.aborted) break;
    if (!completed) {
      try { await sleep(options.pollIntervalMs, undefined, { signal: options.signal }); }
      catch (error) { if (!options.signal.aborted) throw error; }
    }
  }
}
