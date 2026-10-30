-- ====================================================================
-- EQUILIBRA — SCRIPT DE INICIALIZAÇÃO DO SCHEMA SUPABASE (POSTGRESQL)
-- Execute este script no SQL Editor do seu projeto Supabase
-- ====================================================================

-- 1. Criação das tabelas para as 9 coleções do sistema
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

-- 2. Índices para performance e consultas rápidas por empresa e status
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

-- 3. Desativa RLS para acesso irrestrito pelo backend via Service Role Key
alter table accounts disable row level security;
alter table members disable row level security;
alter table groups disable row level security;
alter table surveys disable row level security;
alter table invitations disable row level security;
alter table responses disable row level security;
alter table reports disable row level security;
alter table sessions disable row level security;
alter table management disable row level security;
