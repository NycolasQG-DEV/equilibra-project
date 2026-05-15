import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Detectar tokens na URL automaticamente (para OAuth callback)
    detectSessionInUrl: true,
    // Manter sessão ativa automaticamente
    autoRefreshToken: true,
    // Persistir sessão entre abas do navegador
    persistSession: true,
  },
});
