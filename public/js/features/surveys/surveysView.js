/* Surveys feature: Listing, creation wizard, and distribution management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmtPercent, date } from '../../domain/formatters.js';
import { surveyStatusLabels } from '../../domain/labels.js';
import { post, del } from '../../core/api.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';

export function renderSurveysList({ state }) {
  const surveys = state.surveys || [];
  const account = state.account || {};
  const isViewer = account.role === 'viewer';

  const content = `
    <div class="surveys-page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="view-title">Pesquisas de Clima & Fatores Psicossociais</h1>
          <p class="view-subtitle">
            Ciclos de escuta confidencial para mapeamento coletivo das condições de trabalho
          </p>
        </div>
        <div>
          ${!isViewer ? `
            <a href="#pesquisas/nova" class="btn btn-primary">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Pesquisa
            </a>
          ` : ''}
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Título / Instrumento</th>
              <th>Ciclo</th>
              <th>Status</th>
              <th>Público Convidado</th>
              <th>Adesão / Quórum</th>
              <th>Encerramento</th>
              <th class="text-right table-actions-cell">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${surveys.length === 0 ? `
              <tr>
                <td colspan="7" class="table-empty-cell">
                  Nenhuma pesquisa cadastrada.
                </td>
              </tr>
            ` : surveys.map(s => {
              const statusLabel = surveyStatusLabels[s.status] || s.status;
              const statusClass = s.status === 'open' ? 'badge-success' : s.status === 'closed' ? 'badge-neutral' : 'badge-warning';
              const invitedCount = s.memberIds?.length || 0;
              const responsesCount = s.responsesCount || 0;
              const rate = invitedCount > 0 ? responsesCount / invitedCount : 0;

              return `
                <tr>
                  <td>
                    <strong>${esc(s.title)}</strong>
                    <div class="table-subtext"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i> Modelo: <strong>${esc(s.model || 'Diagnóstico')}</strong></div>
                  </td>
                  <td>${esc(s.cycle || '—')}</td>
                  <td><span class="badge ${statusClass}">${esc(statusLabel)}</span></td>
                  <td><span class="num">${invitedCount}</span> pessoas</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="num font-semibold">${fmtPercent(rate)}</span>
                      <span class="table-subtext">(${responsesCount} resp.)</span>
                    </div>
                  </td>
                  <td>${date(s.endsAt)}</td>
                  <td class="text-right table-actions-cell">
                    <div class="table-actions-inline">
                      ${s.status === 'open' ? `
                        <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm">
                          <i class="fa-solid fa-circle-info" aria-hidden="true"></i> Ver mais informações
                        </a>
                      ` : s.status === 'closed' ? `
                        <a href="#resultados/ciclo/${attr(s.id)}" class="btn btn-secondary btn-sm">
                          <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Relatório
                        </a>
                      ` : !isViewer ? `
                        <button type="button" class="btn btn-primary btn-sm" data-action="open-survey-direct" data-id="${attr(s.id)}">
                          Abrir Coleta
                        </button>
                      ` : `
                        <span class="badge badge-neutral">Rascunho</span>
                      `}
                      ${!isViewer ? `
                        <button type="button" class="btn btn-ghost color-danger btn-sm btn-icon" data-action="open-delete-survey-modal" data-id="${attr(s.id)}" data-title="${attr(s.title)}" title="Excluir pesquisa">
                          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'pesquisas',
    breadcrumbs: [{ label: 'Pesquisas' }],
    content,
    state
  });
}

export function renderSurveyDistribution({ params, state }) {
  const surveyId = params.id;
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  const isViewer = state.account?.role === 'viewer';

  if (!survey) {
    return renderShell({
      activePath: 'pesquisas',
      breadcrumbs: [{ label: 'Pesquisas', path: 'pesquisas' }, { label: 'Distribuição' }],
      content: '<p>Pesquisa não encontrada.</p>',
      state
    });
  }

  const invitedCount = survey.memberIds?.length || 0;
  const responsesCount = survey.responsesCount || survey.responseCount || 0;
  const rate = invitedCount > 0 ? responsesCount / invitedCount : 0;

  const baseUrl = window.location.origin;
  const surveyDirectUrl = `${baseUrl}/responder/${survey.id}`;

  const templates = state.meta?.templates || [];
  const modelTemplate = templates.find(t => t.name === survey.model) || null;
  const instrument = survey.instrument || modelTemplate || {};

  const questions = (instrument.factors || []).map((f, i) => ({
    num: i + 1,
    factor: f[1] || 'Item',
    text: f[2] || f[1] || ''
  }));

  const accountGroups = state.groups || [];
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const groupNames = surveyGroupIds.map(gid => {
    const g = accountGroups.find(ag => ag.id === gid);
    return g ? g.name : null;
  }).filter(Boolean);

  const groupDisplay = groupNames.length > 0
    ? groupNames.join(', ')
    : (survey.groupName || survey.groupNamesSnapshot?.join(', ') || 'Geral');

  const content = `
    <div class="survey-dist-page">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <a href="#pesquisas" class="btn btn-ghost btn-sm">
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar
            </a>
            <h1 class="view-title m-0">Informações da Pesquisa</h1>
          </div>
          <p class="view-subtitle ml-1">
            <strong>${esc(survey.title)}</strong> · Ciclo: <strong>${esc(survey.cycle || 'Geral')}</strong> · Modelo: <strong>${esc(survey.model || 'Diagnóstico')}</strong>
          </p>
        </div>
        ${!isViewer ? `
          <div class="flex gap-2 flex-wrap">
            <button type="button" class="btn btn-secondary" data-action="open-extend-modal" data-id="${attr(survey.id)}">
              <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Prorrogar Prazo
            </button>
            <button type="button" class="btn btn-secondary" data-action="open-close-early-modal" data-id="${attr(survey.id)}">
              <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar
            </button>
            <button type="button" class="btn btn-ghost color-danger" data-action="open-delete-survey-modal" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}" title="Excluir pesquisa">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir Pesquisa
            </button>
          </div>
        ` : ''}
      </div>

      <!-- ENVIO E COLETA VIA WHATSAPP -->
      <div class="card mb-6 border-2 border-primary bg-surface p-5">
        <div class="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h2 class="card-title text-lg flex items-center gap-2 m-0">
              <i class="fa-brands fa-whatsapp color-success" aria-hidden="true"></i> Envio e Coleta via WhatsApp
            </h2>
            <p class="table-subtext m-0 mt-1">
              Dispare as perguntas diretamente no WhatsApp dos colaboradores cadastrados com telefone.
            </p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <a href="/wa/connect" target="_blank" class="btn btn-secondary" title="Ver QR Code e status da conexão">
              <i class="fa-solid fa-qrcode" aria-hidden="true"></i> Conectar Aparelho
            </a>
            ${!isViewer && survey.status === 'open' ? `
              <button type="button" class="btn btn-primary" data-action="dispatch-survey-whatsapp" data-id="${attr(survey.id)}">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Disparar Mensagens Agora
              </button>
            ` : ''}
          </div>
        </div>
        <div class="card bg-subtle p-3 flex items-center justify-between text-sm flex-wrap gap-2">
          <span>Canal configurado: <strong>${survey.collectionChannel === 'whatsapp' ? 'WhatsApp (Bot Interativo)' : 'Web (Links)'}</strong></span>
          <span class="text-xs table-subtext"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Certifique-se de que o aparelho esteja conectado antes de disparar.</span>
        </div>
      </div>

      <!-- LINK ÚNICO DA PESQUISA (Destaque Principal) -->
      <div class="card mb-6 border-2 border-primary bg-surface p-5">
        <div class="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h2 class="card-title text-lg flex items-center gap-2 m-0">
              <i class="fa-solid fa-link color-primary" aria-hidden="true"></i> Link Único da Pesquisa
            </h2>
            <p class="table-subtext m-0 mt-1">
              Todos os colaboradores dos grupos participantes podem responder através deste link único confidencial.
            </p>
          </div>
          <button type="button" class="btn btn-primary" data-action="copy-survey-url" data-url="${attr(surveyDirectUrl)}">
            <i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar Link Único
          </button>
        </div>

        <div class="flex items-center gap-2 mb-4">
          <input type="text" id="survey-direct-link-input" class="input input-lg font-mono flex-1 bg-surface-subtle" value="${attr(surveyDirectUrl)}" readonly />
          <button type="button" class="btn btn-secondary btn-lg" data-action="copy-survey-url" data-url="${attr(surveyDirectUrl)}">
            Copiar
          </button>
          <a href="${attr(surveyDirectUrl)}" target="_blank" class="btn btn-ghost btn-lg" title="Abrir questionário em nova aba">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>

        <div class="card bg-subtle p-4">
          <div class="flex items-center justify-between mb-2">
            <strong class="text-sm">Modelo de Mensagem Pronto (WhatsApp / E-mail):</strong>
            <button type="button" class="btn btn-ghost btn-sm" data-action="copy-invite-template">
              <i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar Mensagem
            </button>
          </div>
          <pre id="invite-template-text" class="table-subtext m-0 whitespace-pre-wrap font-sans">Olá! Sua voz é fundamental para construirmos um ambiente de trabalho mais saudável.
Participe da nossa pesquisa confidencial sobre fatores psicossociais e condições de trabalho.
Leva apenas alguns minutos e suas respostas são 100% confidenciais e anônimas (processadas de forma agregada).

Acesse pelo link: ${surveyDirectUrl}
Prazo final: ${date(survey.endsAt)}.</pre>
        </div>
      </div>

      <!-- KPIS DE ADESÃO E QUÓRUM -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="kpi-card">
          <span class="kpi-title">Adesão Atual</span>
          <div class="kpi-val">${fmtPercent(rate)}</div>
          <span class="kpi-sub">${responsesCount} de ${invitedCount} convidados responderam</span>
          <div class="dist-bar mt-2">
            <div class="dist-bar-seg bg-primary" data-width="${Math.min(100, Math.round(rate * 100))}"></div>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Prazo de Coleta</span>
          <div class="kpi-val">${date(survey.endsAt)}</div>
          <span class="kpi-sub">Encerramento automático às 23:59</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Quórum Mínimo Configurado</span>
          <div class="kpi-val color-success">Meta 70%</div>
          <span class="kpi-sub">Anonimato assegurado (N ≥ 5)</span>
        </div>
      </div>

      <!-- DETALHES DO MODELO & AFIRMAÇÕES -->
      <div class="card mb-6">
        <div class="card-header">
          <div>
            <h2 class="card-title"><i class="fa-solid fa-clipboard-list color-primary" aria-hidden="true"></i> Instrumento: ${esc(survey.model || 'Diagnóstico')}</h2>
            <span class="table-subtext">Grupos participantes: <strong>${esc(groupDisplay)}</strong> (${invitedCount} pessoas vinculadas)</span>
          </div>
          <span class="badge badge-neutral">${questions.length} afirmações</span>
        </div>
        <div class="card-body">
          ${instrument.instructions ? `
            <div class="card bg-subtle p-3 mb-4">
              <p class="table-subtext m-0"><strong>Instruções aos colaboradores:</strong> ${esc(instrument.instructions)}</p>
            </div>
          ` : ''}

          <div class="questions-preview-list">
            ${questions.map(q => `
              <div class="question-preview-item">
                <div class="question-num">${q.num}</div>
                <div class="question-body">
                  <div class="question-factor">${esc(q.factor)}</div>
                  <p class="question-text">${esc(q.text)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'pesquisas',
    breadcrumbs: [
      { label: 'Pesquisas', path: 'pesquisas' },
      { label: survey.title, path: `pesquisas/${survey.id}/distribuicao` },
      { label: 'Informações' }
    ],
    content,
    state
  });
}

export function openExtendModal(surveyId) {
  const content = `
    <form id="extend-survey-form">
      ${field({
        id: 'ext-date',
        name: 'newEndsAt',
        label: 'Nova data de encerramento',
        type: 'date',
        required: true
      })}
    </form>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-extend-survey" data-id="${attr(surveyId)}">Salvar Prorrogação</button>
  `;
  openDialog({ title: 'Prorrogar Prazo de Coleta', content, footer });
}

export async function submitExtendSurvey(surveyId) {
  const form = document.getElementById('extend-survey-form');
  if (!form) return;
  const newEndsAt = form.newEndsAt.value;
  if (!newEndsAt) {
    showToast('Informe a nova data.', 'error');
    return;
  }
  try {
    await post(`/surveys/${surveyId}/extend`, { newEndsAt });
    await store.loadSurveys();
    closeDialog();
    showToast('Prazo prorrogado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao prorrogar.', 'error');
  }
}

export function openCloseEarlyModal(surveyId) {
  const content = `
    <div class="py-2">
      <p class="color-danger font-semibold mb-2">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Atenção: Encerramento definitivo
      </p>
      <p class="view-subtitle mb-3">
        Ao encerrar antecipadamente, nenhum novo questionário poderá ser enviado. Se o quórum atingido for inferior a 5 respostas, o relatório será suprimido para proteger a confidencialidade dos respondentes.
      </p>
      ${field({
        id: 'close-reason',
        name: 'reason',
        label: 'Justificativa do encerramento antecipado',
        required: true,
        placeholder: 'ex: Metas de respostas antecipadas atingidas / Término de ciclo'
      })}
    </div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Voltar</button>
    <button type="button" class="btn btn-danger" data-action="submit-close-early" data-id="${attr(surveyId)}">Confirmar Encerramento</button>
  `;
  openDialog({ title: 'Encerrar Pesquisa Antecipadamente', content, footer });
}

export async function submitCloseEarly(surveyId) {
  const form = document.querySelector('.dialog-body');
  const reasonInput = form?.querySelector('input[name="reason"]');
  const reason = reasonInput?.value?.trim();
  if (!reason) {
    showToast('Informe a justificativa do encerramento.', 'error');
    return;
  }
  try {
    await post(`/surveys/${surveyId}/close`, { confirmEarlyClose: true, reason });
    await store.loadSurveys();
    closeDialog();
    showToast('Pesquisa encerrada com sucesso.', 'info');
    router.navigate(`resultados/ciclo/${surveyId}`);
  } catch (err) {
    showToast(err.message || 'Erro ao encerrar.', 'error');
  }
}

let deleteCountdownTimer = null;

export function openDeleteSurveyModal(surveyId, title) {
  // Limpa timer anterior se houver
  if (deleteCountdownTimer) {
    clearInterval(deleteCountdownTimer);
    deleteCountdownTimer = null;
  }

  let secondsLeft = 10;

  const content = `
    <div class="delete-survey-modal-content">
      <div class="delete-survey-warning">
        <div class="delete-survey-warning__header">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>Atenção: Ação irreversível de exclusão</span>
        </div>
        <p class="delete-survey-warning__body">
          Você está prestes a excluir permanentemente a pesquisa <strong>"${esc(title)}"</strong>.
        </p>
        <ul class="delete-survey-warning__list">
          <li>Todos os questionários e links únicos de resposta serão desativados.</li>
          <li>Respostas já enviadas e métricas vinculadas a este ciclo serão excluídas.</li>
          <li>Os grupos vinculados serão liberados para novos ciclos de pesquisa.</li>
        </ul>

        <div class="delete-survey-timer-box" id="delete-timer-container">
          <div class="delete-survey-timer-text">
            <span id="delete-timer-msg">
              <i class="fa-regular fa-clock" aria-hidden="true"></i> Leia o aviso com atenção antes de confirmar:
            </span>
            <span class="delete-survey-timer-badge" id="delete-timer-badge">
              <span id="delete-seconds-count">10</span>s
            </span>
          </div>
          <div class="delete-survey-progress">
            <div class="delete-survey-progress-bar" id="delete-progress-bar"></div>
          </div>
        </div>
      </div>

      <label class="delete-survey-consent-row disabled" id="delete-consent-label">
        <input type="checkbox" id="delete-survey-consent-checkbox" disabled />
        <span class="delete-survey-consent-label">
          Compreendo que a exclusão da pesquisa <strong>"${esc(title)}"</strong> é irreversível e desejo prosseguir.
        </span>
      </label>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btn-confirm-delete-survey" data-action="confirm-delete-survey" data-id="${attr(surveyId)}" disabled>
      <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Apagar Pesquisa
    </button>
  `;

  openDialog({
    title: 'Excluir Pesquisa',
    content,
    footer,
    onClose: () => {
      if (deleteCountdownTimer) {
        clearInterval(deleteCountdownTimer);
        deleteCountdownTimer = null;
      }
    }
  });

  // Elementos do diálogo aberto
  const timerContainer = document.getElementById('delete-timer-container');
  const timerBadge = document.getElementById('delete-timer-badge');
  const secondsSpan = document.getElementById('delete-seconds-count');
  const progressBar = document.getElementById('delete-progress-bar');
  const timerMsg = document.getElementById('delete-timer-msg');
  const consentLabel = document.getElementById('delete-consent-label');
  const consentCheckbox = document.getElementById('delete-survey-consent-checkbox');
  const deleteBtn = document.getElementById('btn-confirm-delete-survey');

  // Inicializa temporizador de 10 segundos
  deleteCountdownTimer = setInterval(() => {
    secondsLeft -= 1;

    if (secondsSpan) {
      secondsSpan.textContent = String(Math.max(0, secondsLeft));
    }

    if (progressBar) {
      progressBar.style.width = `${Math.max(0, (secondsLeft / 10) * 100)}%`;
    }

    if (secondsLeft <= 0) {
      clearInterval(deleteCountdownTimer);
      deleteCountdownTimer = null;

      if (timerContainer) {
        timerContainer.classList.add('timer-completed');
      }
      if (timerMsg) {
        timerMsg.innerHTML = '<i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Tempo de leitura concluído. Você já pode marcar a confirmação abaixo:';
      }
      if (timerBadge) {
        timerBadge.style.display = 'none';
      }
      if (progressBar) {
        progressBar.style.width = '0%';
      }

      // Libera a checkbox
      if (consentCheckbox && consentLabel) {
        consentCheckbox.disabled = false;
        consentLabel.classList.remove('disabled');
      }
    }
  }, 1000);

  // Escuta alteração da checkbox para liberar o botão de exclusão
  if (consentCheckbox && deleteBtn) {
    consentCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        deleteBtn.disabled = false;
        deleteBtn.focus();
      } else {
        deleteBtn.disabled = true;
      }
    });
  }
}

export async function submitDeleteSurvey(surveyId) {
  const consentCheckbox = document.getElementById('delete-survey-consent-checkbox');
  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Você precisa marcar a caixa de confirmação para poder apagar a pesquisa.', 'warning');
    return;
  }

  try {
    await del(`/surveys/${surveyId}`);
    await store.loadSurveys();
    closeDialog();
    showToast('Pesquisa excluída com sucesso.', 'success');
    if (window.location.hash.includes(surveyId)) {
      router.navigate('pesquisas');
    }
  } catch (err) {
    showToast(err.message || 'Erro ao excluir pesquisa.', 'error');
  }
}

export async function handleOpenSurveyDirect(surveyId) {
  try {
    await post(`/surveys/${surveyId}/open`, {});
    await store.loadSurveys();
    showToast('Coleta aberta com sucesso!', 'success');
    router.navigate(`pesquisas/${surveyId}/distribuicao`);
  } catch (err) {
    showToast(err.message || 'Erro ao abrir pesquisa.', 'error');
  }
}

export function openSurveyDetailsModal(surveyId) {
  const state = store.getState();
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) {
    showToast('Pesquisa não encontrada.', 'error');
    return;
  }

  const templates = state.meta?.templates || [];
  const modelTemplate = templates.find(t => t.name === survey.model) || null;
  const instrument = survey.instrument || modelTemplate || {};

  const questions = (instrument.factors || []).map((f, i) => ({
    num: i + 1,
    factor: f[1] || 'Item',
    text: f[2] || f[1] || ''
  }));

  const statusLabel = surveyStatusLabels[survey.status] || survey.status;
  const statusClass = survey.status === 'open' ? 'badge-success' : survey.status === 'closed' ? 'badge-neutral' : 'badge-warning';
  const invitedCount = survey.memberIds?.length || 0;
  const responsesCount = survey.responsesCount || survey.responseCount || 0;
  const rate = invitedCount > 0 ? responsesCount / invitedCount : 0;

  const accountGroups = state.groups || [];
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const groupNames = surveyGroupIds.map(gid => {
    const g = accountGroups.find(ag => ag.id === gid);
    return g ? g.name : null;
  }).filter(Boolean);

  const groupDisplay = groupNames.length > 0
    ? groupNames.join(', ')
    : (survey.groupName || survey.groupNamesSnapshot?.join(', ') || 'Geral');

  const content = `
    <div class="survey-details-modal">
      <div class="card bg-subtle p-4 mb-4">
        <div class="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="badge ${statusClass}">${esc(statusLabel)}</span>
            <span class="badge badge-neutral"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i> ${esc(survey.model || 'Diagnóstico')}</span>
          </div>
          <span class="table-subtext">Criado em: ${date(survey.createdAt)}</span>
        </div>
        <p class="view-subtitle m-0">Ciclo: <strong>${esc(survey.cycle || '—')}</strong></p>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="kpi-card p-3">
          <span class="kpi-title">Público Convidado</span>
          <div class="kpi-val text-lg">${invitedCount} pessoas</div>
          <span class="kpi-sub">Grupos: ${esc(groupDisplay)}</span>
        </div>
        <div class="kpi-card p-3">
          <span class="kpi-title">Adesão / Quórum</span>
          <div class="kpi-val text-lg">${fmtPercent(rate)} (${responsesCount} respostas)</div>
          <span class="kpi-sub">Prazo: até ${date(survey.endsAt)}</span>
        </div>
      </div>

      ${instrument.instructions ? `
        <div class="card bg-surface p-3 mb-4 border">
          <strong class="text-sm color-primary"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Instruções do Instrumento:</strong>
          <p class="table-subtext mt-1 mb-0">${esc(instrument.instructions)}</p>
        </div>
      ` : ''}

      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-base m-0">Afirmações do Modelo (${questions.length} itens)</h3>
        <span class="badge badge-subtle">Anonimato assegurado</span>
      </div>

      <div class="questions-preview-list max-h-60 overflow-y-auto pr-1">
        ${questions.length === 0 ? `
          <p class="table-subtext">Nenhuma afirmação configurada para este instrumento.</p>
        ` : questions.map(q => `
          <div class="question-preview-item py-2">
            <div class="question-num">${q.num}</div>
            <div class="question-body">
              <div class="question-factor">${esc(q.factor)}</div>
              <p class="question-text">${esc(q.text)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Fechar</button>
    ${survey.status === 'open' ? `
      <a href="#pesquisas/${attr(survey.id)}/distribuicao" class="btn btn-primary" data-action="close-dialog">
        <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Acompanhar Coleta
      </a>
    ` : survey.status === 'closed' ? `
      <a href="#resultados/ciclo/${attr(survey.id)}" class="btn btn-primary" data-action="close-dialog">
        <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Ver Relatório
      </a>
    ` : ''}
  `;

  openDialog({
    title: `Detalhes: ${survey.title}`,
    content,
    footer,
    size: 'lg'
  });
}

