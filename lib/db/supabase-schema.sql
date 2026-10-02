-- ══════════════════════════════════════════════════════════════════
-- SCHEMA OFICIAL SUPABASE POSTGRESQL - EQUILIBRA SAAS
-- ══════════════════════════════════════════════════════════════════

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  plan VARCHAR(50) NOT NULL DEFAULT 'none',
  max_colaboradores INT NOT NULL DEFAULT 5,
  admin_id VARCHAR(64) NULL,
  cargo VARCHAR(100) NULL,
  setor VARCHAR(100) NULL,
  observacao TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Migrações de colunas para users caso já exista
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_colaboradores INT NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setor VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS observacao TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_admin_id ON users(admin_id);

-- 2. Tabela surveys
CREATE TABLE IF NOT EXISTS surveys (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  questions JSONB NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ends_at TIMESTAMP WITH TIME ZONE NULL,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS admin_id VARCHAR(64) NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS questions JSONB NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_surveys_admin_id ON surveys(admin_id);

-- 3. Tabela survey_assignments
CREATE TABLE IF NOT EXISTS survey_assignments (
  id VARCHAR(64) PRIMARY KEY,
  survey_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  admin_id VARCHAR(64) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON survey_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_survey ON survey_assignments(survey_id);
CREATE INDEX IF NOT EXISTS idx_assignments_admin ON survey_assignments(admin_id);

-- 4. Tabela responses
CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  admin_id VARCHAR(64) NULL,
  survey_id VARCHAR(64) NULL,
  survey_type VARCHAR(100) NULL,
  answers JSONB NULL,
  score INT NOT NULL DEFAULT 0,
  risk_level VARCHAR(50) NOT NULL DEFAULT 'baixo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_admin ON responses(admin_id);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);

-- 5. Tabela chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);

-- 6. Tabela admin_chat_messages
CREATE TABLE IF NOT EXISTS admin_chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_admin ON admin_chat_messages(admin_id);

-- 7. Tabela subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'none',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  price_brl INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'pix',
  card_brand VARCHAR(50) NULL,
  card_last4 VARCHAR(10) NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- 8. Tabela survey_links
CREATE TABLE IF NOT EXISTS survey_links (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT 'Nova Campanha de Pesquisa',
  sector VARCHAR(100) NOT NULL DEFAULT 'all',
  role VARCHAR(100) NULL,
  admin_id VARCHAR(64) NULL,
  admin_name VARCHAR(255) NULL,
  admin_email VARCHAR(255) NULL,
  batch_id VARCHAR(64) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMP WITH TIME ZONE NULL,
  closed_by_session_id VARCHAR(64) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_survey_links_admin_id ON survey_links(admin_id);
CREATE INDEX IF NOT EXISTS idx_survey_links_active ON survey_links(active);
CREATE INDEX IF NOT EXISTS idx_survey_links_batch ON survey_links(batch_id);

-- 9. Tabela sessions
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  link_id VARCHAR(64) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  profile JSONB NULL,
  lgpd_consent JSONB NULL,
  history JSONB NULL,
  current_step_data JSONB NULL,
  report_id VARCHAR(64) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_link_id ON sessions(link_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- 10. Tabela reports
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  link_id VARCHAR(64) NULL,
  sector VARCHAR(100) NULL,
  profile JSONB NULL,
  risk_level VARCHAR(50) NULL,
  confidence_score INT NOT NULL DEFAULT 0,
  dimensions JSONB NULL,
  action_plan JSONB NULL,
  full_report JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_link ON reports(link_id);
CREATE INDEX IF NOT EXISTS idx_reports_sector ON reports(sector);

-- 11. Tabela audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(64) NULL,
  performed_by VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NULL,
  legal_basis VARCHAR(255) NULL,
  details TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- 12. Tabela management_batches
CREATE TABLE IF NOT EXISTS management_batches (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  context TEXT NOT NULL,
  protocol_version VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_owner ON management_batches(admin_id);

-- 13. Tabela management_actions
CREATE TABLE IF NOT EXISTS management_actions (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  batch_id VARCHAR(64) NOT NULL,
  dimension_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  plan JSONB NOT NULL,
  owner VARCHAR(150) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  evidence TEXT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT idx_unique_action UNIQUE (admin_id, batch_id, dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_action_owner ON management_actions(admin_id);

-- 14. Tabela request_limits
CREATE TABLE IF NOT EXISTS request_limits (
  id CHAR(64) PRIMARY KEY,
  hits INT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_limit_expiry ON request_limits(expires_at);
