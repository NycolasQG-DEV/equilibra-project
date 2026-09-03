"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, UserRole } from "@/types/database";
import { ROLE_ROUTES } from "@/lib/constants";
import { getStoredToken, getStoredUser, setAuthSession, clearAuthSession } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/api-client";

interface UseAuthResult {
  user: User | null;
  loading: boolean;
}

export function useAuth(requiredRole?: UserRole): UseAuthResult {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        clearAuthSession();
        router.replace("/");
        return;
      }

      try {
        const res = await authenticatedFetch("/api/auth/me");
        if (!res.ok) {
          clearAuthSession();
          router.replace("/");
          return;
        }

        const isJson = res.headers.get("content-type")?.includes("application/json");
        if (!isJson) {
          clearAuthSession();
          router.replace("/");
          return;
        }

        const data = await res.json();
        const userData: User = data?.user;

        if (!userData) {
          clearAuthSession();
          router.replace("/");
          return;
        }

        setAuthSession(token, userData);
        const role = userData.role as UserRole;

        // Admin sem plano → mandar para escolher plano
        if (role === "admin" && (!userData.plan || userData.plan === "none") && requiredRole !== undefined) {
          router.replace("/planos");
          return;
        }

        // Verificar papel exigido
        if (requiredRole && role !== requiredRole) {
          router.replace(ROLE_ROUTES[role] ?? "/");
          return;
        }

        setUser(userData);
      } catch (err) {
        clearAuthSession();
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole, router]);

  return { user, loading };
}
