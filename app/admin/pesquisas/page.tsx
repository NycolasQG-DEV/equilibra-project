"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface SurveyLinkRow {
  id: string;
  title: string;
  sector: string;
  role?: string | null;
  adminName?: string;
  adminEmail?: string;
  batchId?: string | null;
  active: boolean;
  used: boolean;
  createdAt: string;
  closedAt?: string | null;
  totalSessions?: number;
  completedReports?: number;
  lastResponseAt?: string;
}

function CreateLinkModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (count: number, batchLinks?: SurveyLinkRow[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [sector, setSector] = useState("all");
  const [role, setRole] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    if (!title.trim()) {
      setError("Informe o título da pesquisa.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/survey-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sector,
          role: role.trim() || null,
          quantity: Math.max(1, Math.min(quantity, 100)),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao criar links.");
        return;
      }

      onCreated(data.count || 1, data.links);
      onClose();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-purple-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#260054]">
            Novo Lote de Links
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" type="button">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#4a4550]">Título da Campanha</label>
            <input
              className="mt-1 w-full rounded-xl border border-purple-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#3d1a6e]"
              placeholder="Ex: Avaliação Psicossocial • Q1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#4a4550]">Setor</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d1a6e]"
              >
                <option value="all">Todos (Geral)</option>
                <option value="Engenharia">Engenharia</option>
                <option value="Produção Geral">Produção Geral</option>
                <option value="Usinagem">Usinagem</option>
                <option value="Montagem">Montagem</option>
                <option value="Logística">Logística</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Atendimento">Atendimento</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#4a4550]">Cargo (Opcional)</label>
              <input
                className="mt-1 w-full rounded-xl border border-purple-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#3d1a6e]"
                placeholder="Ex: Operador"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4a4550]">Quantidade de Links</label>
            <input
              type="number"
              min={1}
              max={100}
              className="mt-1 w-full rounded-xl border border-purple-200 px-3.5 py-2.5 text-sm font-bold text-[#260054] outline-none focus:border-[#3d1a6e]"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-xl bg-[#3d1a6e] py-3 text-sm font-bold text-white transition-all hover:bg-[#2D1052] disabled:opacity-50"
            type="button"
          >
            {loading ? "Gerando..." : `Gerar ${quantity} Link${quantity > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PesquisasPage() {
  const { user, loading } = useAuth("admin");
  const [links, setLinks] = useState<SurveyLinkRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [batchModalLinks, setBatchModalLinks] = useState<SurveyLinkRow[] | null>(null);

  const fetchLinks = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/survey-links");
      const data = await res.json();
      if (Array.isArray(data)) {
        setLinks(data);
      }
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const copyLinkUrl = (linkId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/colaborador?link=${encodeURIComponent(linkId)}`;
    navigator.clipboard.writeText(url);
    setToast("Link copiado para a área de transferência!");
    setTimeout(() => setToast(null), 3000);
  };

  const copyBatchLinks = (linksToCopy: SurveyLinkRow[]) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = linksToCopy
      .map(
        (l, i) =>
          `Link ${i + 1} (${l.sector}${l.role ? ` - ${l.role}` : ""}): ${origin}/colaborador?link=${l.id}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setToast(`${linksToCopy.length} links copiados para a área de transferência!`);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleStatus = async (link: SurveyLinkRow) => {
    try {
      const res = await fetch(`/api/survey-links/${link.id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchLinks();
      }
    } catch {
      /* ignore */
    }
  };

  const deleteLink = async (link: SurveyLinkRow) => {
    if (!confirm(`Deseja remover o link "${link.title}"?`)) return;
    try {
      const res = await fetch(`/api/survey-links/${link.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setToast("Link removido com sucesso.");
        setTimeout(() => setToast(null), 3000);
        fetchLinks();
      }
    } catch {
      /* ignore */
    }
  };

  const getBadge = (l: SurveyLinkRow) => {
    if (l.used) {
      return { label: "Concluído (Usado)", color: "bg-purple-100 text-purple-700", icon: "task_alt" };
    }
    if (!l.active) {
      return { label: "Pausado", color: "bg-gray-100 text-gray-600", icon: "pause_circle" };
    }
    return { label: "Disponível (Ativo)", color: "bg-emerald-100 text-emerald-700", icon: "link" };
  };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">
            Pesquisas & Links
          </h1>
          <p className="text-xs text-[#4a4550]">
            Gerencie lotes de links de pesquisa
          </p>
        </div>
        <div className="flex items-center gap-2">
          {links.length > 0 && (
            <button
              onClick={() => copyBatchLinks(links.filter((l) => l.active && !l.used))}
              className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#3d1a6e] transition-all hover:bg-purple-50"
              type="button"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              Copiar Ativos
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#3d1a6e] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#2D1052]"
            type="button"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Novo Lote
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: "link",
              label: "Total de Links",
              value: links.length,
              gradient: "from-[#3d1a6e] to-[#260054]",
            },
            {
              icon: "pending_actions",
              label: "Aguardando Resposta",
              value: links.filter((l) => l.active && !l.used).length,
              gradient: "from-[#6b538c] to-[#3d1a6e]",
            },
            {
              icon: "task_alt",
              label: "Respondidos",
              value: links.filter((l) => l.used).length,
              gradient: "from-[#10b981] to-[#047857]",
            },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.gradient} p-5 text-white shadow-sm`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-80">{c.label}</span>
                <span className="material-symbols-outlined text-xl opacity-75">{c.icon}</span>
              </div>
              <p className="mt-2 text-3xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Links Table */}
        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 px-6 py-4">
            <h2 className="text-sm font-bold text-[#260054]">Links Gerados</h2>
            <button onClick={fetchLinks} className="text-xs text-[#6b538c] hover:underline" type="button">
              Atualizar
            </button>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
            </div>
          ) : links.length === 0 ? (
            <div className="py-20 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-5xl opacity-20">link</span>
              <p className="mt-3 text-sm">Nenhum link de pesquisa gerado ainda.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 text-sm font-semibold text-[#3d1a6e] hover:underline"
                type="button"
              >
                Gerar links de pesquisa por setor e cargo →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                  <tr>
                    <th className="px-6 py-3 text-left">Campanha / Link</th>
                    <th className="px-6 py-3 text-left">Setor</th>
                    <th className="px-6 py-3 text-left">Cargo</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Criado em</th>
                    <th className="px-6 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {links.map((link) => {
                    const b = getBadge(link);
                    return (
                      <tr key={link.id} className="transition-colors hover:bg-purple-50/30">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-[#260054] text-sm">{link.title}</p>
                          <span className="font-mono text-[11px] text-[#6b538c]">
                            {link.id}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs text-[#4a4550]">
                            {link.sector === "all" ? "Geral" : link.sector}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs text-[#4a4550]">
                            {link.role || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.color}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-[#4a4550]/80">
                          {new Date(link.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => copyLinkUrl(link.id)}
                              className="flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#3d1a6e] hover:bg-purple-50 transition-colors"
                              type="button"
                              title="Copiar link"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                              Copiar
                            </button>

                            {!link.used && (
                              <button
                                onClick={() => toggleStatus(link)}
                                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                type="button"
                                title={link.active ? "Pausar" : "Ativar"}
                              >
                                <span className="material-symbols-outlined text-base">
                                  {link.active ? "pause" : "play_arrow"}
                                </span>
                              </button>
                            )}

                            <button
                              onClick={() => deleteLink(link)}
                              className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              type="button"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onCreated={(count, batchLinks) => {
            fetchLinks();
            if (batchLinks && batchLinks.length > 1) {
              setBatchModalLinks(batchLinks);
            }
            setToast(`${count} link(s) gerado(s) com sucesso!`);
            setTimeout(() => setToast(null), 3500);
          }}
        />
      )}

      {/* Modal de Lote Gerado */}
      {batchModalLinks && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setBatchModalLinks(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-purple-100 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <h3 className="text-base font-bold text-[#260054]">
                {batchModalLinks.length} Links Gerados
              </h3>
              <button
                type="button"
                onClick={() => setBatchModalLinks(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="my-3 flex-1 overflow-y-auto space-y-2 pr-1">
              {batchModalLinks.map((l, i) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/colaborador?link=${l.id}`;
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/30 p-2.5 text-xs"
                  >
                    <div className="truncate mr-2">
                      <span className="font-semibold text-[#260054] block truncate">#{i + 1} • {l.title}</span>
                      <span className="font-mono text-[#6b538c] text-[11px] truncate block">{url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        setToast(`Link #${i + 1} copiado!`);
                        setTimeout(() => setToast(null), 2500);
                      }}
                      className="rounded-lg bg-white border border-purple-200 px-2.5 py-1 text-xs font-semibold text-[#3d1a6e] hover:bg-purple-50 shrink-0 transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-purple-100 pt-3">
              <button
                type="button"
                onClick={() => copyBatchLinks(batchModalLinks)}
                className="flex items-center gap-1.5 rounded-xl bg-[#3d1a6e] px-4 py-2 text-xs font-bold text-white hover:bg-[#2D1052] transition-colors"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copiar Todos
              </button>
              <button
                type="button"
                onClick={() => setBatchModalLinks(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#260054] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
          {toast}
        </div>
      )}
    </div>
  );
}
