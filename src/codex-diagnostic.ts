import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Codex } from '@openai/codex-sdk';

// Manual diagnostic only, never called by the API or demo worker.
// Run exclusively against a trusted checkout; this is not the production isolation layer.
const directory = process.argv[2];
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.CODEX_MODEL;
if (!directory || !apiKey || !model) {
  console.error('Usage : OPENAI_API_KEY et CODEX_MODEL configurés, npm run codex:diagnostic -- /chemin/depot-fiable');
  process.exitCode = 1;
} else {
  const temporaryHome = await mkdtemp(join(tmpdir(), 'agentique-codex-'));
  try {
    const workingDirectory = await realpath(directory);
    await mkdir(join(temporaryHome, '.codex'));
    const codex = new Codex({
      apiKey,
      env: { PATH: process.env.PATH ?? '', HOME: temporaryHome, CODEX_HOME: join(temporaryHome, '.codex') },
    });
    const thread = codex.startThread({
      model, workingDirectory, sandboxMode: 'read-only', approvalPolicy: 'never',
      networkAccessEnabled: false, webSearchMode: 'disabled', modelReasoningEffort: 'low',
    });
    const result = await thread.run(
      'Décris brièvement la structure de ce dépôt et les commandes de test documentées. Lis uniquement les fichiers : ne lance pas les scripts du projet, ne modifie rien et ne contacte aucun service externe.',
      { signal: AbortSignal.timeout(120_000) },
    );
    console.log(JSON.stringify({ sessionId: thread.id, result: result.finalResponse, usage: result.usage }, null, 2));
  } catch {
    console.error('Diagnostic interrompu ou impossible. Vérifier le dépôt, le modèle et l’accès API.');
    process.exitCode = 1;
  } finally {
    await rm(temporaryHome, { recursive: true, force: true });
  }
}
