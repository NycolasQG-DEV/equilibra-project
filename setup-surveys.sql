-- ============================================================
-- EQUILIBRA — Tabelas para Pesquisas Agendáveis, Chat e NR-1
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fmjknpsxqrhtpckpqdzz/sql/new
-- ============================================================

-- 1. SURVEYS — Pesquisas criadas pelo admin
-- ============================================================
DROP TABLE IF EXISTS public.surveys CASCADE;

CREATE TABLE public.surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surveys_admin_select" ON public.surveys
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "surveys_admin_insert" ON public.surveys
  FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "surveys_admin_update" ON public.surveys
  FOR UPDATE USING (auth.uid() = admin_id);

CREATE POLICY "surveys_admin_delete" ON public.surveys
  FOR DELETE USING (auth.uid() = admin_id);

CREATE POLICY "surveys_service_role_all" ON public.surveys
  FOR ALL USING (auth.role() = 'service_role');

-- Colaboradores podem ler pesquisas ativas que foram atribuídas a eles
CREATE POLICY "surveys_colab_select" ON public.surveys
  FOR SELECT USING (
    is_active = true
    AND id IN (
      SELECT survey_id FROM public.survey_assignments
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_surveys_admin_id ON public.surveys(admin_id);
CREATE INDEX idx_surveys_active ON public.surveys(is_active);

-- 2. SURVEY_ASSIGNMENTS — Vincula pesquisas a colaboradores
-- ============================================================
CREATE TABLE public.survey_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_colab_select" ON public.survey_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "assignments_colab_update" ON public.survey_assignments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "assignments_admin_select" ON public.survey_assignments
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "assignments_service_role_all" ON public.survey_assignments
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_assignments_user_id ON public.survey_assignments(user_id);
CREATE INDEX idx_assignments_survey_id ON public.survey_assignments(survey_id);
CREATE INDEX idx_assignments_status ON public.survey_assignments(status);

-- 3. CHAT_MESSAGES — Histórico do chat do colaborador
-- ============================================================
CREATE TABLE public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('user', 'ai')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_own_select" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "chat_own_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_own_delete" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "chat_service_role_all" ON public.chat_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_chat_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_session ON public.chat_messages(session_id);

-- 4. ADMIN_CHAT_MESSAGES — Chat IA exclusivo do admin
-- ============================================================
CREATE TABLE public.admin_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'ai')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_chat_own_select" ON public.admin_chat_messages
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "admin_chat_own_insert" ON public.admin_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "admin_chat_own_delete" ON public.admin_chat_messages
  FOR DELETE USING (auth.uid() = admin_id);

CREATE POLICY "admin_chat_service_role_all" ON public.admin_chat_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_admin_chat_admin_id ON public.admin_chat_messages(admin_id);

-- 5. Adicionar survey_id na tabela responses (se não existir)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'responses' AND column_name = 'survey_id'
  ) THEN
    ALTER TABLE public.responses ADD COLUMN survey_id uuid REFERENCES public.surveys(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON public.responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_admin_id ON public.responses(admin_id);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON public.responses(user_id);

-- ============================================================
-- PRONTO! Todas as tabelas foram criadas.
-- ============================================================
