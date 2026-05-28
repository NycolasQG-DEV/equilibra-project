"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, UserRole } from "@/types/database";

interface UseAuthResult {
  user: User | null;
  loading: boolean;
}

export function useAuth(requiredRole?: UserRole): UseAuthResult {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    console.log(`🔒 [useAuth] Hook montado. requiredRole: "${requiredRole || "nenhuma"}"`);

    const fetchUserProfile = async (authUserId: string, email: string, metadata: any) => {
      try {
        console.log(`🔒 [useAuth] Buscando perfil no banco para ID: ${authUserId}...`);
        const { data: profile, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUserId)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("🔒 [useAuth] Erro da tabela users:", error);
          throw error;
        }

        if (!profile) {
          console.log("🔒 [useAuth] Perfil não encontrado. Criando perfil padrão...");
          // Criar perfil em tempo real se não existir na tabela users
          const newProfile = {
            id: authUserId,
            name: metadata?.full_name || email.split("@")[0] || "Usuário",
            email: email,
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

          if (insertError) {
            console.error("🔒 [useAuth] Erro ao criar perfil padrão:", insertError);
            throw insertError;
          }
          console.log("🔒 [useAuth] Perfil padrão criado com sucesso:", newProfile);
          return newProfile as unknown as User;
        }

        console.log("🔒 [useAuth] Perfil encontrado com sucesso:", profile);
        return profile as unknown as User;
      } catch (err) {
        console.error("🔒 [useAuth] Erro crítico em fetchUserProfile:", err);
        return null;
      }
    };

    const checkSession = async () => {
      try {
        console.log("🔒 [useAuth] checkSession: Obtendo sessão do Supabase...");
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("🔒 [useAuth] Erro ao obter sessão:", error);
          throw error;
        }

        console.log("🔒 [useAuth] checkSession: Sessão obtida:", session ? `Usuário logado: ${session.user.email}` : "Nenhuma sessão ativa.");

        if (!session || !session.user) {
          if (isMounted) {
            console.log("🔒 [useAuth] checkSession: Sem sessão. Redirecionando para '/'...");
            setUser(null);
            setLoading(false);
            router.push("/");
          }
          return;
        }

        const authUser = session.user;
        const profile = await fetchUserProfile(
          authUser.id, 
          authUser.email || "", 
          authUser.user_metadata
        );

        if (!isMounted) {
          console.log("🔒 [useAuth] checkSession: Componente desmontou durante a busca de perfil.");
          return;
        }

        if (!profile) {
          console.log("🔒 [useAuth] checkSession: Nenhum perfil retornado. Redirecionando para '/'...");
          setUser(null);
          setLoading(false);
          router.push("/");
          return;
        }

        // Validar privilégios/roles requeridas
        console.log(`🔒 [useAuth] checkSession: Validando roles. Requerida: "${requiredRole || "nenhuma"}", Usuário: "${profile.role}"`);
        if (requiredRole && profile.role !== requiredRole) {
          if (requiredRole === "admin" && profile.role === "default") {
            console.log("🔒 [useAuth] checkSession: Redirecionando default -> /colaborador/chat");
            router.push("/colaborador/chat");
          } else if (requiredRole === "dev" && profile.role !== "dev") {
            const dest = profile.role === "admin" ? "/admin" : "/colaborador/chat";
            console.log(`🔒 [useAuth] checkSession: Redirecionando dev -> ${dest}`);
            router.push(dest);
          }
        }

        console.log("🔒 [useAuth] checkSession: Autenticação concluída com sucesso.");
        setUser(profile);
      } catch (err) {
        console.error("🔒 [useAuth] Erro ao checar autenticação:", err);
        if (isMounted) {
          setUser(null);
          router.push("/");
        }
      } finally {
        if (isMounted) {
          console.log("🔒 [useAuth] checkSession: Concluindo estado de carregamento (loading = false).");
          setLoading(false);
        }
      }
    };

    checkSession();

    // Ouvir alterações no status de autenticação (login, logout, refresh de token)
    console.log("🔒 [useAuth] Registrando listener onAuthStateChange...");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔒 [useAuth] onAuthStateChange disparado: Evento "${event}"`);
        if (event === "SIGNED_OUT") {
          if (isMounted) {
            console.log("🔒 [useAuth] onAuthStateChange: SIGNED_OUT. Redirecionando para '/'...");
            setUser(null);
            setLoading(false);
            router.push("/");
          }
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session && session.user) {
            console.log(`🔒 [useAuth] onAuthStateChange: ${event}. Buscando perfil atualizado...`);
            const authUser = session.user;
            const profile = await fetchUserProfile(
              authUser.id,
              authUser.email || "",
              authUser.user_metadata
            );
            if (isMounted) {
              if (profile) {
                console.log("🔒 [useAuth] onAuthStateChange: Perfil atualizado definido.");
                setUser(profile);
              } else {
                console.log("🔒 [useAuth] onAuthStateChange: Perfil não encontrado. Redirecionando para '/'...");
                setUser(null);
                router.push("/");
              }
              console.log("🔒 [useAuth] onAuthStateChange: Concluindo estado de carregamento (loading = false).");
              setLoading(false);
            }
          }
        }
      }
    );

    return () => {
      console.log("🔒 [useAuth] Hook desmontado (cleanup).");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, requiredRole]);

  return { user, loading };
}
