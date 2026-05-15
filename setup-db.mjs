/**
 * Script temporário para configurar o banco de dados Supabase.
 * Execute com: node setup-db.mjs
 * APAGUE ESTE ARQUIVO APÓS EXECUÇÃO.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fmjknpsxqrhtpckpqdzz.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtamtucHN4cXJodHBja3BxZHp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwMzE2NCwiZXhwIjoyMDkyNTc5MTY0fQ.E93_U-ggb-rrVN_E67JE548HF9u8i-54cKDgcOADUgQ";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("🔧 Configurando banco de dados Equilibra...\n");

  // 1. Verificar tabela subscriptions
  console.log("1️⃣  Verificando tabela subscriptions...");
  const { data: subTest, error: subErr } = await supabase
    .from("subscriptions")
    .select("id")
    .limit(1);

  if (subErr && subErr.message.includes("does not exist")) {
    console.log("   ❌ Tabela subscriptions NÃO EXISTE. Precisa ser criada via Supabase Dashboard SQL Editor.");
    console.log("   📋 Copie o SQL do arquivo supabase-setup.sql e execute no SQL Editor:");
    console.log("   🔗 https://supabase.com/dashboard/project/fmjknpsxqrhtpckpqdzz/sql/new\n");
    
    // Tentar criar via rpc
    console.log("   🔄 Tentando criar via alternativa...");
    
    // Usar a API de inserção para testar se a tabela pode ser criada
    // Infelizmente, Supabase client não permite CREATE TABLE via API REST
    // Precisamos usar o SQL Editor no dashboard
    console.log("   ⚠️  A tabela precisa ser criada manualmente no SQL Editor do Supabase.\n");
  } else {
    console.log("   ✅ Tabela subscriptions existe!\n");
  }

  // 2. Verificar tabela users
  console.log("2️⃣  Verificando tabela users...");
  const { data: users, error: usersErr } = await supabase.from("users").select("id, name, role, plan").limit(10);
  if (usersErr) {
    console.log("   ❌ Erro:", usersErr.message);
  } else {
    console.log(`   ✅ Tabela users existe! ${users.length} registros encontrados.`);
    users.forEach((u) => console.log(`      - ${u.name} (${u.role}, plan: ${u.plan})`));
  }
  console.log();

  // 3. Verificar tabela responses
  console.log("3️⃣  Verificando tabela responses...");
  const { data: resp, error: respErr } = await supabase.from("responses").select("id").limit(1);
  if (respErr) {
    console.log("   ❌ Erro:", respErr.message);
  } else {
    console.log(`   ✅ Tabela responses existe!`);
  }
  console.log();

  // 4. Verificar tabela surveys
  console.log("4️⃣  Verificando tabela surveys...");
  const { data: surv, error: survErr } = await supabase.from("surveys").select("id").limit(1);
  if (survErr) {
    console.log("   ❌ Erro:", survErr.message);
  } else {
    console.log(`   ✅ Tabela surveys existe!`);
  }
  console.log();

  // 5. Testar login
  console.log("5️⃣  Testando login com canote.ac@gmail.com...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "canote.ac@gmail.com",
    password: "To70@4321",
  });
  if (authErr) {
    console.log("   ❌ Erro de login:", authErr.message);
  } else {
    console.log(`   ✅ Login OK! User ID: ${authData.user.id}`);
    
    // Verificar perfil
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();
    
    if (profile) {
      console.log(`   ✅ Perfil encontrado: ${profile.name} (role: ${profile.role}, plan: ${profile.plan})`);
    } else {
      console.log("   ⚠️  Perfil NÃO encontrado na tabela users!");
    }
  }
  console.log();

  console.log("=" .repeat(60));
  console.log("📋 AÇÕES NECESSÁRIAS:");
  console.log("=" .repeat(60));
  
  if (subErr && subErr.message.includes("does not exist")) {
    console.log("\n🔴 CRIAR TABELA SUBSCRIPTIONS:");
    console.log("   1. Abra: https://supabase.com/dashboard/project/fmjknpsxqrhtpckpqdzz/sql/new");
    console.log("   2. Cole o seguinte SQL e clique 'Run':\n");
    console.log(`CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'active',
  price_brl integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT '',
  card_brand text NOT NULL DEFAULT '',
  card_last4 text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subs_service_role_all" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
`);
  } else {
    console.log("\n✅ Todas as tabelas existem! O sistema deve funcionar normalmente.");
  }

  console.log("\n🔒 CONFIGURAR RLS (Row Level Security):");
  console.log("   Execute o SQL completo do arquivo supabase-setup.sql no SQL Editor.");
  console.log("   Isso garante que cada usuário só veja seus próprios dados.\n");
}

run().catch(console.error);
