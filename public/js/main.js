/* Main entry point for Equilibra Frontend Application */

import { router } from './core/router.js';
import { store } from './core/store.js';
import { setAuthFailureHandler, get, post, put, del } from './core/api.js';
import { showToast } from './ui/toast.js';
import { closeDialog } from './ui/dialog.js';
import { roleLabels } from './domain/labels.js';

import { renderLogin, handleLoginSubmit, renderRegister, handleRegisterSubmit, handleLogout } from './features/auth/authView.js';
import { renderToday, mountedToday } from './features/today/todayView.js';
import {
  renderPeople,
  renderGroups,
  openAddMemberModal,
  submitAddMember,
  openEditMemberModal,
  submitEditMember,
  openDeleteMemberConfirm,
  confirmDeleteMember,
  openAddGroupModal,
  submitAddGroup,
  openEditGroupModal,
  submitEditGroup,
  openDeleteGroupConfirm,
  confirmDeleteGroup,
  openImportModal,
  downloadExcelTemplate,
  downloadCsvTemplate,
  submitConfirmImport,
  resetImportView,
  pickTeamColor,
  selectAllTeamMembers,
  clearAllTeamMembers
} from './features/organization/organizationView.js';
import {
  renderSurveysList,
  renderSurveyDistribution,
  openExtendModal,
  submitExtendSurvey,
  openCloseEarlyModal,
  submitCloseEarly,
  openDeleteSurveyModal,
  submitDeleteSurvey,
  handleOpenSurveyDirect,
  openSurveyDetailsModal
} from './features/surveys/surveysView.js';
import {
  renderSurveyCreate,
  selectModel,
  openModelPreviewModal,
  setPeriodicity,
  updateWizardQuorum,
  selectAllWizardGroups,
  selectGeneralWizardGroup,
  submitSurveyCreation
} from './features/surveys/surveyCreateView.js';
import {
  renderCyclesList,
  renderCycleReport,
  mountedCycleReport,
  openAcceptModal,
  submitAcceptReport
} from './features/results/resultsView.js';
import {
  renderActionsList,
  openAddActionModal,
  submitAddAction
} from './features/actions/actionsView.js';
import { renderSettings, openInviteUserModal, openInviteSuccessModal } from './features/settings/settingsView.js';
import { renderRespondent } from './features/respond/respondView.js';

