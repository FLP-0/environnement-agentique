import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { transaction } from './database.js';

export const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(1).max(10_000),
  priority: z.number().int().min(0).max(100).default(0),
}).strict();
export const idempotencyKey = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/);
export const taskId = z.string().uuid();
export type TaskInput = z.infer<typeof taskInput>;
export type TaskStatus = 'ready' | 'running' | 'result_ready' | 'blocked' | 'cancelled';
export interface Task {
  id: string; title: string; objective: string; priority: number; mode: 'demo';
  status: TaskStatus; attempts: number; lease_token: string | null;
  lease_expires_at: Date | null; result: unknown; created_at: Date; updated_at: Date;
  fingerprint: string; idempotency_key: string;
}
export class ConflictError extends Error {}

async function event(client: PoolClient, id: string, type: string, details: Record<string, unknown> = {}) {
  await client.query('INSERT INTO task_events (task_id, type, details) VALUES ($1, $2, $3)', [id, type, details]);
}

// Lease tokens are fencing credentials. They must never be returned by the API.
export function publicTask(task: Task) {
  const { lease_token: _lease, fingerprint: _fingerprint, idempotency_key: _key, ...visible } = task;
  return visible;
}

export class TaskStore {
  constructor(readonly pool: Pool) {}

  async create(input: TaskInput, key: string) {
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return transaction(this.pool, async (client) => {
      const inserted = await client.query<Task>(`INSERT INTO tasks
        (id, idempotency_key, fingerprint, title, objective, priority)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
      [randomUUID(), key, fingerprint, input.title, input.objective, input.priority]);
      const task = inserted.rows[0];
      if (task) {
        await event(client, task.id, 'created', { mode: 'demo' });
        return { task, created: true };
      }
      const existing = (await client.query<Task>('SELECT * FROM tasks WHERE idempotency_key = $1', [key])).rows[0];
      if (!existing || existing.fingerprint !== fingerprint) throw new ConflictError('Clé déjà utilisée pour une autre tâche.');
      return { task: existing, created: false };
    });
  }

  async get(id: string) {
    return (await this.pool.query<Task>('SELECT * FROM tasks WHERE id = $1', [id])).rows[0];
  }

  async list(limit: number, offset: number) {
    return (await this.pool.query<Task>('SELECT * FROM tasks ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2', [limit, offset])).rows;
  }

  async events(id: string, after: string) {
    return (await this.pool.query(`SELECT id::text, type, details, created_at FROM task_events
      WHERE task_id = $1 AND id > $2::bigint ORDER BY id LIMIT 100`, [id, after])).rows;
  }

  async claim(leaseSeconds: number) {
    return transaction(this.pool, async (client) => {
      const claimed = await client.query<Task>(`WITH candidate AS (
        SELECT id FROM tasks WHERE status = 'ready' ORDER BY priority DESC, created_at, id
        FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE tasks SET status = 'running', attempts = attempts + 1, lease_token = $1,
        lease_expires_at = clock_timestamp() + $2 * interval '1 second', updated_at = clock_timestamp()
        FROM candidate WHERE tasks.id = candidate.id RETURNING tasks.*`, [randomUUID(), leaseSeconds]);
      const task = claimed.rows[0];
      if (task) await event(client, task.id, 'claimed', { attempt: task.attempts });
      return task;
    });
  }

  async heartbeat(id: string, token: string, leaseSeconds: number) {
    const result = await this.pool.query(`UPDATE tasks SET
      lease_expires_at = clock_timestamp() + $3 * interval '1 second', updated_at = clock_timestamp()
      WHERE id = $1 AND lease_token = $2 AND status = 'running' AND lease_expires_at > clock_timestamp()`,
    [id, token, leaseSeconds]);
    return result.rowCount === 1;
  }

  async finish(id: string, token: string, result: unknown, status: 'result_ready' | 'blocked' = 'result_ready') {
    return transaction(this.pool, async (client) => {
      const updated = await client.query<Task>(`UPDATE tasks SET status = $4, result = $3,
        lease_token = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
        WHERE id = $1 AND lease_token = $2 AND status = 'running'
          AND lease_expires_at > clock_timestamp() RETURNING *`, [id, token, result, status]);
      const task = updated.rows[0];
      if (task) await event(client, task.id, status);
      return task;
    });
  }

  async cancel(id: string) {
    return transaction(this.pool, async (client) => {
      const task = (await client.query<Task>('SELECT * FROM tasks WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!task) return undefined;
      if (task.status === 'cancelled') return task;
      if (task.status === 'result_ready') throw new ConflictError('Le résultat est déjà enregistré.');
      const updated = await client.query<Task>(`UPDATE tasks SET status = 'cancelled', lease_token = NULL,
        lease_expires_at = NULL, updated_at = clock_timestamp() WHERE id = $1 RETURNING *`, [id]);
      await event(client, id, 'cancelled');
      return updated.rows[0];
    });
  }

  async blockExpired() {
    const result = await this.pool.query(`WITH expired AS (
      UPDATE tasks SET status = 'blocked', lease_token = NULL, lease_expires_at = NULL,
        updated_at = clock_timestamp(), result = '{"reason":"lease_expired","needsReview":true}'::jsonb
      WHERE status = 'running' AND lease_expires_at <= clock_timestamp() RETURNING id
    ) INSERT INTO task_events (task_id, type, details)
      SELECT id, 'lease_expired', '{"needsReview":true}'::jsonb FROM expired RETURNING task_id`);
    return result.rowCount ?? 0;
  }
}
