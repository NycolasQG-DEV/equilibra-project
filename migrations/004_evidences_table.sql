-- ====================================================================
-- MIGRATION 004: Tabela evidences para coleta de evidências
-- ====================================================================

create table if not exists evidences (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Índices para busca por tenant e por pesquisa
create index if not exists idx_evidences_account on evidences ((data->>'accountId'));
create index if not exists idx_evidences_survey  on evidences ((data->>'surveyId'));

-- Row Level Security
alter table evidences enable row level security;

-- Política: service_role tem acesso irrestrito (backend usa service_role key)
create policy if not exists "service_role_evidences_all"
  on evidences
  for all
  to service_role
  using (true)
  with check (true);
