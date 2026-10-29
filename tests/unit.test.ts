import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig, readServerConfig } from '../src/config.js';
import { taskInput } from '../src/tasks.js';

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