// Setup Auth Failure handler
setAuthFailureHandler(() => {
  const currentHash = window.location.hash.replace(/^#/, '');
  if (currentHash && currentHash !== 'login') {
    router.intendedRoute = currentHash;
  }
  showToast('Sua sessão expirou. Por favor, autentique-se novamente.', 'info');
  router.navigate('login');
});

// Register routes
router.register({
  path: 'hoje',
  title: 'Visão Geral',
  load: async () => {
    await Promise.all([
      store.loadToday(),
      store.loadSurveys(),
      store.loadOrganization(),
      store.loadReports()
    ]);
  },
  render: renderToday,
  mounted: mountedToday
});

router.register({
  path: 'organizacao/pessoas',
  title: 'Colaboradores',
  roles: ['owner', 'editor'],
  load: () => store.loadOrganization(),
  render: renderPeople
});

router.register({
  path: 'organizacao/grupos',
  title: 'Grupos e Segmentos',
  roles: ['owner', 'editor'],
  load: () => store.loadOrganization(),
  render: renderGroups
});

router.register({
  path: 'organizacao',
  load: () => router.navigate('organizacao/pessoas', { replace: true }),
  render: () => ''
});

router.register({
  path: 'pesquisas',
  title: 'Pesquisas',
  load: () => store.loadSurveys(),
  render: renderSurveysList
});

router.register({
  path: 'pesquisas/nova',
  title: 'Nova Pesquisa',
  roles: ['owner', 'editor'],
  load: async () => {
    await Promise.all([
      store.loadMeta(),
      store.loadOrganization(),
      store.loadSurveys()
    ]);
  },
  render: renderSurveyCreate
});

router.register({
  path: 'pesquisas/:id/distribuicao',
  title: 'Distribuição da Pesquisa',
  load: async () => {
    await Promise.all([store.loadSurveys(), store.loadOrganization()]);
  },
  render: renderSurveyDistribution
});

router.register({
  path: 'pesquisas/:id',
  title: 'Detalhes da Pesquisa',
  load: () => store.loadSurveys(),
  render: renderSurveyDistribution
});

router.register({
  path: 'resultados/ciclos',
  title: 'Resultados e Ciclos',
  load: () => store.loadReports(),
  render: renderCyclesList
});

router.register({
  path: 'resultados/relatorios',
  title: 'Documentos e Histórico',
  load: () => store.loadReports(),
  render: renderCyclesList
});

router.register({
  path: 'resultados',
  load: () => router.navigate('resultados/ciclos', { replace: true }),
  render: () => ''
});

router.register({
  path: 'resultados/ciclo/:id',
  title: 'Relatório do Ciclo',
  load: () => store.loadReports(),
  render: renderCycleReport,
  mounted: mountedCycleReport
});

router.register({
  path: 'acoes',
  title: 'Planos de Ação (NR-1)',
  load: () => store.loadManagement(),
  render: renderActionsList
});

router.register({
  path: 'configuracoes/:section',
  title: 'Configurações',
  load: async () => {
    const state = store.getState();
    const isOwner = state.account?.role === 'owner';
    const loads = [store.loadManagement(), store.loadMeta()];
    if (isOwner) {
      loads.push(store.loadTeam());
    }
    await Promise.all(loads);
  },
  render: renderSettings
});

router.register({
  path: 'configuracoes',
  load: () => router.navigate('configuracoes/conta', { replace: true }),
  render: () => ''
});

router.register({
  path: 'login',
  title: 'Entrar',
  render: renderLogin
});

router.register({
  path: 'registro',
  title: 'Criar conta',
  load: async () => {
    const raw = window.location.hash || '';
    const queryPart = raw.includes('?') ? raw.split('?')[1] : (window.location.search ? window.location.search.slice(1) : '');
    const params = new URLSearchParams(queryPart);
    const token = params.get('invite') || params.get('token');
    if (token) {
      try {
        const info = await get(`/auth/invite-info?token=${encodeURIComponent(token)}`);
        store.setState({ activeInvite: { ...info, token } });
      } catch (err) {
        store.setState({ activeInvite: { error: err.message || 'Convite inválido ou expirado.', token } });
      }
    } else {
      store.setState({ activeInvite: null });
    }
  },
  render: renderRegister
});

router.register({
  path: 'responder/:token',
  title: 'Pesquisa Confidencial',
  render: renderRespondent
});

// Setup Global Event Delegation via data-action
document.addEventListener('click', async (e) => {
  const trigger = e.target.closest('[data-action]');
  if (!trigger) return;

  const action = trigger.dataset.action;

  if (action === 'navigate') {
    e.preventDefault();
    router.navigate(trigger.dataset.path);
  } else if (action === 'logout') {
    e.preventDefault();
    await handleLogout();
  } else if (action === 'toggle-mobile-drawer') {
    const drawer = document.getElementById('mobile-drawer');
    if (drawer) {
      drawer.classList.toggle('open');
    }
  } else if (action === 'open-import-modal') {
    openImportModal();
  } else if (action === 'download-template-xlsx') {
    downloadExcelTemplate();
  } else if (action === 'download-template-csv') {
    downloadCsvTemplate();
  } else if (action === 'submit-confirm-import') {
    await submitConfirmImport();
  } else if (action === 'reset-import-file') {
    resetImportView();
  } else if (action === 'pick-team-color') {
    pickTeamColor(trigger);
  } else if (action === 'select-all-team-members') {
    selectAllTeamMembers();
  } else if (action === 'clear-all-team-members') {
    clearAllTeamMembers();
  } else if (action === 'open-add-member-modal') {
    openAddMemberModal();
  } else if (action === 'submit-add-member') {
    await submitAddMember();
  } else if (action === 'edit-member') {
    openEditMemberModal(trigger.dataset.id);
  } else if (action === 'submit-edit-member') {
    await submitEditMember(trigger.dataset.id);
  } else if (action === 'delete-member') {
    openDeleteMemberConfirm(trigger.dataset.id);
  } else if (action === 'confirm-delete-member') {
    await confirmDeleteMember(trigger.dataset.id);
  } else if (action === 'open-add-group-modal') {
    openAddGroupModal();
  } else if (action === 'submit-add-group') {
    await submitAddGroup();
  } else if (action === 'edit-group') {
    openEditGroupModal(trigger.dataset.id);
  } else if (action === 'submit-edit-group') {
    await submitEditGroup(trigger.dataset.id);
  } else if (action === 'delete-group') {
    openDeleteGroupConfirm(trigger.dataset.id);
  } else if (action === 'confirm-delete-group') {
    await confirmDeleteGroup(trigger.dataset.id);
  } else if (action === 'open-extend-modal') {
    openExtendModal(trigger.dataset.id);
  } else if (action === 'submit-extend-survey') {
    await submitExtendSurvey(trigger.dataset.id);
  } else if (action === 'open-close-early-modal') {
    openCloseEarlyModal(trigger.dataset.id);
  } else if (action === 'submit-close-early') {
    await submitCloseEarly(trigger.dataset.id);
  } else if (action === 'open-accept-modal') {
    openAcceptModal(trigger.dataset.id);
  } else if (action === 'submit-accept-report') {
    await submitAcceptReport(trigger.dataset.id);
  } else if (action === 'open-add-action-modal') {
    openAddActionModal();
  } else if (action === 'submit-add-action') {
    await submitAddAction();
  } else if (action === 'quick-add-solution') {
    e.preventDefault();
    if (trigger.disabled) return;
    trigger.disabled = true;
    const originalHtml = trigger.innerHTML;
    trigger.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Cadastrando...';

    const reportId = trigger.dataset.reportId;
    const factorKey = trigger.dataset.factorKey;
    const factorLabel = trigger.dataset.factorLabel || factorKey;
    const title = trigger.dataset.solutionTitle;
    const owner = trigger.dataset.owner || 'RH / Gestão Operacional';
    const days = Number(trigger.dataset.days) || 30;
    const criteria = trigger.dataset.criteria || 'Redução da sobrecarga e melhoria na próxima escuta';
    const desc = trigger.dataset.desc || 'Ação preventiva gerada pelo Portal de Soluções Equilibra (NR-1)';

    try {
      await store.loadManagement();
      const assessments = store.state.management?.assessments || [];
      let assessment = assessments.find(a => a.reportId === reportId && a.factor === factorKey);

      if (!assessment) {
        assessment = await post('/management/assessments', {
          reportId,
          factor: factorKey,
          title: `Avaliação do Fator: ${factorLabel}`,
          context: `Achado identificado na escuta psicossocial NR-1: fator na faixa de atenção/cuidado.`,
          existingMeasures: 'Medidas em análise preliminar pelo SESMT/RH.',
          decision: `Implementação da ação preventiva recomendada: ${title}`,
          classification: 'high',
          status: 'evaluated'
        });
      } else if (assessment.status !== 'evaluated') {
        assessment = await put(`/management/assessments/${assessment.id}`, {
          ...assessment,
          context: assessment.context || `Achado identificado na escuta psicossocial NR-1.`,
          decision: `Implementação da ação preventiva recomendada: ${title}`,
          classification: 'high',
          status: 'evaluated'
        });
      }

      const now = new Date();
      const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const rev = new Date(due.getTime() + 15 * 24 * 60 * 60 * 1000);
      const fmtDate = (d) => d.toISOString().slice(0, 10);

      await post('/management/actions', {
        assessmentId: assessment.id,
        title,
        owner,
        dueDate: fmtDate(due),
        reviewDate: fmtDate(rev),
        priority: 'high',
        successCriteria: criteria,
        description: desc
      });

      await store.loadManagement();
      showToast(`Ação preventiva "${title}" integrada ao Plano de Ação da NR-1 com sucesso!`, 'success');

      trigger.className = 'badge badge-success';
      trigger.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Integrado ao Plano de Ação';
    } catch (err) {
      trigger.disabled = false;
      trigger.innerHTML = originalHtml;
      showToast(err.message || 'Erro ao cadastrar ação preventiva.', 'error');
    }
  } else if (action === 'toggle-chart-table') {
    const targetId = trigger.dataset.target;
    const tableEl = document.getElementById(targetId);
    const canvasEl = tableEl?.parentElement?.querySelector('canvas');
    if (tableEl && canvasEl) {
      const isTableVisible = tableEl.style.display !== 'none';
      tableEl.style.display = isTableVisible ? 'none' : 'block';
      canvasEl.style.display = isTableVisible ? 'block' : 'none';
      trigger.textContent = isTableVisible ? 'Ver tabela' : 'Ver gráfico';
    }
  } else if (action === 'open-survey-direct') {
    await handleOpenSurveyDirect(trigger.dataset.id);
  } else if (action === 'open-survey-details') {
    openSurveyDetailsModal(trigger.dataset.id);
  } else if (action === 'open-delete-survey-modal') {
    openDeleteSurveyModal(trigger.dataset.id, trigger.dataset.title);
  } else if (action === 'confirm-delete-survey') {
    await submitDeleteSurvey(trigger.dataset.id);
  } else if (action === 'confirm-replace-open-survey') {
    const oldId = trigger.dataset.oldId;
    const newId = trigger.dataset.newId;
    closeDialog();
    try {
      await post(`/surveys/${oldId}/close`, {
        confirmEarlyClose: true,
        reason: 'Encerramento para início de novo ciclo de pesquisa'
      });
      await post(`/surveys/${newId}/open`, {});
      await store.loadSurveys();
      showToast('Pesquisa anterior encerrada e nova coleta aberta com sucesso!', 'success');
      router.navigate(`pesquisas/${newId}/distribuicao`);
    } catch (err) {
      showToast(err.message || 'Erro ao substituir ciclo.', 'error');
    }
  } else if (action === 'select-model-card') {
    selectModel(trigger.dataset.model);
  } else if (action === 'preview-model-questions') {
    e.stopPropagation();
    openModelPreviewModal(trigger.dataset.model);
  } else if (action === 'choose-model-from-modal') {
    selectModel(trigger.dataset.model);
    closeDialog();
  } else if (action === 'set-periodicity') {
    setPeriodicity(trigger.dataset.period, trigger.dataset.days);
  } else if (action === 'select-all-wizard-groups') {
    selectAllWizardGroups();
  } else if (action === 'select-general-wizard-group') {
    selectGeneralWizardGroup();
  } else if (action === 'submit-create-draft') {
    await submitSurveyCreation({ openImmediately: false });
  } else if (action === 'submit-create-survey-btn') {
    e.preventDefault();
    await submitSurveyCreation({ openImmediately: true });
  } else if (action === 'copy-invite-template') {
    const pre = document.getElementById('invite-template-text');
    if (pre) {
      navigator.clipboard.writeText(pre.textContent.trim());
      showToast('Modelo de mensagem copiado para a área de transferência.', 'success');
    }
  } else if (action === 'copy-survey-url') {
    const input = document.getElementById('survey-direct-link-input');
    const url = trigger.dataset.url || input?.value;
    if (url) {
      navigator.clipboard.writeText(url);
      showToast('Link único da pesquisa copiado para a área de transferência!', 'success');
    }
  } else if (action === 'print-page') {
    window.print();
  } else if (action === 'open-invite-user-modal') {
    openInviteUserModal();
  } else if (action === 'submit-invite-user') {
    const form = document.getElementById('invite-user-form');
    if (!form) return;
    const email = form.email?.value?.trim();
    const role = form.role?.value;
    if (!email || !role) {
      showToast('Informe o e-mail e o papel do convidado.', 'error');
      return;
    }
    try {
      const res = await post('/management/team/invitations', { email, role });
      await store.loadTeam();
      closeDialog();
      showToast('Convite criado com sucesso!', 'success');
      if (res && res.token) {
        openInviteSuccessModal({ email, role, token: res.token });
      }
    } catch (err) {
      showToast(err.message || 'Erro ao criar convite.', 'error');
    }
  } else if (action === 'copy-invite-link') {
    const token = trigger.dataset.token;
    const fullUrl = `${window.location.origin}/#registro?invite=${token}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      showToast('Link de convite copiado para a área de transferência!', 'success');
    } else {
      showToast('Link: ' + fullUrl, 'info');
    }
  } else if (action === 'revoke-team-invitation') {
    const id = trigger.dataset.id;
    if (!window.confirm('Deseja realmente revogar este convite pendente?')) return;
    try {
      await del(`/management/team/invitations/${id}`);
      await store.loadTeam();
      showToast('Convite revogado com sucesso.', 'info');
    } catch (err) {
      showToast(err.message || 'Erro ao revogar convite.', 'error');
    }
  } else if (action === 'remove-team-member') {
    const id = trigger.dataset.id;
    const name = trigger.dataset.name || 'o membro';
    if (!window.confirm(`Deseja realmente remover ${name} da equipe? Esta pessoa perderá acesso ao sistema.`)) return;
    try {
      await del(`/management/team/${id}`);
      await store.loadTeam();
      showToast('Membro removido da equipe com sucesso.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao remover membro.', 'error');
    }
  } else if (action === 'save-company-name') {
    const form = document.getElementById('account-settings-form');
    const companyName = form?.companyName?.value?.trim();
    if (!companyName) {
      showToast('Informe o nome da empresa.', 'error');
      return;
    }
    try {
      await put('/meta/account', { companyName });
      await store.loadMeta();
      showToast('Nome da empresa atualizado com sucesso.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar dados.', 'error');
    }
  }
});

// Global form submit delegation
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-action]');
  if (!form) return;

  if (form.dataset.action === 'submit-login') {
    e.preventDefault();
    await handleLoginSubmit(form);
  } else if (form.dataset.action === 'submit-register') {
    e.preventDefault();
    await handleRegisterSubmit(form);
  } else if (form.dataset.action === 'submit-create-survey') {
    e.preventDefault();
    await submitSurveyCreation({ openImmediately: true });
  }
});

// Filter events in Organization
document.addEventListener('input', (e) => {
  if (e.target.id === 'member-search-input') {
    const query = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#members-table tbody tr[data-member-id]');
    rows.forEach(row => {
      const name = row.dataset.memberName || '';
      const email = row.dataset.memberEmail || '';
      const matches = !query || name.includes(query) || email.includes(query);
      row.style.display = matches ? '' : 'none';
    });
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.dataset.action === 'change-team-role') {
    const userId = e.target.dataset.id;
    const newRole = e.target.value;
    try {
      await put(`/management/team/${userId}`, { role: newRole });
      await store.loadTeam();
      showToast(`Papel atualizado com sucesso para ${roleLabels[newRole] || newRole}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar papel do usuário.', 'error');
      await store.loadTeam();
    }
  }
  if (e.target.name === 'model') {
    selectModel(e.target.value);
  }
  if (e.target.dataset.action === 'toggle-wizard-group' || e.target.name === 'groupIds') {
    updateWizardQuorum();
  }
  if (e.target.id === 'member-group-filter') {
    store.setState({ filterGroupId: e.target.value || null });
    const match = router.matchRoute(window.location.hash);
    if (match && match.route.path === 'organizacao/pessoas') {
      router.handleHashChange();
    }
  }
});

