import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { readConfig, readServerConfig } from '../src/config.js';
import { taskInput, TaskStore, type Task, type TaskInput } from '../src/tasks.js';

test('configuration refuses missing credentials and invalid timing', () => {
  assert.throws(() => readConfig({}));
  assert.throws(() => readConfig({ DATABASE_URL: 'https://example.com', LEASE_SECONDS: '60' }));
  assert.throws(() => readConfig({ DATABASE_URL: 'postgres://localhost/db', LEASE_SECONDS: '0' }));
  assert.throws(() => readServerConfig({ DATABASE_URL: 'postgres://localhost/db', API_TOKEN: 'short' }));
  assert.throws(() => readConfig({ DATABASE_URL: 'postgres://localhost/db', POLL_INTERVAL_MS: 'NaN' }));
});

test('configuration errors do not reveal credentials', () => {
  const secret = 'sensitive-secret-never-log';
  try { readServerConfig({ DATABASE_URL: 'postgres://localhost/db', API_TOKEN: secret }); }
  catch (error) { assert.equal(String(error).includes(secret), false); }
});

test('default network binding is loopback', () => {
  const config = readServerConfig({ DATABASE_URL: 'postgres://localhost/db', API_TOKEN: 'a'.repeat(64) });
  assert.equal(config.HOST, '127.0.0.1');
  assert.equal(config.LEASE_SECONDS, 60);
});

test('task input rejects commands and oversized objectives', () => {
  assert.throws(() => taskInput.parse({ title: 'task', objective: 'objective', command: 'curl example.com' }));
  assert.throws(() => taskInput.parse({ title: ' ', objective: 'objective' }));
  assert.throws(() => taskInput.parse({ title: 'task', objective: 'x'.repeat(10_001) }));
  assert.deepEqual(taskInput.parse({ title: ' task ', objective: ' objective ' }), { title: 'task', objective: 'objective', priority: 0 });
});

const testToken = 't'.repeat(64);

function fakeStore() {
  const calls = { create: 0 };
  const store = {
    async create(input: TaskInput, key: string): Promise<{ task: Task; created: boolean }> {
      calls.create += 1;
      const now = new Date();
      const task: Task = {
        id: '00000000-0000-4000-8000-000000000001',
        title: input.title,
        objective: input.objective,
        priority: input.priority,
        mode: 'demo',
        status: 'ready',
        attempts: 0,
        lease_token: null,
        lease_expires_at: null,
        result: null,
        created_at: now,
        updated_at: now,
        fingerprint: 'fingerprint',
        idempotency_key: key,
      };
      return { task, created: true };
    },
  };
  return { store: store as unknown as TaskStore, calls };
}

const postHeaders = {
  authorization: `Bearer ${testToken}`,
  'content-type': 'application/json',
  'idempotency-key': 'body-limit-test',
};

test('POST /v1/tasks accepts a valid objective written with unicode escapes', async () => {
  const { store } = fakeStore();
  const app = buildApp(store, testToken);
  try {
    const payload = '{"title":"Objectif accentué","objective":"' + '\\u00e9'.repeat(10_000) + '"}';
    assert.ok(Buffer.byteLength(payload) > 32_768);
    assert.ok(Buffer.byteLength(payload) <= 65_536);
    const response = await app.inject({ method: 'POST', url: '/v1/tasks', headers: postHeaders, payload });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().objective, 'é'.repeat(10_000));
  } finally {
    await app.close();
  }
});

test('POST /v1/tasks rejects bodies larger than 65 536 bytes', async () => {
  const { store, calls } = fakeStore();
  const app = buildApp(store, testToken);
  try {
    const payload = JSON.stringify({ title: 'task', objective: 'x'.repeat(70_000) });
    assert.ok(Buffer.byteLength(payload) > 65_536);
    const response = await app.inject({ method: 'POST', url: '/v1/tasks', headers: postHeaders, payload });
    assert.equal(response.statusCode, 413);
    assert.deepEqual(response.json(), { error: 'invalid_request' });
    assert.equal(calls.create, 0);
  } finally {
    await app.close();
  }
});
