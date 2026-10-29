import { z } from 'zod';

const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const commonSchema = z.object({
  DATABASE_URL: z.string().url().refine((s) => /^postgres(ql)?:/.test(s)),
  LEASE_SECONDS: integer(60, 5, 3600),
  POLL_INTERVAL_MS: integer(2000, 100, 60_000),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = commonSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return parsed.data;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env) {
  const common = readConfig(env);
  const parsed = z.object({
    API_TOKEN: z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
    HOST: z.string().default('127.0.0.1'),
    PORT: integer(3000, 1, 65535),
  }).safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configuration serveur invalide : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return { ...common, ...parsed.data };
}
