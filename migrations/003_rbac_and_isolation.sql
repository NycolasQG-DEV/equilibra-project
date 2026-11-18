-- ====================================================================
-- MIGRATION 003: Multi-Tenant RBAC & Isolation Policies (PostgreSQL)
-- ====================================================================

-- 1. Habilitar RLS em todas as tabelas relacionais
alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table establishments enable row level security;
alter table departments enable row level security;
alter table workers enable row level security;
alter table risk_assessments enable row level security;
alter table action_items enable row level security;
alter table action_evidences enable row level security;
alter table audit_log enable row level security;

-- 2. Políticas de isolamento por Tenant para Service Role (Backend Confiável)
create policy "sr_all_tenants" on tenants for all to service_role using (true) with check (true);
create policy "sr_all_tenant_users" on tenant_users for all to service_role using (true) with check (true);
create policy "sr_all_establishments" on establishments for all to service_role using (true) with check (true);
create policy "sr_all_departments" on departments for all to service_role using (true) with check (true);
create policy "sr_all_workers" on workers for all to service_role using (true) with check (true);
create policy "sr_all_risk_assessments" on risk_assessments for all to service_role using (true) with check (true);
create policy "sr_all_action_items" on action_items for all to service_role using (true) with check (true);
create policy "sr_all_action_evidences" on action_evidences for all to service_role using (true) with check (true);
create policy "sr_all_audit_log" on audit_log for all to service_role using (true) with check (true);

-- 3. Políticas de Usuários Autenticados com Tenant Context (JWT Claims)
-- Usuários autenticados só podem ler/gravar dados pertencentes estritamente ao seu tenant
create policy "auth_tenant_users_self" on tenant_users for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_establishments_tenant" on establishments for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_departments_tenant" on departments for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_workers_tenant" on workers for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_risk_assessments_tenant" on risk_assessments for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_action_items_tenant" on action_items for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_action_evidences_tenant" on action_evidences for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "auth_audit_log_tenant" on audit_log for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 4. Bloqueio absoluto para usuários anônimos (anon)
revoke all on table tenants, tenant_users, establishments, departments, workers, risk_assessments, action_items, action_evidences, audit_log from anon;

-- 5. Concessão explícita ao service_role
grant all on table tenants, tenant_users, establishments, departments, workers, risk_assessments, action_items, action_evidences, audit_log to service_role;
