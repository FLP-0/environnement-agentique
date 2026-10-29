import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { transaction } from '../src/database.js';

function fakePool({ failRollback }: { failRollback: boolean }) {
  const queries: string[] = [];
  const releaseArgs: unknown[] = [];
  const client = {
    async query(text: string) {
      queries.push(text);
      if (text === 'ROLLBACK' && failRollback) throw new Error('rollback failed');
      return { rows: [] };
    },
    release(arg?: unknown) {
      releaseArgs.push(arg);
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, queries, releaseArgs };
}

test('transaction commits and returns the result of fn', async () => {
  const { pool, queries, releaseArgs } = fakePool({ failRollback: false });
  const result = await transaction(pool, async () => 42);
  assert.equal(result, 42);
  assert.deepEqual(queries, ['BEGIN', 'COMMIT']);
  assert.equal(releaseArgs.length, 1);
  assert.notEqual(releaseArgs[0], true);
});

test('transaction rethrows the original error after a successful rollback', async () => {
  const { pool, queries, releaseArgs } = fakePool({ failRollback: false });
  const original = new Error('original');
  await assert.rejects(transaction(pool, async () => { throw original; }), (error) => error === original);
  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.equal(releaseArgs.length, 1);
  assert.notEqual(releaseArgs[0], true);
});

test('transaction rethrows the original error and destroys the client when rollback fails', async () => {
  const { pool, queries, releaseArgs } = fakePool({ failRollback: true });
  const original = new Error('original');
  await assert.rejects(transaction(pool, async () => { throw original; }), (error) => error === original);
  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(releaseArgs, [true]);
});
