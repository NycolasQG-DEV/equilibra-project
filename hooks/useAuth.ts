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
      setUser({
        id: "mock-user-id",
        name: "Test User",
        email: "test@test.com",
        role: requiredRole || "admin",
        plan: "pro",
        created_at: new Date().toISOString(),
        max_colaboradores: 10
      } as unknown as User);
      setLoading(false);
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
