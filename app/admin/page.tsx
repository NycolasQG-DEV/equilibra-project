"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { User, UserRole } from "@/types/database";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { authenticatedFetch } from "@/lib/api-client";
import { clearAuthSession } from "@/lib/auth-client";

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
        <h1 className="text-lg font-bold text-[#260054]">Visão Geral</h1>
        <p className="text-xs text-[#4a4550]">Painel administrativo</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-[#260054]">
          <span className="material-symbols-outlined text-base text-[#3d1a6e]">account_circle</span>
          <span>{userName}</span>
        </div>
        <button onClick={onLogout}
          className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-all" type="button">
          Sair
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
      try {
        const res = await authenticatedFetch(`/api/admin/stats?adminId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            colaboradores: data.colaboradores,
            maxColab: data.maxColab,
            newThisMonth: data.newThisMonth,
            responses: data.responsesCount,
            riskAlto: data.riskAlto,
            surveysActive: data.surveysActive,
          });
          setRecentUsers(data.recentLinks || []);
        }
      } catch (err) {
        console.error("Erro ao buscar estatísticas:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/");
  };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      <AdminTopBar userName={user?.name ?? ""} onLogout={handleLogout} />
      <main className="flex-1 space-y-6 p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon="link" label="Links Criados" value={statsLoading ? "—" : stats.colaboradores} sub="Total gerado" gradient="bg-gradient-to-br from-[#3d1a6e] to-[#260054]" />
          <StatCard icon="pending_actions" label="Links Ativos" value={statsLoading ? "—" : stats.surveysActive} sub="Aguardando resposta" gradient="bg-gradient-to-br from-[#6b538c] to-[#3d1a6e]" />
          <StatCard icon="task_alt" label="Respostas Concluídas" value={statsLoading ? "—" : stats.responses} sub="Laudos gerados" gradient="bg-gradient-to-br from-[#10b981] to-[#047857]" />
          <StatCard icon="calendar_today" label="Novos este Mês" value={statsLoading ? "—" : stats.newThisMonth} sub="Links criados" gradient="bg-gradient-to-br from-[#8b5cf6] to-[#6b538c]" />
        </div>

        {/* Recent Survey Links Table */}
        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 px-6 py-5">
            <div>
              <h2 className="font-bold text-[#260054]">Links de Pesquisa Recentes</h2>
              <p className="text-xs text-[#4a4550]">Últimos links de uso único gerados para os colaboradores</p>
            </div>
            <a href="/admin/pesquisas" className="flex items-center gap-1 rounded-lg bg-[#3d1a6e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D1052] transition-colors">
              <span className="material-symbols-outlined text-base">open_in_new</span>Gerenciar Pesquisas
            </a>
          </div>
          {statsLoading ? (
            <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>
          ) : recentUsers.length === 0 ? (
            <div className="py-16 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-4xl opacity-30">link_off</span>
              <p className="mt-2 text-sm">Nenhum link de pesquisa gerado ainda</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                <tr>
                  <th className="px-6 py-3 text-left">Campanha / Link</th>
                  <th className="px-6 py-3 text-left">Setor</th>
                  <th className="px-6 py-3 text-left">Cargo</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {recentUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-purple-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#260054]">{u.title || u.id}</td>
                    <td className="px-6 py-4 text-[#4a4550]">{u.sector === "all" ? "Geral" : u.sector || "—"}</td>
                    <td className="px-6 py-4 text-[#4a4550]">{u.role || "Geral do Setor"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        u.used ? "bg-purple-100 text-purple-700" : u.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.used ? "Concluído" : u.active ? "Ativo" : "Pausado"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#4a4550]">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: "/admin/pesquisas", icon: "assignment", label: "Pesquisas & Links", desc: "Gerar links de pesquisa em lote por setor e cargo" },
            { href: "/admin/relatorios", icon: "bar_chart", label: "Relatórios NR-1", desc: "Laudos técnicos do PGR e riscos psicossociais" },
            { href: "/admin/chat-ia", icon: "smart_toy", label: "Chat IA", desc: "Assistente inteligente para análise dos dados" },
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
