/* Main entry point for Equilibra Frontend Application */

import { router } from './core/router.js';
import { store } from './core/store.js';
import { setAuthFailureHandler, post } from './core/api.js';
import { showToast } from './ui/toast.js';
import { closeDialog } from './ui/dialog.js';

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
  openAcceptModal,
  submitAcceptReport
} from './features/results/resultsView.js';
import {
  renderActionsList,
  openAddActionModal,
  submitAddAction
} from './features/actions/actionsView.js';
import { renderSettings } from './features/settings/settingsView.js';
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
  roles: ['owner', 'editor'],
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
  render: renderCycleReport
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
  load: () => store.loadManagement(),
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

document.addEventListener('change', (e) => {
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
