"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function AdminTopBar({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-[#260054]">Configurações</h1>
        <p className="text-xs text-[#4a4550]">Empresa, pesquisas e integrações</p>
      </div>
      <button onClick={onLogout} className="flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50" type="button">
        <span className="material-symbols-outlined text-base">logout</span>Sair
      </button>
    </header>
  );
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      <AdminTopBar userName={user?.name ?? ""} onLogout={handleLogout} />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-purple-100">
          <span className="material-symbols-outlined text-5xl text-[#3d1a6e]">settings</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-[#260054]">Configurações em Desenvolvimento</h2>
          <p className="mt-3 text-[#4a4550]">
            Configurações de empresa, pesquisas personalizadas e integrações estarão disponíveis em breve.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
          Em breve
        </span>
      </main>
    </div>
  );
}
