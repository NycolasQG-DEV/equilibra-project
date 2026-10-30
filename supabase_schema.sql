-- ====================================================================
-- EQUILIBRA — SCRIPT DE SEGURANÇA E ROW LEVEL SECURITY (RLS) SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/thfribpqnhmnpkgltxnt/sql/new
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

-- 2. Índices de alta performance e integridade referencial
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

-- 3. Habilitação de ROW LEVEL SECURITY (RLS) em TODAS as tabelas
-- Garante isolamento estrito contra acesso não autorizado via API pública
alter table accounts enable row level security;
alter table members enable row level security;
alter table groups enable row level security;
alter table surveys enable row level security;
alter table invitations enable row level security;
alter table responses enable row level security;
alter table reports enable row level security;
alter table sessions enable row level security;
alter table management enable row level security;

-- 4. Remoção de políticas antigas para evitar duplicidade
drop policy if exists "service_role_accounts" on accounts;
drop policy if exists "service_role_members" on members;
drop policy if exists "service_role_groups" on groups;
drop policy if exists "service_role_surveys" on surveys;
drop policy if exists "service_role_invitations" on invitations;
drop policy if exists "service_role_responses" on responses;
drop policy if exists "service_role_reports" on reports;
drop policy if exists "service_role_sessions" on sessions;
drop policy if exists "service_role_management" on management;

-- 5. Criação de Políticas RLS para Service Role (Backend Seguro)
-- O backend autentica com a chave de serviço e tem acesso total gerenciado
create policy "service_role_accounts" on accounts for all to service_role using (true) with check (true);
create policy "service_role_members" on members for all to service_role using (true) with check (true);
create policy "service_role_groups" on groups for all to service_role using (true) with check (true);
create policy "service_role_surveys" on surveys for all to service_role using (true) with check (true);
create policy "service_role_invitations" on invitations for all to service_role using (true) with check (true);
create policy "service_role_responses" on responses for all to service_role using (true) with check (true);
create policy "service_role_reports" on reports for all to service_role using (true) with check (true);
create policy "service_role_sessions" on sessions for all to service_role using (true) with check (true);
create policy "service_role_management" on management for all to service_role using (true) with check (true);

-- 6. Revogação de acesso público direto (anon e authenticated via PostgREST)
-- Bloqueia qualquer tentativa de consulta direta por terceiros que tentem usar a chave pública
revoke all on table accounts, members, groups, surveys, invitations, responses, reports, sessions, management from anon;
revoke all on table accounts, members, groups, surveys, invitations, responses, reports, sessions, management from authenticated;

-- Garante que o service_role tem permissão total de CRUD
grant all on table accounts, members, groups, surveys, invitations, responses, reports, sessions, management to service_role;
