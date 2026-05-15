"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/types/database";
import { ROLE_ROUTES } from "@/lib/constants";

/**
 * This page handles the OAuth callback from Google.
 * After Supabase redirects back with tokens in the URL hash,
 * the Supabase client automatically picks them up.
 * We just need to wait for the session, create the user profile if needed,
 * then redirect appropriately.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Give Supabase client time to process the URL hash tokens
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // If no session after callback, wait a bit and retry (tokens may still be processing)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { data: retry } = await supabase.auth.getSession();

        if (!retry.session) {
          router.replace("/");
          return;
        }

        const dest = await ensureProfileAndGetRoute(retry.session.user);
        router.replace(dest);
        return;
      }

      const dest = await ensureProfileAndGetRoute(session.user);
      router.replace(dest);
    };

    const ensureProfileAndGetRoute = async (
      user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
    ): Promise<string> => {
      // Check if profile already exists
      const { data: existing } = await supabase
        .from("users")
        .select("id, plan, role")
        .eq("id", user.id)
        .single();

      if (!existing) {
        // Create profile for new Google user
        await supabase.from("users").upsert([{
          id: user.id,
          name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Usuário",
          email: user.email || "",
          role: "admin",
          plan: "none",
          max_colaboradores: 0,
        }], { onConflict: "id" });
        // New user → choose a plan
        return "/planos";
      }

      const role = existing.role as UserRole;

      // Admin without a plan → choose a plan
      if (role === "admin" && existing.plan === "none") {
        return "/planos";
      }

      // Redirect to the role-based dashboard
      return ROLE_ROUTES[role] ?? "/";
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6FB]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
        <p className="text-sm font-semibold text-[#260054]">Autenticando com Google...</p>
      </div>
    </div>
  );
}
