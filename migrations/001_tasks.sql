CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  objective text NOT NULL CHECK (length(objective) BETWEEN 1 AND 10000),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  mode text NOT NULL DEFAULT 'demo' CHECK (mode = 'demo'),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'running', 'result_ready', 'blocked', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'running') = (lease_token IS NOT NULL)),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);

CREATE INDEX tasks_ready ON tasks (priority DESC, created_at, id) WHERE status = 'ready';
CREATE INDEX tasks_expired ON tasks (lease_expires_at) WHERE status = 'running';

CREATE TABLE task_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id),
  type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_events_task ON task_events (task_id, id);
