import React, { useEffect, useState } from 'react';
import { get, post, put, del } from '../core/api';
import type { Member, Group } from '../../../types';

export const OrganizationView: React.FC = () => {
  const [tab, setTab] = useState<'people' | 'groups'>('people');
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de Membro
  const [memberModal, setMemberModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberDept, setMemberDept] = useState('');
  const [memberGroupIds, setMemberGroupIds] = useState<string[]>([]);
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  // Modal de Grupo
  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // Busca
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [membersRes, groupsRes] = await Promise.allSettled([
        get<Member[]>('/members'),
        get<Group[]>('/groups'),
      ]);

      if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) {
        setMembers(membersRes.value);
      }
      if (groupsRes.status === 'fulfilled' && Array.isArray(groupsRes.value)) {
        setGroups(groupsRes.value);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar organização.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) {
      setError('Informe nome e e-mail do colaborador.');
      return;
    }
    try {
      setMemberSubmitting(true);
      setError(null);
      await post('/members', {
        name: memberName.trim(),
        email: memberEmail.trim(),
        role: memberRole.trim() || undefined,
        department: memberDept.trim() || undefined,
        groupIds: memberGroupIds,
      });
      showSuccess('Colaborador adicionado com sucesso!');
      setMemberModal(false);
      setMemberName(''); setMemberEmail(''); setMemberRole(''); setMemberDept(''); setMemberGroupIds([]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar colaborador.');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      setError(null);
      await del(`/members/${id}`);
      showSuccess('Colaborador removido.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao remover colaborador.');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      setGroupSubmitting(true);
      setError(null);
      await post('/groups', { name: groupName.trim() });
      showSuccess('Setor criado com sucesso!');
      setGroupModal(false);
      setGroupName('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar setor.');
    } finally {
      setGroupSubmitting(false);
    }
  };

  const toggleMemberGroup = (gid: string) => {
    setMemberGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
    );
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(search.toLowerCase())) ||
      (m.department && m.department.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Organização & Mapeamento da Força de Trabalho</h1>
          <p className="page-subtitle">
            Base de colaboradores e setores para garantir quórum amostral válido nos ciclos de escuta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setGroupModal(true)}
          >
            <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Novo Setor
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => { setMemberGroupIds(groups.length > 0 ? [groups[0].id] : []); setMemberModal(true); }}
          >
            <i className="fa-solid fa-user-plus mr-1" aria-hidden="true" /> Adicionar Colaborador
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger text-xs p-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success text-xs p-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {/* Stats rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-surface flex items-center gap-4 border border-border">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-subtle color-text-secondary text-base border border-border">
            <i className="fa-solid fa-users" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-bold color-text-primary">{members.length}</div>
            <div className="text-xs color-text-muted">Colaboradores Mapeados</div>
          </div>
        </div>
        <div className="card p-4 bg-surface flex items-center gap-4 border border-border">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-subtle color-text-secondary text-base border border-border">
            <i className="fa-solid fa-layer-group" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-bold color-text-primary">{groups.length}</div>
            <div className="text-xs color-text-muted">Setores / Grupos de Risco</div>
          </div>
        </div>
        <div className="card p-4 bg-surface flex items-center gap-4 border border-border">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-success-subtle text-success text-base border border-success-border">
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-bold text-success">
              {groups.filter((g) => (g.memberIds?.length || 0) >= 5).length}
            </div>
            <div className="text-xs color-text-muted">Setores com quórum mínimo (≥ 5)</div>
          </div>
        </div>
      </div>

      {/* Toolbar: Tabs & Busca */}
      <div className="toolbar">
        <div className="filter-tabs" role="tablist">
          {(['people', 'groups'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`filter-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              <i className={`fa-solid ${t === 'people' ? 'fa-users' : 'fa-layer-group'} mr-1.5`} aria-hidden="true" />
              {t === 'people' ? `Colaboradores (${members.length})` : `Setores (${groups.length})`}
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <input
            type="text"
            className="input text-xs"
            placeholder={tab === 'people' ? 'Buscar colaborador ou setor...' : 'Buscar setor...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conteúdo das Tabs */}
      {loading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : tab === 'people' ? (
        /* Tab: Colaboradores */
        filteredMembers.length === 0 ? (
          <div className="card p-10 text-center bg-surface">
            <i className="fa-solid fa-users text-4xl color-text-muted mb-3" aria-hidden="true" />
            <h3 className="font-semibold text-sm mb-1">Nenhum colaborador encontrado</h3>
            <p className="text-xs color-text-secondary mb-3">
              {search
                ? 'Ajuste os termos da busca.'
                : 'Adicione colaboradores individualmente ou importe uma planilha CSV.'}
            </p>
            {!search && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setMemberModal(true)}
              >
                <i className="fa-solid fa-user-plus mr-1" aria-hidden="true" /> Adicionar Primeiro Colaborador
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Função / Setor</th>
                    <th>Grupos</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => {
                    const memberGroupNames = (m.groupIds || [])
                      .map((gid) => groups.find((g) => g.id === gid)?.name)
                      .filter(Boolean);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-subtle text-primary text-xs font-bold flex items-center justify-center uppercase">
                              {m.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-xs">{m.name}</span>
                          </div>
                        </td>
                        <td><span className="text-xs color-text-secondary">{m.email}</span></td>
                        <td>
                          <div className="text-xs">
                            {m.role && <span className="font-medium">{m.role}</span>}
                            {m.department && <span className="color-text-muted"> · {m.department}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {memberGroupNames.length > 0
                              ? memberGroupNames.map((gn, i) => (
                                  <span key={i} className="badge badge-primary text-[10px]">
                                    {gn}
                                  </span>
                                ))
                              : <span className="badge badge-neutral text-[10px]">Sem setor</span>}
                          </div>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-danger"
                            onClick={() => handleDeleteMember(m.id)}
                            title="Remover colaborador"
                          >
                            <i className="fa-solid fa-user-minus" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Tab: Setores / Grupos */
        filteredGroups.length === 0 ? (
          <div className="card p-10 text-center bg-surface">
            <i className="fa-solid fa-layer-group text-4xl color-text-muted mb-3" aria-hidden="true" />
            <h3 className="font-semibold text-sm mb-1">Nenhum setor encontrado</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setGroupModal(true)}>
              <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Criar Primeiro Setor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((g) => {
              const memberCount = g.memberIds?.length || 0;
              const quorumOk = memberCount >= 5;
              return (
                <div key={g.id} className="card p-4 bg-surface border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-primary">{g.name}</h3>
                    <span
                      className={`badge ${quorumOk ? 'badge-success' : 'badge-warning'} text-[10px]`}
                    >
                      {quorumOk ? '✓ Quórum OK' : 'Abaixo do quórum'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs color-text-secondary mb-2">
                    <i className="fa-solid fa-users" aria-hidden="true" />
                    <span>{memberCount} {memberCount === 1 ? 'colaborador' : 'colaboradores'}</span>
                  </div>
                  <p className="text-[11px] color-text-muted">
                    {quorumOk
                      ? 'Este setor possui quórum suficiente para garantir a anonimização nas escutas.'
                      : `Mínimo de 5 necessário. Faltam ${Math.max(0, 5 - memberCount)} colaboradores para garantir o sigilo estatístico.`}
                  </p>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal de Novo Colaborador */}
      {memberModal && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-lg">
            <div className="dialog-header flex items-center justify-between pb-3 border-b border-border">
              <h2 className="dialog-title text-sm font-bold m-0 text-primary">Adicionar Colaborador</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMemberModal(false)}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateMember} className="dialog-body space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-semibold block mb-1">Nome Completo *</label>
                  <input type="text" className="input w-full text-xs" placeholder="Ex: Maria Silva" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">E-mail de Contato *</label>
                  <input type="email" className="input w-full text-xs" placeholder="maria@empresa.com.br" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-semibold block mb-1">Função / Cargo</label>
                  <input type="text" className="input w-full text-xs" placeholder="Ex: Analista de RH" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Departamento / Setor</label>
                  <input type="text" className="input w-full text-xs" placeholder="Ex: Recursos Humanos" value={memberDept} onChange={(e) => setMemberDept(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label text-xs font-semibold block mb-1">Incluir nos Grupos de Escuta</label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      className={`btn btn-xs ${memberGroupIds.includes(g.id) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleMemberGroup(g.id)}
                    >
                      {memberGroupIds.includes(g.id) && <i className="fa-solid fa-check mr-1 text-[10px]" aria-hidden="true" />}
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dialog-footer flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setMemberModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-xs" disabled={memberSubmitting}>
                  {memberSubmitting ? 'Salvando...' : 'Adicionar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Setor */}
      {groupModal && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-sm">
            <div className="dialog-header flex items-center justify-between pb-3 border-b border-border">
              <h2 className="dialog-title text-sm font-bold m-0 text-primary">Criar Setor / Grupo de Risco</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGroupModal(false)}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="dialog-body space-y-3 pt-3">
              <div>
                <label className="label text-xs font-semibold block mb-1">Nome do Setor *</label>
                <input type="text" className="input w-full text-xs" placeholder="Ex: Logística / Produção / Administrativo" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
              </div>
              <p className="text-[11px] color-text-muted">O setor precisa ter no mínimo 5 colaboradores para que os dados sejam divulgados no relatório (proteção de privacidade e sigilo estatístico).</p>
              <div className="dialog-footer flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setGroupModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-xs" disabled={groupSubmitting}>
                  {groupSubmitting ? 'Criando...' : 'Criar Setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
