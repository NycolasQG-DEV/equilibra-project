-- Produto de pesquisas anônimas. O backend usa a conexão PostgreSQL do servidor.
CREATE TABLE IF NOT EXISTS product_organizations (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_organizations_owner_idx ON product_organizations(owner_user_id);

CREATE TABLE IF NOT EXISTS product_templates (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES product_organizations(id),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('master', 'custom', 'sector_profile')),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL,
  recurrence_months INTEGER CHECK (recurrence_months BETWEEN 1 AND 24),
  next_run_at TIMESTAMPTZ,
  invites_per_run INTEGER NOT NULL DEFAULT 10 CHECK (invites_per_run BETWEEN 1 AND 10000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_templates_org_idx ON product_templates(organization_id);
CREATE INDEX IF NOT EXISTS product_templates_due_idx ON product_templates(next_run_at) WHERE active AND recurrence_months IS NOT NULL;
ALTER TABLE product_templates DROP CONSTRAINT IF EXISTS product_templates_kind_check;
ALTER TABLE product_templates ADD CONSTRAINT product_templates_kind_check CHECK (kind IN ('master', 'custom', 'sector_profile'));

CREATE TABLE IF NOT EXISTS product_runs (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES product_organizations(id),
  template_id VARCHAR(64) NOT NULL REFERENCES product_templates(id),
  title VARCHAR(160) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  questions JSONB NOT NULL,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  cycle_number INTEGER,
  cycle_group VARCHAR(64),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_runs_org_idx ON product_runs(organization_id, opened_at DESC);
ALTER TABLE product_runs ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE product_runs ADD COLUMN IF NOT EXISTS cycle_number INTEGER;
ALTER TABLE product_runs ADD COLUMN IF NOT EXISTS cycle_group VARCHAR(64);

CREATE TABLE IF NOT EXISTS product_invites (
  token_hash CHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES product_runs(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_invites_run_idx ON product_invites(run_id);

CREATE TABLE IF NOT EXISTS product_answers (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES product_runs(id),
  answers JSONB NOT NULL,
  sentiment JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_answers_run_idx ON product_answers(run_id);

ALTER TABLE product_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON product_organizations, product_templates, product_runs, product_invites, product_answers FROM anon, authenticated;
