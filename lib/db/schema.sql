-- ══════════════════════════════════════════════════════════════════
-- SCHEMA OFICIAL SQL - EQUILIBRA SAAS (MySQL 8.0+)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  role ENUM('default', 'dev', 'admin') NOT NULL DEFAULT 'admin',
  plan ENUM('none', 'starter', 'professional', 'enterprise') NOT NULL DEFAULT 'none',
  max_colaboradores INT NOT NULL DEFAULT 5,
  admin_id VARCHAR(64) NULL,
  cargo VARCHAR(100) NULL,
  setor VARCHAR(100) NULL,
  observacao TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS surveys (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  questions JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_surveys_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS survey_links (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  campaign_title VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL DEFAULT 'Geral',
  cargo VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_survey_links_admin_id (admin_id),
  INDEX idx_survey_links_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS survey_sessions (
  id VARCHAR(64) PRIMARY KEY,
  survey_link_id VARCHAR(64) NULL,
  admin_id VARCHAR(64) NOT NULL,
  respondent_name VARCHAR(255) NOT NULL DEFAULT 'Colaborador Anônimo',
  respondent_email VARCHAR(255) NULL,
  respondent_sector VARCHAR(100) NOT NULL DEFAULT 'Geral',
  respondent_cargo VARCHAR(100) NULL,
  status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 6,
  is_voice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_sessions_admin_id (admin_id),
  INDEX idx_sessions_link_id (survey_link_id),
  INDEX idx_sessions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_answers (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  step_number INT NOT NULL,
  dimension VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  numeric_score INT NULL,
  audio_url TEXT NULL,
  sentiment VARCHAR(50) NULL,
  risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_answers_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL UNIQUE,
  admin_id VARCHAR(64) NOT NULL,
  protocol VARCHAR(64) NOT NULL UNIQUE,
  sector VARCHAR(100) NOT NULL DEFAULT 'Geral',
  cargo VARCHAR(100) NULL,
  executive_summary TEXT NOT NULL,
  risk_score INT NOT NULL DEFAULT 0,
  overall_risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  dimensions_data JSON NOT NULL,
  action_plan_5w2h JSON NOT NULL,
  raw_ai_analysis JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_admin_id (admin_id),
  INDEX idx_reports_protocol (protocol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuário Padrão de Demonstração (teste.teste@teste.teste / testeteste)
INSERT INTO users (id, name, email, password_hash, role, plan, max_colaboradores)
VALUES (
  'usr_demo_admin_default',
  'Admin Teste Equilibra',
  'teste.teste@teste.teste',
  '$2b$10$Wp8Ro5cVHxv4GRuLBVfou.tHXozBj3JBOvaD2RcGj.UXqxyyEQcKK',
  'admin',
  'professional',
  100
)
ON DUPLICATE KEY UPDATE
  password_hash = '$2b$10$Wp8Ro5cVHxv4GRuLBVfou.tHXozBj3JBOvaD2RcGj.UXqxyyEQcKK',
  plan = 'professional';
