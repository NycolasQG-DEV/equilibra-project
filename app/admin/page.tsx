"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { User, UserRole } from "@/types/database";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";

function StatCard({ icon, label, value, sub, gradient }: {
  icon: string; label: string; value: string | number; sub?: string; gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${gradient}`}>
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-2 h-16 w-16 rounded-full bg-white/5" />
      <div className="relative">
        <span className="material-symbols-outlined text-3xl opacity-90">{icon}</span>
        <p className="mt-3 text-4xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-sm font-semibold opacity-80">{label}</p>
        {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function AdminTopBar({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-[#260054]">Dashboard</h1>
        <p className="text-xs text-[#4a4550]">Visão geral da plataforma</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-4 py-2">
          <span className="material-symbols-outlined text-base text-[#3d1a6e]">account_circle</span>
          <span className="text-sm font-semibold text-[#260054]">{userName}</span>
          <RoleBadge role="admin" />
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-all" type="button">
          <span className="material-symbols-outlined text-base">logout</span>Sair
        </button>
      </div>
    </header>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");

  const [stats, setStats] = useState({ colaboradores: 0, maxColab: 0, newThisMonth: 0, responses: 0, riskAlto: 0, surveysActive: 0 });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data: myColabs } = await supabase
        .from("users").select("*").eq("admin_id", user.id).order("created_at", { ascending: false });
      const colabs = myColabs ?? [];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { data: myResponses } = await supabase
        .from("responses").select("risk_level").eq("admin_id", user.id);
      const responses = myResponses ?? [];

      const { count: activeSurveys } = await supabase
        .from("surveys").select("id", { count: "exact", head: true }).eq("admin_id", user.id).eq("is_active", true);

      setStats({
        colaboradores: colabs.length,
        maxColab: user.max_colaboradores ?? 0,
        newThisMonth: colabs.filter((u) => u.created_at >= startOfMonth).length,
        responses: responses.length,
        riskAlto: responses.filter((r) => r.risk_level === "alto").length,
        surveysActive: activeSurveys ?? 0,
      });
      setRecentUsers(colabs.slice(0, 8) as User[]);
      setStatsLoading(false);
    };
    fetchStats();
  }, [user]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      <AdminTopBar userName={user?.name ?? ""} onLogout={handleLogout} />
      <main className="flex-1 space-y-8 p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
          <StatCard icon="group" label="Colaboradores" value={statsLoading ? "—" : stats.colaboradores} sub={`de ${stats.maxColab >= 9999 ? "∞" : stats.maxColab} permitidos`} gradient="bg-gradient-to-br from-[#3d1a6e] to-[#260054]" />
          <StatCard icon="assignment" label="Respostas" value={statsLoading ? "—" : stats.responses} sub="questionários respondidos" gradient="bg-gradient-to-br from-[#6b538c] to-[#3d1a6e]" />
          <StatCard icon="checklist" label="Pesquisas Ativas" value={statsLoading ? "—" : stats.surveysActive} sub="em andamento" gradient="bg-gradient-to-br from-[#8b5cf6] to-[#6b538c]" />
          <StatCard icon="person_add" label="Novos este Mês" value={statsLoading ? "—" : stats.newThisMonth} sub="registros recentes" gradient="bg-gradient-to-br from-[#a78bfa] to-[#8b5cf6]" />
          <StatCard icon="warning" label="Risco Alto" value={statsLoading ? "—" : stats.riskAlto} sub="colaboradores em risco" gradient={stats.riskAlto > 0 ? "bg-gradient-to-br from-red-600 to-red-800" : "bg-gradient-to-br from-emerald-600 to-emerald-800"} />
        </div>

        {/* Recent Users Table */}
        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 px-6 py-5">
            <div>
              <h2 className="font-bold text-[#260054]">Usuários Recentes</h2>
              <p className="text-xs text-[#4a4550]">Últimos cadastros na plataforma</p>
            </div>
            <a href="/admin/usuarios" className="flex items-center gap-1 rounded-lg bg-[#3d1a6e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D1052] transition-colors">
              <span className="material-symbols-outlined text-base">open_in_new</span>Ver todos
            </a>
          </div>
          {statsLoading ? (
            <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>
          ) : recentUsers.length === 0 ? (
            <div className="py-16 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-4xl opacity-30">group_off</span>
              <p className="mt-2 text-sm">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                <tr>
                  <th className="px-6 py-3 text-left">Nome</th>
                  <th className="px-6 py-3 text-left">E-mail</th>
                  <th className="px-6 py-3 text-left">Papel</th>
                  <th className="px-6 py-3 text-left">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-purple-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#260054]">{u.name}</td>
                    <td className="px-6 py-4 text-[#4a4550]">{u.email}</td>
                    <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                    <td className="px-6 py-4 text-[#4a4550]">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/pesquisas", icon: "assignment", label: "Pesquisas", desc: "Criar e agendar pesquisas NR-1" },
            { href: "/admin/usuarios", icon: "manage_accounts", label: "Gerenciar Usuários", desc: "Alterar papéis e permissões" },
            { href: "/admin/relatorios", icon: "bar_chart", label: "Relatórios NR-1", desc: "Conformidade e risco psicossocial" },
            { href: "/admin/chat-ia", icon: "smart_toy", label: "Chat IA", desc: "Tire dúvidas sobre os dados" },
          ].map(({ href, icon, label, desc }) => (
            <a key={href} href={href}
              className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-white p-5 shadow-sm transition-all hover:border-purple-300 hover:shadow-md group">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e] group-hover:bg-[#3d1a6e] group-hover:text-white transition-all">
                <span className="material-symbols-outlined">{icon}</span>
              </div>
              <div>
                <p className="font-bold text-[#260054]">{label}</p>
                <p className="text-xs text-[#4a4550]">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
