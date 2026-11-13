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
  openBulkDeleteMembersModal,
  submitBulkDeleteMembers,
  updateMemberSelectionUI,
  getSelectedMemberIds,
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
  openCloseSurveyModal,
  confirmCloseSurvey,
  openEditDatesModal,
  submitEditDates,
  startNextCycleInstant,
  scheduleNextCycleModal,
  submitScheduleNextCycle,
  openDeleteSurveyModal,
  submitDeleteSurvey,
  openBulkDeleteSurveysModal,
  submitBulkDeleteSurveys,
  updateSurveySelectionUI,
  getSelectedSurveyIds,
  handleOpenSurveyDirect,
  openNewCycle,
  openSurveyDetailsModal,
  openWhatsAppDispatchModal,
  submitWhatsAppDispatch,
  renderWhatsAppModalContent,
  disconnectWhatsAppDevice
} from './features/surveys/surveysView.js';
import {
  renderSurveyCreate,
  selectModel,
  openModelPreviewModal,
  setPeriodicity,
  updateWizardQuorum,
  selectAllWizardGroups,
  selectGeneralWizardGroup,
  submitSurveyCreation,
  goToWizardStep,
  nextWizardStep,
  prevWizardStep,
  openWizardWhatsAppWarningModal,
  mountedSurveyCreate
} from './features/surveys/surveyCreateView.js';
import {
  renderCyclesList,
  renderCycleReport,
  mountedCycleReport,
  openAcceptModal,
  submitAcceptReport,
  switchReportSlide,
  prevReportSlide,
  nextReportSlide
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
let deleteAccountCountdownTimer = null;

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
  render: renderSurveyCreate,
  mounted: mountedSurveyCreate
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
  // If surveys are currently selected, block opening individual survey links
  const openLink = e.target.closest('.survey-open-link, #surveys-table a[href]');
  if (openLink) {
    const selectedIds = getSelectedSurveyIds();
    if (selectedIds.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      showToast('Desmarque as pesquisas selecionadas para abrir uma pesquisa individualmente.', 'warning');
      return;
    }
  }

  // If members are currently selected, block individual member actions
  const memberAction = e.target.closest('.member-action-btn, #members-table [data-action="edit-member"], #members-table [data-action="delete-member"]');
  if (memberAction) {
    const selectedIds = getSelectedMemberIds();
    if (selectedIds.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      showToast('Desmarque os colaboradores selecionados para executar ações individuais.', 'warning');
      return;
    }
  }

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
  } else if (action === 'open-bulk-delete-members-modal') {
    openBulkDeleteMembersModal();
  } else if (action === 'confirm-bulk-delete-members') {
    await submitBulkDeleteMembers();
  } else if (action === 'toggle-select-all-members') {
    const visibleCheckboxes = Array.from(document.querySelectorAll('#members-table tbody tr:not([style*="display: none"]) .member-row-checkbox'));
    const allChecked = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb.checked);
    visibleCheckboxes.forEach(cb => { cb.checked = !allChecked; });
    updateMemberSelectionUI();
  } else if (action === 'clear-member-selection') {
    document.querySelectorAll('.member-row-checkbox').forEach(cb => { cb.checked = false; });
    updateMemberSelectionUI();
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
  } else if (action === 'open-close-survey-modal') {
    openCloseSurveyModal(trigger.dataset.id);
  } else if (action === 'confirm-close-survey') {
    await confirmCloseSurvey(trigger.dataset.id);
  } else if (action === 'open-edit-dates-modal') {
    openEditDatesModal(trigger.dataset.id);
  } else if (action === 'submit-edit-dates') {
    await submitEditDates(trigger.dataset.id);
  } else if (action === 'start-next-cycle-instant') {
    await startNextCycleInstant(trigger.dataset.previousId);
  } else if (action === 'schedule-next-cycle-modal') {
    scheduleNextCycleModal(trigger.dataset.previousId);
  } else if (action === 'submit-schedule-next-cycle') {
    await submitScheduleNextCycle(trigger.dataset.previousId);
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
    await handleOpenSurveyDirect(trigger.dataset.id, trigger);
  } else if (action === 'open-new-cycle') {
    openNewCycle(trigger.dataset.surveyId);
  } else if (action === 'open-survey-details') {
    openSurveyDetailsModal(trigger.dataset.id);
  } else if (action === 'open-delete-survey-modal') {
    openDeleteSurveyModal(trigger.dataset.id, trigger.dataset.title);
  } else if (action === 'confirm-delete-survey') {
    await submitDeleteSurvey(trigger.dataset.id);
  } else if (action === 'open-bulk-delete-surveys-modal') {
    openBulkDeleteSurveysModal();
  } else if (action === 'confirm-bulk-delete-surveys') {
    await submitBulkDeleteSurveys();
  } else if (action === 'toggle-select-all-surveys') {
    const rowCheckboxes = Array.from(document.querySelectorAll('.survey-row-checkbox'));
    const allChecked = rowCheckboxes.length > 0 && rowCheckboxes.every(cb => cb.checked);
    rowCheckboxes.forEach(cb => { cb.checked = !allChecked; });
    updateSurveySelectionUI();
  } else if (action === 'clear-survey-selection') {
    const rowCheckboxes = Array.from(document.querySelectorAll('.survey-row-checkbox'));
    rowCheckboxes.forEach(cb => { cb.checked = false; });
    updateSurveySelectionUI();
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
    await submitSurveyCreation();
  } else if (action === 'wizard-next-step') {
    nextWizardStep();
  } else if (action === 'wizard-prev-step') {
    prevWizardStep();
  } else if (action === 'switch-report-slide') {
    switchReportSlide(trigger.dataset.slideIndex);
  } else if (action === 'report-prev-slide') {
    prevReportSlide();
  } else if (action === 'report-next-slide') {
    nextReportSlide();
  } else if (action === 'open-whatsapp-dispatch-modal') {
    openWhatsAppDispatchModal(trigger.dataset.id);
  } else if (action === 'submit-whatsapp-dispatch') {
    submitWhatsAppDispatch(trigger.dataset.id);
  } else if (action === 'refresh-wa-qr') {
    renderWhatsAppModalContent(trigger.dataset.id);
  } else if (action === 'disconnect-wa-device' || action === 'reset-wa-auth') {
    disconnectWhatsAppDevice(trigger.dataset.id);
  } else if (action === 'open-wizard-wa-modal') {
    openWizardWhatsAppWarningModal();
  } else if (action === 'wizard-disconnect-wa') {
    post('/whatsapp/reset', {}).then(() => {
      showToast('Aparelho desconectado.', 'info');
      openWizardWhatsAppWarningModal();
    });
  } else if (action === 'dispatch-survey-whatsapp') {
    openWhatsAppDispatchModal(trigger.dataset.id);
  } else if (action === 'dispatch-survey-email') {
    const surveyId = trigger.dataset.id;
    if (!surveyId) return;
    trigger.disabled = true;
    const originalText = trigger.innerHTML;
    trigger.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Enviando...';

    post(`/surveys/${surveyId}/dispatch-email`, {})
      .then((res) => {
        showToast(res.message || 'Disparo de e-mails concluído!', res.ok ? 'success' : 'warning');
      })
      .catch((err) => {
        showToast(err.message || 'Falha ao enviar convites por e-mail.', 'error');
      })
      .finally(() => {
        trigger.disabled = false;
        trigger.innerHTML = originalText;
      });
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
      await store.loadAccount();
      showToast('Nome da empresa atualizado com sucesso.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar dados.', 'error');
    }
  } else if (action === 'open-delete-account-modal') {
    if (deleteAccountCountdownTimer) {
      clearInterval(deleteAccountCountdownTimer);
      deleteAccountCountdownTimer = null;
    }

    const content = `
      <div class="delete-survey-modal-content">
        <div class="delete-survey-warning">
          <div class="delete-survey-warning__header">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>Atenção: Exclusão Permanente da Organização</span>
          </div>
          <p class="delete-survey-warning__body">
            Você está prestes a excluir permanentemente a conta da sua organização e todos os dados associados:
          </p>
          <ul class="delete-survey-warning__list">
            <li>Todos os colaboradores cadastrados serão excluídos.</li>
            <li>Todas as pesquisas, questionários e respostas serão apagados do banco.</li>
            <li>Todos os relatórios gerados e planos de ação serão removidos.</li>
            <li>Sua sessão será encerrada e o acesso revogado imediatamente.</li>
          </ul>

          <div class="delete-survey-timer-box" id="delete-account-timer-container">
            <div class="delete-survey-timer-text">
              <span id="delete-account-timer-msg">
                <i class="fa-regular fa-clock" aria-hidden="true"></i> Leia o aviso com atenção antes de confirmar:
              </span>
              <span class="delete-survey-timer-badge" id="delete-account-timer-badge">
                <span id="delete-account-seconds-count">10</span>s
              </span>
            </div>
            <div class="delete-survey-progress">
              <div class="delete-survey-progress-bar" id="delete-account-progress-bar"></div>
            </div>
          </div>
        </div>
        <div class="form-group mt-3">
          <label class="form-label" for="confirm-delete-account-text">Para confirmar a exclusão definitiva, digite <strong>EXCLUIR</strong>:</label>
          <input type="text" id="confirm-delete-account-text" class="input" placeholder="EXCLUIR" autocomplete="off" disabled />
          <span class="table-subtext mt-1" id="confirm-delete-account-hint">Aguarde o tempo de leitura para habilitar a digitação.</span>
        </div>
      </div>
    `;
    const footer = `
      <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
      <button type="button" class="btn btn-danger" id="btn-confirm-delete-account" data-action="confirm-delete-account" disabled>
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir Organização Definitivamente
      </button>
    `;
    openDialog({
      title: 'Excluir Organização e Conta',
      content,
      footer,
      onClose: () => {
        if (deleteAccountCountdownTimer) {
          clearInterval(deleteAccountCountdownTimer);
          deleteAccountCountdownTimer = null;
        }
      }
    });

    const duration = 10;
    const totalMs = duration * 1000;
    const startTime = Date.now();

    const timerContainer = document.getElementById('delete-account-timer-container');
    const timerBadge = document.getElementById('delete-account-timer-badge');
    const secondsSpan = document.getElementById('delete-account-seconds-count');
    const progressBar = document.getElementById('delete-account-progress-bar');
    const timerMsg = document.getElementById('delete-account-timer-msg');
    const input = document.getElementById('confirm-delete-account-text');
    const hint = document.getElementById('confirm-delete-account-hint');
    const btn = document.getElementById('btn-confirm-delete-account');

    if (progressBar) {
      progressBar.style.width = '100%';
    }
    if (secondsSpan) {
      secondsSpan.textContent = String(duration);
    }

    deleteAccountCountdownTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, totalMs - elapsed);
      const secondsRemaining = Math.ceil(remainingMs / 1000);
      const pct = Math.max(0, (remainingMs / totalMs) * 100);

      if (secondsSpan) {
        secondsSpan.textContent = String(secondsRemaining);
      }
      if (progressBar) {
        progressBar.style.width = `${pct.toFixed(1)}%`;
      }

      if (remainingMs <= 0) {
        clearInterval(deleteAccountCountdownTimer);
        deleteAccountCountdownTimer = null;

        if (timerContainer) {
          timerContainer.classList.add('timer-completed');
        }
        if (timerMsg) {
          timerMsg.innerHTML = '<i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Tempo de leitura concluído. Digite <strong>EXCLUIR</strong> abaixo:';
        }
        if (timerBadge) {
          timerBadge.style.display = 'none';
        }
        if (progressBar) {
          progressBar.style.width = '0%';
        }
        if (input) {
          input.disabled = false;
          input.focus();
        }
        if (hint) {
          hint.textContent = 'Digite EXCLUIR em letras maiúsculas para habilitar a exclusão.';
        }
      }
    }, 50);

    if (input && btn) {
      input.addEventListener('input', () => {
        btn.disabled = input.value.trim().toUpperCase() !== 'EXCLUIR';
      });
    }
  } else if (action === 'confirm-delete-account') {
    const input = document.getElementById('confirm-delete-account-text');
    if (!input || input.value.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Digite EXCLUIR para confirmar.', 'warning');
      return;
    }
    try {
      await del('/auth/me');
      closeDialog();
      showToast('Organização e conta excluídas com sucesso.', 'success');
      window.location.hash = '#login';
      window.location.reload();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir conta.', 'error');
    }
  } else if (action === 'save-user-profile') {
    const form = document.getElementById('profile-settings-form');
    const name = form?.userName?.value?.trim();
    const avatarUrl = form?.avatarUrl?.value || undefined;
    if (!name) {
      showToast('Informe o seu nome completo.', 'error');
      return;
    }
    try {
      await put('/auth/me', { name, avatarUrl });
      await store.loadAccount();
      showToast('Perfil atualizado com sucesso.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar perfil.', 'error');
    }
  } else if (action === 'remove-avatar-photo') {
    try {
      await post('/auth/avatar', { avatarUrl: null });
      await store.loadAccount();
      const input = document.getElementById('profile-avatar-url');
      if (input) input.value = '';
      showToast('Foto de perfil removida com sucesso.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao remover foto.', 'error');
    }
  } else if (action === 'toggle-more-surveys') {
    const hiddenItems = document.querySelectorAll('.survey-item-collapsible');
    const btn = document.getElementById('btn-toggle-more-surveys');
    if (!hiddenItems.length || !btn) return;
    const isExpanded = btn.dataset.expanded === 'true';
    if (isExpanded) {
      hiddenItems.forEach(el => el.classList.add('hidden'));
      btn.dataset.expanded = 'false';
      btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-1" aria-hidden="true"></i> Mostrar mais (${hiddenItems.length} pesquisas)`;
    } else {
      hiddenItems.forEach(el => el.classList.remove('hidden'));
      btn.dataset.expanded = 'true';
      btn.innerHTML = `<i class="fa-solid fa-chevron-up mr-1" aria-hidden="true"></i> Mostrar menos`;
    }
  }
});