// App Bootstrapping
async function boot() {
  router.init('#app');

  // Handle direct /responder/:token URL paths if arrived via server path
  if (window.location.pathname.startsWith('/responder/')) {
    const token = window.location.pathname.split('/')[2];
    router.navigate(`responder/${token}`, { replace: true });
    return;
  }

  // Load account
  await store.loadAccount();

  // If no hash present, default to #hoje
  if (!window.location.hash) {
    window.location.hash = 'hoje';
  } else {
    router.handleHashChange();
  }

  // Auto-sync data in background on window focus and every 10s
  startAutoSync();
}

function startAutoSync() {
  const syncCurrentRouteData = async () => {
    if (document.hidden) return;
    if (document.getElementById('active-dialog-backdrop')) return;
    const state = store.getState();
    if (!state.account) return;

    const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'hoje';
    try {
      if (hash.startsWith('organizacao')) {
        await store.loadOrganization();
      } else if (hash === 'hoje') {
        await store.loadToday();
      } else if (hash.startsWith('pesquisas')) {
        await store.loadSurveys();
      } else if (hash.startsWith('resultados')) {
        await store.loadReports();
      } else if (hash.startsWith('acoes')) {
        await store.loadManagement();
      } else if (hash.startsWith('configuracoes')) {
        await store.loadManagement();
        if (state.account.role === 'owner') await store.loadTeam();
      }
    } catch {
      // Silent error handling during background auto-sync
    }
  };

  window.addEventListener('focus', syncCurrentRouteData);
  setInterval(syncCurrentRouteData, 10000);
}

boot().catch((err) => {
  console.error('Fatal initialization error:', err);
});
