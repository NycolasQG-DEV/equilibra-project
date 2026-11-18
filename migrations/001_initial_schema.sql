-- ====================================================================
-- MIGRATION 001: Initial Multi-Tenant Schema & Storage Collections
-- ====================================================================

create table if not exists accounts (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists members (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists groups (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists surveys (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists invitations (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists responses (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists reports (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists sessions (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists management (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Índices essenciais de chave de tenant e busca
create index if not exists idx_accounts_email on accounts ((data->>'email'));
create index if not exists idx_members_account on members ((data->>'accountId'));
create index if not exists idx_groups_account on groups ((data->>'accountId'));
create index if not exists idx_surveys_account on surveys ((data->>'accountId'));
create index if not exists idx_surveys_status on surveys ((data->>'status'));
create index if not exists idx_invitations_survey on invitations ((data->>'surveyId'));
create index if not exists idx_invitations_token on invitations ((data->>'tokenHash'));
create index if not exists idx_responses_survey on responses ((data->>'surveyId'));
create index if not exists idx_reports_survey on reports ((data->>'surveyId'));
create index if not exists idx_sessions_token on sessions ((data->>'tokenHash'));

-- Row Level Security (RLS)
alter table accounts enable row level security;
alter table members enable row level security;
alter table groups enable row level security;
alter table surveys enable row level security;
alter table invitations enable row level security;
alter table responses enable row level security;
alter table reports enable row level security;
alter table sessions enable row level security;
alter table management enable row level security;
