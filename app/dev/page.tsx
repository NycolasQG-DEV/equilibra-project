"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function DevPage() {
  const router = useRouter();
  const { user, loading } = useAuth("dev");

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F8F6FB] px-8">
      <span className="text-2xl font-bold text-purple-900">EQUILIBRA — Dev</span>
      <div className="rounded-2xl border border-purple-100 bg-white p-10 text-center shadow-md">
        <div className="mb-4 flex justify-center">
          <span className="material-symbols-outlined text-5xl text-[#3d1a6e]">code</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[#260054]">Painel do Desenvolvedor</h1>
        <p className="mb-6 text-[#4a4550]">
          Bem-vindo, <strong>{user?.name}</strong>. Esta tela está em construção.
        </p>
        <button
          onClick={handleLogout}
          className="mx-auto flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
          type="button"
        >
          <span className="material-symbols-outlined text-base">logout</span>Sair
        </button>
      </div>
    </div>
  );
}
