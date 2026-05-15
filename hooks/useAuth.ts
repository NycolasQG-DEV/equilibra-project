"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, UserRole } from "@/types/database";
import { ROLE_ROUTES } from "@/lib/constants";

interface UseAuthResult {
  user: User | null;
  loading: boolean;
}

export function useAuth(requiredRole?: UserRole): UseAuthResult {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }

      // Buscar perfil
      let { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      // Se não existe, criar perfil como admin sem plano
      if (!userData) {
        const newProfile = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuário",
          email: session.user.email || "",
          role: "admin" as UserRole,
          plan: "none",
          max_colaboradores: 0,
        };

        const { data: created } = await supabase
          .from("users")
          .upsert([newProfile], { onConflict: "id" })
          .select("*")
          .single();

        if (!created) {
          router.replace("/");
          return;
        }
        userData = created;
      }

      const role = userData.role as UserRole;

      // Admin sem plano → mandar para escolher plano
      if (role === "admin" && userData.plan === "none" && requiredRole !== undefined) {
        router.replace("/planos");
        return;
      }

      // Verificar papel
      if (requiredRole && role !== requiredRole) {
        router.replace(ROLE_ROUTES[role] ?? "/");
        return;
      }

      setUser(userData as User);
      setLoading(false);
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
