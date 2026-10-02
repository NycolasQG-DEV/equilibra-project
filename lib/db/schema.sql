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

CREATE TABLE IF NOT EXISTS survey_assignments (
  id VARCHAR(64) PRIMARY KEY,
  survey_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  admin_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assignments_user (user_id),
  INDEX idx_assignments_survey (survey_id),
  INDEX idx_assignments_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  admin_id VARCHAR(64) NULL,
  survey_id VARCHAR(64) NULL,
  survey_type VARCHAR(100) NULL,
  answers JSON NULL,
  score INT NOT NULL DEFAULT 0,
  risk_level ENUM('baixo', 'medio', 'alto') NOT NULL DEFAULT 'baixo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_responses_user (user_id),
  INDEX idx_responses_admin (admin_id),
  INDEX idx_responses_survey (survey_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  role ENUM('user', 'ai') NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user (user_id),
  INDEX idx_chat_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL,
  role ENUM('user', 'ai') NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_chat_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  plan ENUM('none', 'starter', 'professional', 'enterprise') NOT NULL DEFAULT 'none',
  status ENUM('active', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  price_brl INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'pix',
  card_brand VARCHAR(50) NULL,
  card_last4 VARCHAR(10) NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscriptions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS survey_links (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL DEFAULT 'all',
  role VARCHAR(100) NULL,
  admin_id VARCHAR(64) NULL,
  admin_name VARCHAR(255) NULL,
  admin_email VARCHAR(255) NULL,
  batch_id VARCHAR(64) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMP NULL,
  closed_by_session_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_survey_links_admin_id (admin_id),
  INDEX idx_survey_links_active (active),
  INDEX idx_survey_links_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  link_id VARCHAR(64) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  profile JSON NULL,
  lgpd_consent JSON NULL,
  history JSON NULL,
  current_step_data JSON NULL,
  report_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_sessions_link_id (link_id),
  INDEX idx_sessions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  link_id VARCHAR(64) NULL,
  sector VARCHAR(100) NULL,
  profile JSON NULL,
  risk_level VARCHAR(50) NULL,
  confidence_score INT NOT NULL DEFAULT 0,
  dimensions JSON NULL,
  action_plan JSON NULL,
  full_report JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_session (session_id),
  INDEX idx_reports_link (link_id),
  INDEX idx_reports_sector (sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(64) NULL,
  performed_by VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NULL,
  legal_basis VARCHAR(255) NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS management_batches (
 id VARCHAR(64) PRIMARY KEY, admin_id VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL,
 sector VARCHAR(100) NOT NULL, context TEXT NOT NULL, protocol_version VARCHAR(100) NOT NULL,
 color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP NULL,
 INDEX idx_batch_owner(admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS management_actions (
 id VARCHAR(64) PRIMARY KEY, admin_id VARCHAR(64) NOT NULL, batch_id VARCHAR(64) NOT NULL,
 dimension_id VARCHAR(100) NOT NULL, title VARCHAR(255) NOT NULL, plan JSON NOT NULL,
 owner VARCHAR(150) NOT NULL, due_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'planned',
 evidence TEXT NULL, completed_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY idx_unique_action(admin_id,batch_id,dimension_id), INDEX idx_action_owner(admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS request_limits (
 id CHAR(64) PRIMARY KEY, hits INT NOT NULL, expires_at TIMESTAMP NOT NULL,
 INDEX idx_limit_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
