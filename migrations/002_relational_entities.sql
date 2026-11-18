-- ====================================================================
-- MIGRATION 002: Relational Multi-Tenant Entities (PostgreSQL / Supabase)
-- ====================================================================

-- 1. Tenants (Empresas Clientes / Contas Pagantes)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text, -- CNPJ
  plan text default 'standard' not null,
  status text default 'active' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_tenants_status on tenants(status);
create index if not exists idx_tenants_tax_id on tenants(tax_id);

-- 2. Usuários Administrativos e Membresias
create table if not exists tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  name text not null,
  password_hash text not null,
  role text default 'admin' not null, -- owner, admin, technical_responsible, viewer
  professional_id text, -- CRM, CREA, CRP para responsáveis técnicos
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique (tenant_id, email)
);

create index if not exists idx_tenant_users_lookup on tenant_users(tenant_id, email);

-- 3. Estabelecimentos e Unidades Operacionais (NR-1)
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text,
  cnae text,
  risk_grade int default 2, -- Grau de risco 1 a 4
  address jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_establishments_tenant on establishments(tenant_id);

-- 4. Grupos de Trabalho e Setores
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  establishment_id uuid references establishments(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_departments_tenant on departments(tenant_id);

-- 5. Trabalhadores Mapeados (População de Escuta)
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null,
  email text,
  phone_hash text,
  active boolean default true not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_workers_tenant on workers(tenant_id);
create index if not exists idx_workers_dept on workers(tenant_id, department_id);

-- 6. Avaliações de Riscos Psicossociais (NR-1 / PGR)
create table if not exists risk_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  report_id text not null,
  factor_key text not null,
  title text not null,
  context text,
  existing_measures text,
  decision text,
  classification text default 'pending' not null, -- pending, low, medium, high
  status text default 'investigating' not null, -- investigating, evaluated, dismissed
  technical_responsible_id uuid references tenant_users(id),
  version int default 1 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_risk_assessments_tenant on risk_assessments(tenant_id);
create index if not exists idx_risk_assessments_report on risk_assessments(tenant_id, report_id);
create index if not exists idx_risk_assessments_status on risk_assessments(tenant_id, status);

-- 7. Planos de Ação e Medidas Preventivas (5W2H)
create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  assessment_id uuid not null references risk_assessments(id) on delete cascade,
  title text not null,
  owner text not null,
  due_date date not null,
  review_date date not null,
  priority text default 'medium' not null,
  status text default 'planned' not null, -- planned, in_progress, implemented, effective, ineffective, cancelled
  success_criteria text not null,
  description text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_action_items_tenant on action_items(tenant_id);
create index if not exists idx_action_items_assessment on action_items(assessment_id);
create index if not exists idx_action_items_status on action_items(tenant_id, status);
create index if not exists idx_action_items_dates on action_items(tenant_id, due_date, review_date);

-- 8. Evidências de Implantação e Auditoria
create table if not exists action_evidences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  action_id uuid not null references action_items(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  description text,
  uploaded_by uuid references tenant_users(id),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_action_evidences_action on action_evidences(action_id);

-- 9. Trilha de Auditoria Imutável (Audit Log)
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_log_tenant on audit_log(tenant_id, created_at desc);
