import { createHash, timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { z } from 'zod';
import { ConflictError, idempotencyKey, publicTask, TaskStore, taskId, taskInput } from './tasks.js';

export function buildApp(store: TaskStore, token: string, logging = false) {
  const app = Fastify({ logger: logging, bodyLimit: 65_536, requestTimeout: 10_000, disableRequestLogging: true });
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = digest(`Bearer ${token}`);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_input', fields: error.issues.map((i) => i.path.join('.')) });
    if (error instanceof ConflictError) return reply.code(409).send({ error: 'conflict', message: error.message });
    const code = (error as { statusCode?: number }).statusCode;
    if (code === 400 || code === 413 || code === 415) return reply.code(code).send({ error: 'invalid_request' });
    request.log.error({ requestId: request.id }, 'Erreur interne ; vérifier la base et les services.');
    return reply.code(500).send({ error: 'internal_error' });
  });

  app.get('/healthz', async () => ({ status: 'ok', mode: 'demo' }));
  app.get('/readyz', async (_request, reply) => {
    try {
      await store.pool.query('SELECT id FROM tasks LIMIT 0');
      return { status: 'ready', mode: 'demo' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.register(async (api) => {
    api.addHook('onRequest', async (request, reply) => {
      if (!timingSafeEqual(digest(request.headers.authorization ?? ''), expected)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    });
    api.post('/tasks', async (request, reply) => {
      const input = taskInput.parse(request.body);
      const key = idempotencyKey.parse(request.headers['idempotency-key']);
      const result = await store.create(input, key);
      return reply.code(result.created ? 201 : 200).send(publicTask(result.task));
    });
    api.get('/tasks', async (request) => {
      const query = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
      }).strict().parse(request.query);
      return { tasks: (await store.list(query.limit, query.offset)).map(publicTask) };
    });
    api.get('/tasks/:id', async (request, reply) => {
      const { id } = z.object({ id: taskId }).parse(request.params);
      const task = await store.get(id);
      return task ? publicTask(task) : reply.code(404).send({ error: 'not_found' });
    });
    api.get('/tasks/:id/events', async (request, reply) => {
      const { id } = z.object({ id: taskId }).parse(request.params);
      const { after } = z.object({ after: z.string().regex(/^\d{1,18}$/).default('0') }).strict().parse(request.query);
      if (!(await store.get(id))) return reply.code(404).send({ error: 'not_found' });
      return { events: await store.events(id, after) };
    });
    api.post('/tasks/:id/cancel', async (request, reply) => {
      const { id } = z.object({ id: taskId }).parse(request.params);
      const task = await store.cancel(id);
      return task ? publicTask(task) : reply.code(404).send({ error: 'not_found' });
    });
  }, { prefix: '/v1' });
  return app;
}
