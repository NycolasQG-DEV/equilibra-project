"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/types/database";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Autenticando sessão...");
  const [errorText, setErrorText] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Evitar execução duplicada no React Strict Mode
    if (processedRef.current) return;
    processedRef.current = true;

    const handleAuthCallback = async () => {
      try {
        setStatusText("Verificando credenciais...");
        
        // 1. Obter a sessão e o usuário atual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!session || !session.user) {
          throw new Error("Nenhuma sessão de usuário ativa encontrada. Por favor, tente fazer login novamente.");
        }

        const authUser = session.user;
        setStatusText("Sincronizando seu perfil...");

        // 2. Verificar se o perfil já existe na tabela pública 'users'
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          // PGRST116 significa que nenhum registro foi encontrado (o que é esperado para novos cadastros)
          throw profileError;
        }

        let userRole: UserRole = "default";

        if (!profile) {
          setStatusText("Criando sua conta na plataforma...");
          // Criar um novo perfil na tabela pública se for o primeiro login
          const newProfile = {
            id: authUser.id,
            name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Usuário",
            email: authUser.email || "",
            role: "default" as UserRole,
            plan: "none",
            max_colaboradores: 5,
            cnpj: "",
            company_name: "",
            created_at: new Date().toISOString(),
          };

          const { error: insertError } = await supabase
            .from("users")
            .insert([newProfile]);

          if (insertError) throw insertError;
        } else {
          userRole = profile.role as UserRole;
        }

        setStatusText("Redirecionando para o painel...");
        
        // 3. Redirecionar baseado na Role do usuário
        if (userRole === "admin") {
          router.push("/admin");
        } else if (userRole === "dev") {
          router.push("/dev");
        } else {
          router.push("/colaborador/chat");
        }
      } catch (err: any) {
        console.error("Erro no callback de autenticação:", err);
        setErrorText(err?.message || "Ocorreu um erro inesperado ao processar o seu login.");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6FB] px-4 font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-purple-200 bg-white p-8 text-center shadow-2xl sm:p-12">
        
        {/* Logo/Ícone do Equilibra */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-[#260054] shadow-md">
          <span className="material-symbols-outlined text-3xl font-semibold">
            {errorText ? "error" : "vpn_key"}
          </span>
        </div>

        {!errorText ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#260054]">
              Conectando ao Equilibra
            </h2>
            
            {/* Spinner Animado Premium */}
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
              <div className="absolute h-full w-full rounded-full border-4 border-purple-100"></div>
              <div className="absolute h-full w-full animate-spin rounded-full border-4 border-[#3d1a6e] border-t-transparent"></div>
            </div>

            <p className="text-sm font-medium text-[#4a4550] animate-pulse">
              {statusText}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-red-600">
              Falha na Autenticação
            </h2>
            <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
              {errorText}
            </p>
            
            <button
              onClick={() => router.push("/")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3d1a6e] py-4 font-bold text-white transition-all hover:bg-[#2D1052] hover:shadow-lg"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
