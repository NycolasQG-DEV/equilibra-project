"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SelectOrCreate } from "@/components/ui/SelectOrCreate";
import { User, UserRole } from "@/types/database";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";

const inputClass =
  "w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-[#6b538c] focus:ring-2 focus:ring-[#dabdfe] transition-all";
const labelClass = "text-xs font-bold uppercase tracking-wider text-[#4a4550]";

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

/* ─── Modal para adicionar colaborador ─── */
function AddUserModal({ adminId, onClose, onCreated, cargoOptions, setorOptions, onNewCargo, onNewSetor }: {
  adminId: string; onClose: () => void; onCreated: () => void;
  cargoOptions: string[]; setorOptions: string[];
  onNewCargo: (v: string) => void; onNewSetor: (v: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async () => {
    setError(""); setSuccess("");
    if (!name || !email || !password) { setError("Preencha nome, e-mail e senha."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/create-user", {
        method: "POST",
        body: JSON.stringify({ name, email, password, adminId, cargo, setor, observacao }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao criar colaborador."); return; }
      setSuccess(`Colaborador "${name}" criado com sucesso! (${data.remaining} vagas restantes)`);
      setTimeout(() => { onCreated(); onClose(); }, 1500);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-purple-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#260054]">Adicionar Colaborador</h3>
            <p className="text-xs text-[#4a4550]">O colaborador poderá logar com as credenciais criadas</p>
          </div>
          <button onClick={onClose} className="text-[#4a4550] hover:text-[#260054]" type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Nome completo *</label>
            <input className={inputClass} placeholder="Nome do colaborador" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>E-mail *</label>
            <input className={inputClass} placeholder="colaborador@empresa.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Senha temporária *</label>
            <input className={inputClass} placeholder="Mínimo 6 caracteres" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <hr className="border-purple-100" />
          <p className="text-xs font-semibold text-[#6b538c]">Informações do funcionário (opcional)</p>

          <div className="grid grid-cols-2 gap-3">
            <SelectOrCreate label="Cargo" value={cargo} options={cargoOptions} placeholder="Analista" onChange={setCargo} onCreateNew={onNewCargo} />
            <SelectOrCreate label="Setor" value={setor} options={setorOptions} placeholder="RH" onChange={setSetor} onCreateNew={onNewSetor} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Observação</label>
            <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Anotações sobre o colaborador…" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>}

          <button onClick={handleCreate} disabled={loading}
            className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white hover:bg-[#2D1052] disabled:opacity-50 transition-all"
            type="button"
          >
            {loading ? "Criando..." : "Criar Colaborador"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal para editar colaborador ─── */
function EditUserModal({ adminId, target, onClose, onUpdated, cargoOptions, setorOptions, onNewCargo, onNewSetor }: {
  adminId: string; target: User; onClose: () => void; onUpdated: () => void;
  cargoOptions: string[]; setorOptions: string[];
  onNewCargo: (v: string) => void; onNewSetor: (v: string) => void;
}) {
  const [name, setName] = useState(target.name);
  const [cargo, setCargo] = useState(target.cargo || "");
  const [setor, setSetor] = useState(target.setor || "");
  const [observacao, setObservacao] = useState(target.observacao || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async () => {
    setError(""); setSuccess("");
    if (!name.trim()) { setError("O nome é obrigatório."); return; }
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/update-user", {
        method: "PUT",
        body: JSON.stringify({ adminId, userId: target.id, name, cargo, setor, observacao }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao atualizar."); return; }
      setSuccess("Colaborador atualizado com sucesso!");
      setTimeout(() => { onUpdated(); onClose(); }, 1200);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-purple-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#260054]">Editar Colaborador</h3>
            <p className="text-xs text-[#4a4550]">{target.email}</p>
          </div>
          <button onClick={onClose} className="text-[#4a4550] hover:text-[#260054]" type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Nome completo</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectOrCreate label="Cargo" value={cargo} options={cargoOptions} placeholder="Analista" onChange={setCargo} onCreateNew={onNewCargo} />
            <SelectOrCreate label="Setor" value={setor} options={setorOptions} placeholder="RH" onChange={setSetor} onCreateNew={onNewSetor} />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Observação</label>
            <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Anotações sobre o colaborador…" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>}

          <button onClick={handleSave} disabled={loading}
            className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white hover:bg-[#2D1052] disabled:opacity-50 transition-all"
            type="button"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de confirmação para remover ─── */
function DeleteConfirmModal({ adminId, target, onClose, onDeleted }: {
  adminId: string; target: User; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/delete-user", {
        method: "DELETE",
        body: JSON.stringify({ adminId, userId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao remover."); return; }
      onDeleted(); onClose();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
          <span className="material-symbols-outlined text-3xl">delete_forever</span>
        </div>
        <h3 className="text-center text-lg font-bold text-[#260054]">Remover Colaborador</h3>
        <p className="mt-2 text-center text-sm text-[#4a4550]">
          Tem certeza que deseja remover <strong>{target.name}</strong>? Esta ação é irreversível e o colaborador perderá acesso ao sistema.
        </p>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-purple-200 py-3 font-semibold text-[#4a4550] hover:bg-purple-50 transition-all" type="button">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            type="button"
          >
            {loading ? "Removendo..." : "Remover"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
export default function AdminUsuariosPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");

  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [cargoOptions, setCargoOptions] = useState<string[]>([]);
  const [setorOptions, setSetorOptions] = useState<string[]>([]);

  // Extrair opções únicas de cargo/setor dos colaboradores existentes
  useEffect(() => {
    const cargos = [...new Set(users.map((u) => u.cargo).filter(Boolean))] as string[];
    const setores = [...new Set(users.map((u) => u.setor).filter(Boolean))] as string[];
    setCargoOptions(cargos.sort());
    setSetorOptions(setores.sort());
  }, [users]);

  const addCargo = (v: string) => setCargoOptions((prev) => [...new Set([...prev, v])].sort());
  const addSetor = (v: string) => setSetorOptions((prev) => [...new Set([...prev, v])].sort());

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const { data } = await supabase
      .from("users")
      .select("*")
      .or(`admin_id.eq.${user.id},id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (data) {
      setUsers(data as User[]);
      setFiltered(data as User[]);
    }
    setDataLoading(false);
  }, [user]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    let result = users;
    if (roleFilter !== "all") result = result.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.cargo || "").toLowerCase().includes(q) ||
        (u.setor || "").toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, roleFilter, users]);

  const colabCount = users.filter((u) => u.role === "default").length;
  const maxColab = user?.max_colaboradores ?? 0;

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/"); };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">Gerenciar Colaboradores</h1>
          <p className="text-xs text-[#4a4550]">
            {colabCount} de {maxColab >= 9999 ? "∞" : maxColab} colaboradores utilizados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#3d1a6e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2D1052] transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Adicionar Colaborador
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
            type="button"
          >
            <span className="material-symbols-outlined text-base">logout</span>Sair
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        {/* Barra de plano */}
        <div className="flex items-center gap-4 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
            <span className="material-symbols-outlined text-2xl">badge</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#260054]">
              Plano {user?.plan === "starter" ? "Starter" : user?.plan === "professional" ? "Professional" : "Enterprise"}
            </p>
            <div className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full bg-purple-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3d1a6e] to-[#6b538c] transition-all"
                style={{ width: `${Math.min((colabCount / Math.max(maxColab, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-[#4a4550]">
            {colabCount}/{maxColab >= 9999 ? "∞" : maxColab}
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4550] text-xl">search</span>
            <input
              className="w-full rounded-xl border border-purple-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#6b538c] focus:ring-2 focus:ring-[#dabdfe]"
              placeholder="Buscar por nome, e-mail, cargo ou setor…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {(["all", "default", "admin"] as const).map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)} type="button"
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  roleFilter === r ? "bg-[#3d1a6e] text-white shadow" : "border border-purple-200 bg-white text-[#4a4550] hover:bg-purple-50"
                }`}
              >
                {r === "all" ? "Todos" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-5xl opacity-20">group_off</span>
              <p className="mt-3 text-sm">Nenhum usuário encontrado.</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-semibold text-[#3d1a6e] hover:underline" type="button">
                Adicionar seu primeiro colaborador →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                <tr>
                  <th className="px-6 py-4 text-left">Usuário</th>
                  <th className="px-6 py-4 text-left">E-mail</th>
                  <th className="px-6 py-4 text-left">Cargo</th>
                  <th className="px-6 py-4 text-left">Setor</th>
                  <th className="px-6 py-4 text-left">Papel</th>
                  <th className="px-6 py-4 text-left">Cadastro</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isColab = u.role === "default";
                  return (
                    <tr key={u.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-[#3d1a6e]">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#260054]">
                            {u.name}
                            {isSelf && (
                              <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-600">Você</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#4a4550]">{u.email}</td>
                      <td className="px-6 py-4 text-[#4a4550]">{u.cargo || <span className="text-purple-300">—</span>}</td>
                      <td className="px-6 py-4 text-[#4a4550]">{u.setor || <span className="text-purple-300">—</span>}</td>
                      <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                      <td className="px-6 py-4 text-[#4a4550]">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-6 py-4">
                        {!isSelf && isColab ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditTarget(u)}
                              className="rounded-lg p-2 text-[#6b538c] hover:bg-purple-100 hover:text-[#3d1a6e] transition-all"
                              type="button" title="Editar colaborador"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                              type="button" title="Remover colaborador"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        ) : (
                          <span className="flex justify-center text-purple-200">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modais */}
      {showModal && user && (
        <AddUserModal adminId={user.id} onClose={() => setShowModal(false)} onCreated={() => { fetchUsers(); showToast("Colaborador criado!", "success"); }} cargoOptions={cargoOptions} setorOptions={setorOptions} onNewCargo={addCargo} onNewSetor={addSetor} />
      )}
      {editTarget && user && (
        <EditUserModal adminId={user.id} target={editTarget} onClose={() => setEditTarget(null)} onUpdated={() => { fetchUsers(); showToast("Colaborador atualizado!", "success"); }} cargoOptions={cargoOptions} setorOptions={setorOptions} onNewCargo={addCargo} onNewSetor={addSetor} />
      )}
      {deleteTarget && user && (
        <DeleteConfirmModal adminId={user.id} target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { fetchUsers(); showToast("Colaborador removido.", "success"); }} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl text-sm font-semibold ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          <span className="material-symbols-outlined text-base">{toast.type === "success" ? "check_circle" : "error"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
