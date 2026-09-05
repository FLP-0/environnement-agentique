import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createPool, migrate } from '../src/database.js';
import { ConflictError, TaskStore } from '../src/tasks.js';
import { runDemoOnce } from '../src/worker.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL requis : utiliser une base PostgreSQL de test dédiée.');
// Never truncate an existing application schema. Each invocation gets a private schema.
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const admin = createPool(url);
const scoped = new URL(url);
scoped.searchParams.set('options', `-c search_path=${schema}`);
const pool = createPool(scoped.toString());
const store = new TaskStore(pool);
const token = 'a'.repeat(64);
const app = buildApp(store, token);
const input = { title: 'Test', objective: 'Vérifier le circuit', priority: 0 };
const headers = { authorization: `Bearer ${token}`, 'idempotency-key': 'test-key' };

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  await app.ready();
});
beforeEach(async () => { await pool.query('TRUNCATE task_events, tasks RESTART IDENTITY'); });
after(async () => {
  await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});

test('migrations are repeatable and serialized', async () => {
  await Promise.all([migrate(pool), migrate(pool)]);
  assert.equal((await pool.query('SELECT * FROM schema_migrations')).rowCount, 1);
});

test('health works; API requires token; validation rejects unsafe or malformed input', async () => {
  assert.equal((await app.inject('/healthz')).statusCode, 200);
  assert.equal((await app.inject('/readyz')).statusCode, 200);
  assert.equal((await app.inject('/v1/tasks')).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/tasks', headers, payload: { ...input, command: 'whoami' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/tasks', headers: { authorization: headers.authorization }, payload: input })).statusCode, 400);
  assert.equal((await app.inject({ url: '/v1/tasks/not-a-uuid', headers })).statusCode, 400);
  assert.equal((await app.inject({ url: '/v1/tasks?limit=101', headers })).statusCode, 400);
});

test('concurrent task creation is idempotent and conflicting payloads are rejected', async () => {
  const created = await Promise.all(Array.from({ length: 8 }, () => store.create(input, 'one-key')));
  assert.equal(new Set(created.map((r) => r.task.id)).size, 1);
  assert.equal(created.filter((r) => r.created).length, 1);
  await assert.rejects(store.create({ ...input, objective: 'Different' }, 'one-key'), ConflictError);
  assert.equal((await store.events(created[0]!.task.id, '0')).length, 1);
});

test('competing workers claim a task only once', async () => {
  const { task } = await store.create(input, 'one');
  const claims = await Promise.all(Array.from({ length: 8 }, () => store.claim(60)));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(claims.find(Boolean)?.id, task.id);
});

test('queue respects priority', async () => {
  await store.create(input, 'normal');
  const urgent = await store.create({ ...input, priority: 100 }, 'urgent');
  assert.equal((await store.claim(60))?.id, urgent.task.id);
});

test('lease token is hidden from API and wrong tokens cannot finish work', async () => {
  const { task } = await store.create(input, 'one');
  const claimed = (await store.claim(60))!;
  assert.equal(await store.finish(task.id, randomUUID(), { bad: true }), undefined);
  const visible = (await app.inject({ url: `/v1/tasks/${task.id}`, headers })).json();
  assert.equal(visible.lease_token, undefined);
  assert.equal(visible.fingerprint, undefined);
  assert.equal(await store.heartbeat(task.id, claimed.lease_token!, 60), true);
  assert.equal((await store.finish(task.id, claimed.lease_token!, { ok: true }))?.status, 'result_ready');
});

test('cancellation fences a worker and is idempotent', async () => {
  const { task } = await store.create(input, 'one');
  const claimed = (await store.claim(60))!;
  await store.cancel(task.id);
  await store.cancel(task.id);
  assert.equal(await store.finish(task.id, claimed.lease_token!, { late: true }), undefined);
  assert.equal(await store.heartbeat(task.id, claimed.lease_token!, 60), false);
  assert.equal((await store.events(task.id, '0')).filter((e) => e.type === 'cancelled').length, 1);
});

test('expired work cannot renew or commit and is blocked for reconciliation', async () => {
  const { task } = await store.create(input, 'one');
  const claimed = (await store.claim(60))!;
  await pool.query("UPDATE tasks SET lease_expires_at = now() - interval '1 second' WHERE id = $1", [task.id]);
  assert.equal(await store.heartbeat(task.id, claimed.lease_token!, 60), false);
  assert.equal(await store.finish(task.id, claimed.lease_token!, {}), undefined);
  assert.equal(await store.blockExpired(), 1);
  assert.equal(await store.blockExpired(), 0);
  assert.equal((await store.get(task.id))?.status, 'blocked');
  assert.equal(await store.claim(60), undefined);
});

test('demo round-trip persists across a new connection and reports no model execution', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/tasks', headers, payload: input });
  assert.equal(response.statusCode, 201);
  const id = response.json().id as string;
  await runDemoOnce(store, 60);
  const reconnect = createPool(scoped.toString());
  try {
    const task = await new TaskStore(reconnect).get(id);
    assert.equal(task?.status, 'result_ready');
    assert.deepEqual((task?.result as { simulated: boolean }).simulated, true);
    assert.equal((task?.result as { apiCostUsd: number }).apiCostUsd, 0);
    await assert.rejects(store.cancel(id), ConflictError);
  } finally { await reconnect.end(); }
  const events = (await app.inject({ url: `/v1/tasks/${id}/events`, headers })).json().events;
  assert.deepEqual(events.map((e: { type: string }) => e.type), ['created', 'claimed', 'result_ready']);
});
