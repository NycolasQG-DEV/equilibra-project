/* Main entry point for Equilibra Frontend Application */

import { router } from './core/router.js';
import { store } from './core/store.js';
import { setAuthFailureHandler } from './core/api.js';
import { showToast } from './ui/toast.js';

import { renderLogin, handleLoginSubmit, renderRegister, handleRegisterSubmit, handleLogout } from './features/auth/authView.js';
import { renderToday, mountedToday } from './features/today/todayView.js';
import {
  renderPeople,
  renderGroups,
  openAddMemberModal,
  submitAddMember,
  openAddGroupModal,
  submitAddGroup
} from './features/organization/organizationView.js';
import {
  renderSurveysList,
  renderSurveyDistribution,
  openExtendModal,
  submitExtendSurvey,
  openCloseEarlyModal,
  submitCloseEarly
} from './features/surveys/surveysView.js';
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
  } else if (action === 'open-add-member-modal') {
    openAddMemberModal();
  } else if (action === 'submit-add-member') {
    await submitAddMember();
  } else if (action === 'open-add-group-modal') {
    openAddGroupModal();
  } else if (action === 'submit-add-group') {
    await submitAddGroup();
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
  } else if (action === 'copy-invite-template') {
    const pre = document.getElementById('invite-template-text');
    if (pre) {
      navigator.clipboard.writeText(pre.textContent.trim());
      showToast('Modelo de convite copiado para a área de transferência.', 'success');
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
}

boot().catch(err => {
  console.error('Fatal initialization error:', err);
});
