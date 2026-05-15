"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const NAV = [
  { href: "/colaborador", label: "Dashboard", icon: "dashboard" },
  { href: "/colaborador/chat", label: "Chat com IA", icon: "psychology" },
  { href: "/colaborador/historico", label: "Histórico", icon: "history" },
];

/* Dark-themed loading for immersive pages */
function DarkLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0a17]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-900 border-t-purple-400" />
        <p className="text-sm text-purple-300/60">Carregando...</p>
      </div>
    </div>
  );
}

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth("default");

  const isImmersive = pathname === "/colaborador" || pathname === "/colaborador/chat";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) return isImmersive ? <DarkLoader /> : <LoadingSpinner message="Carregando..." />;

  /* Immersive mode — no chrome, just the page */
  if (isImmersive) {
    return <>{children}</>;
  }

  /* Regular layout with header for other pages */
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6FB]">
      <header className="flex w-full items-center justify-between border-b border-purple-200/20 bg-[#F8F6FB] px-8 py-4 font-['Epilogue']">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-tight text-purple-900">EQUILIBRA</span>
          <nav className="ml-8 hidden gap-1 md:flex">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-[#3d1a6e] text-white shadow-sm"
                      : "text-purple-600/70 hover:bg-purple-100 hover:text-purple-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[#4a4550]">
            Olá, <strong>{user?.name}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-sm text-purple-700 transition-all hover:bg-purple-50 active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sair
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}