// Listener para upload de foto de perfil
document.addEventListener('change', async (e) => {
  const target = e.target;
  if (!target || target.dataset.action !== 'pick-avatar-file') return;
  const file = target.files?.[0];
  if (!file) return;

  try {
    showToast('Processando foto de perfil...', 'info');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          canvas.width = Math.min(256, size);
          canvas.height = canvas.width;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
          const avatarUrl = canvas.toDataURL('image/jpeg', 0.88);

          await post('/auth/avatar', { avatarUrl });
          await store.loadAccount();
          showToast('Foto de perfil salva com sucesso!', 'success');
        } catch (err) {
          showToast(err.message || 'Erro ao salvar foto de perfil.', 'error');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  } catch (err) {
    showToast('Não foi possível processar a imagem selecionada.', 'error');
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
    await submitSurveyCreation();
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
    updateMemberSelectionUI();
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'select-all-surveys') {
    const checked = e.target.checked;
    document.querySelectorAll('.survey-row-checkbox').forEach(cb => {
      cb.checked = checked;
    });
    updateSurveySelectionUI();
  }
  if (e.target.classList.contains('survey-row-checkbox')) {
    updateSurveySelectionUI();
  }
  if (e.target.id === 'select-all-members') {
    const checked = e.target.checked;
    const visibleCheckboxes = document.querySelectorAll('#members-table tbody tr:not([style*="display: none"]) .member-row-checkbox');
    visibleCheckboxes.forEach(cb => {
      cb.checked = checked;
    });
    updateMemberSelectionUI();
  }
  if (e.target.classList.contains('member-row-checkbox')) {
    updateMemberSelectionUI();
  }
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
  if (e.target.dataset.action === 'toggle-wizard-group' || e.target.name === 'groupId' || e.target.name === 'groupIds') {
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

  // Auto-sync data in background periodically
  startAutoSync();
}

function startAutoSync() {
  const syncCurrentRouteData = async () => {
    if (document.hidden) return;
    if (document.getElementById('active-dialog-backdrop')) return;

    // Não sincroniza enquanto houver seleção ativa, formulários em edição ou wizards abertos
    if (document.querySelector('.selection-active, .survey-row-checkbox:checked, .member-row-checkbox:checked')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    const state = store.getState();
    if (!state.account) return;

    const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'hoje';
    if (hash === 'pesquisas/nova' || hash.includes('/nova')) return;

    try {
      if (hash.startsWith('organizacao')) {
        await store.loadOrganization();
      } else if (hash === 'hoje') {
        await store.loadToday();
      } else if (hash === 'pesquisas') {
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

  // Sincronização periódica suave em segundo plano (60s), sem listener agressivo de foco
  setInterval(syncCurrentRouteData, 60000);
}

boot().catch((err) => {
  console.error('Fatal initialization error:', err);
});
