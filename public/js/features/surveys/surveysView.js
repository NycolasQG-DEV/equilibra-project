/* Surveys feature: Listing, creation wizard, and distribution management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmtPercent, date } from '../../domain/formatters.js';
import { surveyStatusLabels } from '../../domain/labels.js';
import { get, post, put, del } from '../../core/api.js';
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
            Escutas coletivas e mapeamento de fatores psicossociais
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

      <!-- Barra de Ações em Massa (visível ao selecionar 1 ou mais pesquisas) -->
      <div id="surveys-bulk-toolbar" class="surveys-bulk-toolbar hidden mb-4">
        <div class="flex items-center gap-3">
          <span class="badge badge-primary font-semibold" id="surveys-bulk-count-label">0 pesquisas selecionadas</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-select-all-surveys">
            <i class="fa-solid fa-check-double" aria-hidden="true"></i> Marcar todas
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="clear-survey-selection">
            Desmarcar todas
          </button>
          ${!isViewer ? `
            <button type="button" class="btn btn-danger btn-sm" data-action="open-bulk-delete-surveys-modal">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir selecionadas
            </button>
          ` : ''}
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" id="surveys-table">
          <thead>
            <tr>
              ${!isViewer ? `
                <th class="survey-select-col">
                  <input type="checkbox" id="select-all-surveys" class="survey-checkbox" title="Marcar todas as pesquisas" aria-label="Marcar todas as pesquisas">
                </th>
              ` : ''}
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
                <td colspan="${!isViewer ? '8' : '7'}" class="table-empty-cell">
                  Nenhuma pesquisa cadastrada.
                </td>
              </tr>
            ` : surveys.map(s => {
              const statusLabel = surveyStatusLabels[s.status] || s.status;
              const statusClass = s.status === 'open' ? 'badge-success' : s.status === 'closed' ? 'badge-neutral' : 'badge-warning';
              const invitedCount = s.invitedCount || s.groupSize || s.memberIds?.length || 0;
              const responsesCount = s.responsesCount || s.responseCount || 0;
              const rate = s.participationRate != null ? s.participationRate : (invitedCount > 0 ? responsesCount / invitedCount : 0);

              return `
                <tr data-survey-row-id="${attr(s.id)}">
                  ${!isViewer ? `
                    <td class="survey-select-col">
                      <input type="checkbox" class="survey-checkbox survey-row-checkbox" value="${attr(s.id)}" data-survey-id="${attr(s.id)}" aria-label="Selecionar ${attr(s.title)}">
                    </td>
                  ` : ''}
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
                    <div class="dist-bar dist-bar-sm mt-1" title="Adesão: ${fmtPercent(rate)}">
                      <div class="dist-bar-seg bg-primary" data-width="${Math.min(100, Math.round(rate * 100))}"></div>
                    </div>
                  </td>
                  <td>${date(s.endsAt)}</td>
                  <td class="text-right table-actions-cell">
                    <div class="table-actions-inline survey-row-actions">
                      ${s.status === 'open' ? `
                        <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm survey-open-link" data-survey-open="true">
                          <i class="fa-solid fa-circle-info" aria-hidden="true"></i> Ver mais
                        </a>
                        ${rate >= 0.70 ? `
                          <button type="button" class="btn btn-secondary btn-sm" data-action="open-close-survey-modal" data-id="${attr(s.id)}">
                            <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar Coleta
                          </button>
                        ` : `
                          <span class="survey-close-wrapper" title="Necessário atingir mais de 70% de respostas para encerrar a coleta e consolidar os dados (atual: ${Math.round(rate * 100)}%).">
                            <button type="button" class="btn btn-secondary btn-sm" disabled>
                              <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar
                            </button>
                          </span>
                        `}
                        ${!isViewer ? `
                          <button type="button" class="btn btn-ghost btn-sm btn-icon" data-action="open-edit-dates-modal" data-id="${attr(s.id)}" title="Editar datas da pesquisa">
                            <i class="fa-regular fa-calendar-days" aria-hidden="true"></i>
                          </button>
                        ` : ''}
                      ` : s.status === 'closed' ? `
                        <a href="#resultados/ciclo/${attr(s.id)}" class="btn btn-secondary btn-sm survey-open-link" data-survey-open="true">
                          <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Relatório
                        </a>
                        ${!isViewer ? `
                          <button type="button" class="btn btn-ghost btn-sm" data-action="start-next-cycle-instant" data-previous-id="${attr(s.id)}" title="Iniciar próximo ciclo imediatamente">
                            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Novo Ciclo
                          </button>
                        ` : ''}
                      ` : !isViewer ? `
                        <button type="button" class="btn btn-primary btn-sm survey-open-link" data-action="open-survey-direct" data-id="${attr(s.id)}" data-survey-open="true">
                          <i class="fa-solid fa-rocket" aria-hidden="true"></i> Abrir Coleta
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm btn-icon" data-action="open-edit-dates-modal" data-id="${attr(s.id)}" title="Editar datas da pesquisa">
                          <i class="fa-regular fa-calendar-days" aria-hidden="true"></i>
                        </button>
                      ` : `
                        <span class="badge badge-neutral">Rascunho</span>
                      `}
                      ${!isViewer ? `
                        <button type="button" class="btn btn-ghost color-danger btn-sm btn-icon survey-row-delete-btn" data-action="open-delete-survey-modal" data-id="${attr(s.id)}" data-title="${attr(s.title)}" title="Excluir pesquisa">
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

  const invitedCount = survey.invitedCount || survey.groupSize || survey.memberIds?.length || 0;
  const responsesCount = survey.responsesCount || survey.responseCount || 0;
  const rate = survey.participationRate != null ? survey.participationRate : (invitedCount > 0 ? responsesCount / invitedCount : 0);

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
            ${survey.status !== 'closed' ? `
              <button type="button" class="btn btn-secondary" data-action="open-edit-dates-modal" data-id="${attr(survey.id)}">
                <i class="fa-regular fa-calendar-days" aria-hidden="true"></i> Editar Datas
              </button>
            ` : ''}
            ${survey.status === 'open' ? `
              <button type="button" class="btn btn-primary" data-action="dispatch-survey-email" data-id="${attr(survey.id)}">
                <i class="fa-regular fa-paper-plane" aria-hidden="true"></i> Disparar Convites por E-mail
              </button>
              <button type="button" class="btn btn-secondary" data-action="open-extend-modal" data-id="${attr(survey.id)}">
                <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Prorrogar Prazo
              </button>
              ${(() => {
                const target = survey.participationTarget || 0.70;
                const canClose = rate >= target;
                const pct = Math.round(rate * 100);
                const tooltipMsg = canClose
                  ? ''
                  : `Necessário atingir mais de 70% de respostas para encerrar a coleta e consolidar os dados (atual: ${pct}%).`;
                return canClose
                  ? `<button type="button" class="btn btn-secondary" data-action="open-close-survey-modal" data-id="${attr(survey.id)}">
                      <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar Coleta
                    </button>`
                  : `<span class="survey-close-wrapper" title="${attr(tooltipMsg)}">
                      <button type="button" class="btn btn-secondary" disabled>
                        <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar Coleta
                      </button>
                    </span>`;
              })()}
            ` : ''}
            <button type="button" class="btn btn-ghost color-danger" data-action="open-delete-survey-modal" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}" title="Excluir pesquisa">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir Pesquisa
            </button>
          </div>
        ` : ''}
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
          <span class="kpi-title">Quórum da Amostra</span>
          <div class="kpi-val ${rate >= 0.70 ? 'color-success' : 'color-neutral'}">${rate >= 0.70 ? 'Quórum Atingido' : 'Em Andamento'}</div>
          <span class="kpi-sub">Taxa de resposta do ciclo</span>
        </div>
      </div>

      <!-- PRÓXIMO CICLO: exibido após encerramento -->
      ${(() => {
        if (survey.status !== 'closed' || isViewer) return '';
        const allSurveys = state.surveys || [];
        const nextScheduled = allSurveys.find(s => s.status === 'draft' && (s.previousSurveyId === survey.id || (s.model === survey.model && s.id !== survey.id)));
        if (nextScheduled) {
          return `
            <div class="card mb-6 border-2 border-card-success bg-surface p-5">
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 class="card-title text-lg flex items-center gap-2 m-0">
                    <i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Ciclo Concluído & Próximo Ciclo Agendado
                  </h2>
                  <p class="table-subtext m-0 mt-1">
                    Este ciclo foi encerrado. O próximo ciclo (<strong>${esc(nextScheduled.title || nextScheduled.cycle)}</strong>) está agendado para <strong>${date(nextScheduled.startsAt || nextScheduled.endsAt)}</strong> e iniciará automaticamente nessa data.
                  </p>
                </div>
                <div class="flex gap-2 flex-wrap">
                  <a href="#resultados/ciclo/${attr(survey.id)}" class="btn btn-secondary">
                    <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Ver Relatório
                  </a>
                  <button type="button" class="btn btn-primary" data-action="open-survey-direct" data-id="${attr(nextScheduled.id)}">
                    <i class="fa-solid fa-bolt" aria-hidden="true"></i> Iniciar Próximo Ciclo Agora
                  </button>
                  <button type="button" class="btn btn-ghost" data-action="open-edit-dates-modal" data-id="${attr(nextScheduled.id)}" title="Editar data do próximo ciclo">
                    <i class="fa-regular fa-calendar-days" aria-hidden="true"></i> Editar Data Agendada
                  </button>
                </div>
              </div>
            </div>
          `;
        }
        return `
          <div class="card mb-6 border-2 border-card-success bg-surface p-5">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 class="card-title text-lg flex items-center gap-2 m-0">
                  <i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Ciclo Concluído
                </h2>
                <p class="table-subtext m-0 mt-1">
                  Este ciclo de coleta foi encerrado. Você pode ver o relatório consolidado ou liberar o próximo ciclo instantaneamente pelo botão abaixo.
                </p>
              </div>
              <div class="flex gap-2 flex-wrap">
                <a href="#resultados/ciclo/${attr(survey.id)}" class="btn btn-secondary">
                  <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Ver Relatório
                </a>
                <button type="button" class="btn btn-primary" data-action="start-next-cycle-instant" data-previous-id="${attr(survey.id)}">
                  <i class="fa-solid fa-bolt" aria-hidden="true"></i> Iniciar Próximo Ciclo Agora
                </button>
                <button type="button" class="btn btn-secondary" data-action="schedule-next-cycle-modal" data-previous-id="${attr(survey.id)}">
                  <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Agendar Próximo Ciclo
                </button>
              </div>
            </div>
          </div>
        `;
      })()}

      <!-- INICIAR COLETA: exibido para rascunhos -->
      ${survey.status === 'draft' && !isViewer ? `
        <div class="card mb-6 border-2 border-card-warning bg-surface p-5">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 class="card-title text-lg flex items-center gap-2 m-0">
                <i class="fa-regular fa-bookmark color-warning" aria-hidden="true"></i> Pesquisa em Rascunho / Agendada
              </h2>
              <p class="table-subtext m-0 mt-1">
                ${survey.startsAt
                  ? `Início agendado para <strong>${date(survey.startsAt)}</strong> (iniciará automaticamente). Você também pode abrir a coleta agora mesmo.`
                  : `A coleta ainda não foi iniciada. Clique em "Iniciar Coleta Agora" quando estiver pronto para distribuir aos participantes.`}
              </p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button type="button" class="btn btn-secondary" data-action="open-edit-dates-modal" data-id="${attr(survey.id)}">
                <i class="fa-regular fa-calendar-days" aria-hidden="true"></i> Editar Datas
              </button>
              <button type="button" class="btn btn-primary" data-action="open-survey-direct" data-id="${attr(survey.id)}">
                <i class="fa-solid fa-rocket" aria-hidden="true"></i> Iniciar Coleta Agora
              </button>
            </div>
          </div>
        </div>
      ` : ''}

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
  const state = store.getState();
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  // Build a min date value (today) for the input
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const minDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const content = `
    <form id="extend-survey-form">
      <div class="form-group">
        <label for="ext-date" class="form-label">Nova data de encerramento <span class="form-required">*</span></label>
        <input type="datetime-local" id="ext-date" name="newEndsAt" class="input" required />
        <span class="form-help">Deve ser uma data futura e posterior à data atual (${survey ? date(survey.endsAt) : ''}).</span>
      </div>
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
  const rawDate = form.newEndsAt?.value;
  if (!rawDate) {
    showToast('Informe a nova data.', 'error');
    return;
  }
  const newEndsAt = new Date(rawDate).toISOString();
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
    await Promise.all([store.loadSurveys(), store.loadReports()]);
    closeDialog();
    showToast('Pesquisa encerrada com sucesso.', 'info');
    router.navigate(`resultados/ciclo/${surveyId}`);
  } catch (err) {
    showToast(err.message || 'Erro ao encerrar.', 'error');
  }
}

export function openCloseSurveyModal(surveyId) {
  const state = store.getState();
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  const invitedCount = survey?.invitedCount || survey?.groupSize || survey?.memberIds?.length || 0;
  const responsesCount = survey?.responsesCount || survey?.responseCount || 0;
  const rate = survey?.participationRate != null ? survey.participationRate : (invitedCount > 0 ? responsesCount / invitedCount : 0);
  const pct = Math.round(rate * 100);

  const content = `
    <div class="py-2">
      <div class="flex items-center gap-3 mb-3">
        <span class="color-success text-2xl">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        </span>
        <div>
          <h3 class="font-bold text-base m-0">Encerrar Coleta e Consolidar Relatório</h3>
          <p class="table-subtext m-0">Adesão atingida: <strong>${pct}%</strong> (${responsesCount} respostas de ${invitedCount} participantes).</p>
        </div>
      </div>
      <p class="view-subtitle mb-3">
        Deseja encerrar a coleta deste ciclo? O quórum de respostas foi atingido e o relatório consolidado dos dados será disponibilizado imediatamente.
      </p>
    </div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="confirm-close-survey" data-id="${attr(surveyId)}">
      <i class="fa-solid fa-lock" aria-hidden="true"></i> Confirmar e Obter Dados
    </button>
  `;
  openDialog({ title: 'Encerrar Ciclo de Coleta', content, footer });
}

export async function confirmCloseSurvey(surveyId) {
  closeDialog();
  showToast('Encerrando coleta e consolidando dados...', 'info');
  try {
    await post(`/surveys/${surveyId}/close`, {
      confirmEarlyClose: true,
      reason: 'Ciclo concluído com quórum atingido'
    });
    await Promise.all([store.loadSurveys(), store.loadReports()]);
    showToast('Coleta encerrada com sucesso! Relatório gerado.', 'success');
    router.navigate(`resultados/ciclo/${surveyId}`);
  } catch (err) {
    showToast(err.message || 'Erro ao encerrar coleta.', 'error');
  }
}

export function openEditDatesModal(surveyId) {
  const state = store.getState();
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) {
    showToast('Pesquisa não encontrada.', 'error');
    return;
  }

  const toInputDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const startVal = toInputDate(survey.startsAt);
  const endVal = toInputDate(survey.endsAt);

  const content = `
    <div class="py-2">
      <p class="view-subtitle mb-4">
        Ajuste as datas de início e encerramento para a pesquisa <strong>${esc(survey.title)}</strong> (${esc(survey.cycle || 'Geral')}).
      </p>
      
      <div class="form-group mb-3">
        <label for="edit-starts-at" class="form-label font-semibold">Data de Início da Coleta</label>
        <input type="datetime-local" id="edit-starts-at" name="startsAt" class="input" value="${attr(startVal)}" ${survey.status === 'open' ? 'disabled' : ''} />
        <span class="form-help">
          ${survey.status === 'open' 
            ? 'A coleta já está em andamento (data de início não editável).' 
            : 'Se configurada no futuro, a pesquisa iniciará automaticamente nesta data.'}
        </span>
      </div>

      <div class="form-group mb-3">
        <label for="edit-ends-at" class="form-label font-semibold">Data de Encerramento da Coleta <span class="form-required">*</span></label>
        <input type="datetime-local" id="edit-ends-at" name="endsAt" class="input" value="${attr(endVal)}" required />
        <span class="form-help">Prazo final para o recebimento das respostas dos colaboradores.</span>
      </div>

      <div class="form-group mb-3">
        <label for="edit-survey-cycle" class="form-label font-semibold">Identificador do Ciclo</label>
        <input type="text" id="edit-survey-cycle" name="cycle" class="input" value="${attr(survey.cycle || '')}" />
        <span class="form-help">Nome de referência do ciclo (ex: Novembro 2026).</span>
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-edit-dates" data-id="${attr(surveyId)}">
      <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar Datas
    </button>
  `;

  openDialog({ title: 'Editar Datas da Pesquisa', content, footer });
}

export async function submitEditDates(surveyId) {
  const form = document.querySelector('.dialog-body');
  const startsAtInput = form?.querySelector('input[name="startsAt"]');
  const endsAtInput = form?.querySelector('input[name="endsAt"]');
  const cycleInput = form?.querySelector('input[name="cycle"]');

  const endsAtVal = endsAtInput?.value;
  if (!endsAtVal) {
    showToast('Informe a data de encerramento.', 'warning');
    return;
  }
  const endsAtTime = new Date(endsAtVal).getTime();
  if (isNaN(endsAtTime) || endsAtTime <= Date.now()) {
    showToast('A data de encerramento deve ser no futuro.', 'warning');
    return;
  }

  const payload = {
    endsAt: new Date(endsAtTime).toISOString()
  };

  if (startsAtInput && !startsAtInput.disabled && startsAtInput.value) {
    const startsAtTime = new Date(startsAtInput.value).getTime();
    if (!isNaN(startsAtTime)) {
      if (endsAtTime <= startsAtTime) {
        showToast('A data de encerramento deve ser posterior à data de início.', 'warning');
        return;
      }
      payload.startsAt = new Date(startsAtTime).toISOString();
    }
  }

  if (cycleInput?.value?.trim()) {
    payload.cycle = cycleInput.value.trim();
  }

  try {
    await put(`/surveys/${surveyId}/dates`, payload);
    await store.loadSurveys();
    closeDialog();
    showToast('Datas da pesquisa atualizadas com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar datas.', 'error');
  }
}

export async function startNextCycleInstant(previousSurveyId) {
  const state = store.getState();
  const prev = (state.surveys || []).find(s => s.id === previousSurveyId);
  if (!prev) {
    showToast('Pesquisa de referência não encontrada.', 'error');
    return;
  }

  showToast('Iniciando próximo ciclo de pesquisa...', 'info');

  const currentCycle = prev.cycle || 'Ciclo 1';
  let nextCycle = '';
  const matchNum = currentCycle.match(/(.*?)(\d+)$/);
  if (matchNum) {
    nextCycle = `${matchNum[1]}${parseInt(matchNum[2], 10) + 1}`;
  } else {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const now = new Date();
    nextCycle = `${months[now.getMonth()]} ${now.getFullYear()}`;
    if (nextCycle === currentCycle) {
      nextCycle = `${months[(now.getMonth() + 1) % 12]} ${now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)}`;
    }
  }

  const baseTitle = (prev.title || 'Pesquisa').replace(/\s*-\s*(Ciclo|\d{4}).*$/i, '');
  const payload = {
    title: `${baseTitle} - ${nextCycle}`,
    cycle: nextCycle,
    model: prev.model,
    groupIds: prev.groupIds || (prev.groupId ? [prev.groupId] : []),
    collectionChannel: prev.collectionChannel || 'web',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    previousSurveyId: prev.id
  };

  try {
    const newSurvey = await post('/surveys', payload);
    await post(`/surveys/${newSurvey.id}/open`, { collectionChannel: payload.collectionChannel });
    await store.loadSurveys();
    showToast('Próximo ciclo iniciado com sucesso! Coleta aberta.', 'success');
    router.navigate(`pesquisas/${newSurvey.id}/distribuicao`);
  } catch (err) {
    showToast(err.message || 'Erro ao iniciar próximo ciclo.', 'error');
  }
}

export function scheduleNextCycleModal(previousSurveyId) {
  const state = store.getState();
  const prev = (state.surveys || []).find(s => s.id === previousSurveyId);
  if (!prev) {
    showToast('Pesquisa de referência não encontrada.', 'error');
    return;
  }

  const toInputDate = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const defaultStart = new Date(Date.now() + 30 * 86400000);
  const defaultEnd = new Date(defaultStart.getTime() + 15 * 86400000);

  const content = `
    <div class="py-2">
      <p class="view-subtitle mb-3">
        Agende a data em que o próximo ciclo iniciará automaticamente.
      </p>

      <div class="form-group mb-3">
        <label for="sched-start-input" class="form-label font-semibold">Data e Hora de Início Automático <span class="form-required">*</span></label>
        <input type="datetime-local" id="sched-start-input" name="startsAt" class="input" value="${attr(toInputDate(defaultStart))}" required />
        <span class="form-help">Nesta data, o sistema abrirá a coleta automaticamente sem necessidade de ação manual.</span>
      </div>

      <div class="form-group mb-3">
        <label for="sched-end-input" class="form-label font-semibold">Data de Encerramento <span class="form-required">*</span></label>
        <input type="datetime-local" id="sched-end-input" name="endsAt" class="input" value="${attr(toInputDate(defaultEnd))}" required />
        <span class="form-help">Prazo final para recebimento das respostas.</span>
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-schedule-next-cycle" data-previous-id="${attr(previousSurveyId)}">
      <i class="fa-regular fa-calendar-check" aria-hidden="true"></i> Salvar Agendamento
    </button>
  `;

  openDialog({ title: 'Agendar Próximo Ciclo', content, footer });
}

export async function submitScheduleNextCycle(previousSurveyId) {
  const form = document.querySelector('.dialog-body');
  const startsAtInput = form?.querySelector('input[name="startsAt"]');
  const endsAtInput = form?.querySelector('input[name="endsAt"]');

  const startsAtVal = startsAtInput?.value;
  const endsAtVal = endsAtInput?.value;

  if (!startsAtVal || !endsAtVal) {
    showToast('Preencha as datas de início e encerramento.', 'warning');
    return;
  }

  const startTime = new Date(startsAtVal).getTime();
  const endTime = new Date(endsAtVal).getTime();

  if (isNaN(startTime) || startTime <= Date.now()) {
    showToast('A data de início agendado deve ser no futuro.', 'warning');
    return;
  }
  if (isNaN(endTime) || endTime <= startTime) {
    showToast('A data de encerramento deve ser posterior à data de início.', 'warning');
    return;
  }

  const state = store.getState();
  const prev = (state.surveys || []).find(s => s.id === previousSurveyId);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const startDateObj = new Date(startTime);
  const nextCycle = `${months[startDateObj.getMonth()]} ${startDateObj.getFullYear()}`;

  const baseTitle = (prev?.title || 'Pesquisa').replace(/\s*-\s*(Ciclo|\d{4}).*$/i, '');
  const payload = {
    title: `${baseTitle} - ${nextCycle}`,
    cycle: nextCycle,
    model: prev?.model || 'Diagnóstico Psicossocial',
    groupIds: prev?.groupIds || (prev?.groupId ? [prev.groupId] : []),
    collectionChannel: prev?.collectionChannel || 'web',
    startsAt: new Date(startTime).toISOString(),
    endsAt: new Date(endTime).toISOString(),
    previousSurveyId: prev?.id || null
  };

  try {
    await post('/surveys', payload);
    await store.loadSurveys();
    closeDialog();
    showToast('Próximo ciclo agendado com sucesso! Iniciará automaticamente na data configurada.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao agendar próximo ciclo.', 'error');
  }
}

let deleteCountdownTimer = null;

function startDeleteCountdown({
  duration = 10,
  containerId = 'delete-timer-container',
  badgeId = 'delete-timer-badge',
  secondsId = 'delete-seconds-count',
  progressId = 'delete-progress-bar',
  messageId = 'delete-timer-msg',
  consentRowId = 'delete-consent-label',
  consentCheckboxId = 'delete-survey-consent-checkbox',
  confirmBtnId = 'btn-confirm-delete-survey'
} = {}) {
  if (deleteCountdownTimer) {
    clearInterval(deleteCountdownTimer);
    deleteCountdownTimer = null;
  }

  const timerContainer = document.getElementById(containerId);
  const timerBadge = document.getElementById(badgeId);
  const secondsSpan = document.getElementById(secondsId);
  const progressBar = document.getElementById(progressId);
  const timerMsg = document.getElementById(messageId);
  const consentLabel = document.getElementById(consentRowId);
  const consentCheckbox = document.getElementById(consentCheckboxId);
  const confirmBtn = document.getElementById(confirmBtnId);

  const totalMs = duration * 1000;
  const startTime = Date.now();

  if (progressBar) {
    progressBar.style.width = '100%';
  }
  if (secondsSpan) {
    secondsSpan.textContent = String(duration);
  }

  deleteCountdownTimer = setInterval(() => {
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
  }, 50);

  // Escuta alteração da checkbox para liberar o botão de exclusão
  if (consentCheckbox && confirmBtn) {
    consentCheckbox.addEventListener('change', (e) => {
      confirmBtn.disabled = !e.target.checked;
      if (e.target.checked) {
        confirmBtn.focus();
      }
    });
  }
}

export function openDeleteSurveyModal(surveyId, title) {
  if (deleteCountdownTimer) {
    clearInterval(deleteCountdownTimer);
    deleteCountdownTimer = null;
  }

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

  startDeleteCountdown();
}

export async function submitDeleteSurvey(surveyId) {
  const consentCheckbox = document.getElementById('delete-survey-consent-checkbox');
  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Você precisa marcar a caixa de confirmação para poder apagar a pesquisa.', 'warning');
    return;
  }

  try {
    await del(`/surveys/${surveyId}`);
    closeDialog();
    await store.loadSurveys();
    router.refresh();
    showToast('Pesquisa excluída com sucesso.', 'success');
    if (window.location.hash.includes(surveyId)) {
      router.navigate('pesquisas');
    }
  } catch (err) {
    showToast(err.message || 'Erro ao excluir pesquisa.', 'error');
  }
}

export function getSelectedSurveyIds() {
  const checkboxes = document.querySelectorAll('.survey-row-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

export function updateSurveySelectionUI() {
  const rowCheckboxes = Array.from(document.querySelectorAll('.survey-row-checkbox'));
  const checkedCheckboxes = rowCheckboxes.filter(cb => cb.checked);
  const selectedCount = checkedCheckboxes.length;
  const totalCount = rowCheckboxes.length;

  const selectAllCheckbox = document.getElementById('select-all-surveys');
  const bulkToolbar = document.getElementById('surveys-bulk-toolbar');
  const bulkCountLabel = document.getElementById('surveys-bulk-count-label');
  const table = document.getElementById('surveys-table');

  if (selectAllCheckbox) {
    if (totalCount > 0 && selectedCount === totalCount) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedCount > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  // Visual highlight for selected rows
  rowCheckboxes.forEach(cb => {
    const row = cb.closest('tr');
    if (row) {
      if (cb.checked) {
        row.classList.add('survey-row-selected');
      } else {
        row.classList.remove('survey-row-selected');
      }
    }
  });

  if (selectedCount > 0) {
    if (table) table.classList.add('selection-active');
    if (bulkToolbar) bulkToolbar.classList.remove('hidden');
    if (bulkCountLabel) {
      bulkCountLabel.textContent = `${selectedCount} ${selectedCount === 1 ? 'pesquisa selecionada' : 'pesquisas selecionadas'}`;
    }
  } else {
    if (table) table.classList.remove('selection-active');
    if (bulkToolbar) bulkToolbar.classList.add('hidden');
  }
}

export function openBulkDeleteSurveysModal() {
  const ids = getSelectedSurveyIds();
  const count = ids.length;
  if (count === 0) {
    showToast('Nenhuma pesquisa selecionada para exclusão.', 'warning');
    return;
  }

  if (deleteCountdownTimer) {
    clearInterval(deleteCountdownTimer);
    deleteCountdownTimer = null;
  }

  const content = `
    <div class="delete-survey-modal-content">
      <div class="delete-survey-warning">
        <div class="delete-survey-warning__header">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>Atenção: Ação irreversível de exclusão (${count} ${count === 1 ? 'pesquisa' : 'pesquisas'})</span>
        </div>
        <p class="delete-survey-warning__body">
          Você está prestes a excluir permanentemente <strong>${count}</strong> ${count === 1 ? 'pesquisa selecionada' : 'pesquisas selecionadas'}.
        </p>
        <ul class="delete-survey-warning__list">
          <li>Todos os questionários e links únicos de resposta das ${count} pesquisas serão desativados.</li>
          <li>Respostas já enviadas e métricas vinculadas a estes ciclos serão excluídas.</li>
          <li>Os grupos vinculados serão liberados para novos ciclos de pesquisa.</li>
        </ul>

        <div class="delete-survey-timer-box" id="bulk-delete-timer-container">
          <div class="delete-survey-timer-text">
            <span id="bulk-delete-timer-msg">
              <i class="fa-regular fa-clock" aria-hidden="true"></i> Leia o aviso com atenção antes de confirmar:
            </span>
            <span class="delete-survey-timer-badge" id="bulk-delete-timer-badge">
              <span id="bulk-delete-seconds-count">10</span>s
            </span>
          </div>
          <div class="delete-survey-progress">
            <div class="delete-survey-progress-bar" id="bulk-delete-progress-bar"></div>
          </div>
        </div>
      </div>

      <label class="delete-survey-consent-row disabled" id="bulk-delete-consent-label">
        <input type="checkbox" id="bulk-delete-consent-checkbox" disabled />
        <span class="delete-survey-consent-label">
          Compreendo que a exclusão de todas as <strong>${count}</strong> pesquisas selecionadas é irreversível e desejo prosseguir.
        </span>
      </label>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btn-confirm-bulk-delete" data-action="confirm-bulk-delete-surveys" disabled>
      <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Apagar ${count} ${count === 1 ? 'Pesquisa' : 'Pesquisas'}
    </button>
  `;

  openDialog({
    title: `Excluir ${count} ${count === 1 ? 'Pesquisa' : 'Pesquisas'}`,
    content,
    footer,
    onClose: () => {
      if (deleteCountdownTimer) {
        clearInterval(deleteCountdownTimer);
        deleteCountdownTimer = null;
      }
    }
  });

  startDeleteCountdown({
    containerId: 'bulk-delete-timer-container',
    badgeId: 'bulk-delete-timer-badge',
    secondsId: 'bulk-delete-seconds-count',
    progressId: 'bulk-delete-progress-bar',
    messageId: 'bulk-delete-timer-msg',
    consentRowId: 'bulk-delete-consent-label',
    consentCheckboxId: 'bulk-delete-consent-checkbox',
    confirmBtnId: 'btn-confirm-bulk-delete'
  });
}

export async function submitBulkDeleteSurveys() {
  const consentCheckbox = document.getElementById('bulk-delete-consent-checkbox');
  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Você precisa marcar a caixa de confirmação para poder apagar as pesquisas.', 'warning');
    return;
  }

  const ids = getSelectedSurveyIds();
  if (ids.length === 0) {
    showToast('Nenhuma pesquisa selecionada.', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btn-confirm-bulk-delete');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Apagando...';
  }

  try {
    await del('/surveys', { ids });
    closeDialog();
    await store.loadSurveys();
    router.refresh();
    showToast(`${ids.length} ${ids.length === 1 ? 'pesquisa apagada' : 'pesquisas apagadas'} com sucesso!`, 'success');
    router.navigate('pesquisas');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir pesquisas.', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Tentar novamente';
    }
  }
}

export async function handleOpenSurveyDirect(surveyId, btnElement = null) {
  const btn = btnElement || document.querySelector(`[data-action="open-survey-direct"][data-id="${surveyId}"]`);
  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Abrindo e enviando...';
  }
  try {
    const res = await post(`/surveys/${surveyId}/open`, {});
    await store.loadSurveys();
    const dispatched = res?.dispatchResult?.dispatched;
    const msg = typeof dispatched === 'number' && dispatched > 0
      ? `Coleta aberta com sucesso! ${dispatched} convites enviados por e-mail.`
      : (res?.dispatchResult?.errors > 0
        ? `Coleta aberta. Aviso no envio de e-mails: ${res.dispatchResult.error || 'Verifique o servidor'}`
        : 'Coleta aberta com sucesso!');
    showToast(msg, res?.dispatchResult?.errors > 0 ? 'warning' : 'success');
    router.navigate(`pesquisas/${surveyId}/distribuicao`);
  } catch (err) {
    showToast(err.message || 'Erro ao abrir pesquisa.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

/**
 * Navega para o wizard de criação de nova pesquisa pré-configurado com o
 * mesmo modelo/ciclo da pesquisa encerrada. Permite iniciar um novo ciclo
 * imediatamente após o encerramento.
 */
export function openNewCycle(surveyId) {
  // Simply navigate to the creation wizard; the previous survey context is optional
  router.navigate('pesquisas/nova');
  showToast('Configure o próximo ciclo de pesquisa.', 'info');
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
  const invitedCount = survey.invitedCount || survey.groupSize || survey.memberIds?.length || 0;
  const responsesCount = survey.responsesCount || survey.responseCount || 0;
  const rate = survey.participationRate != null ? survey.participationRate : (invitedCount > 0 ? responsesCount / invitedCount : 0);

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
        <span class="badge badge-subtle">${questions.length} afirmações</span>
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

/**
 * Modal profissional de envio de convites via WhatsApp com verificação de status,
 * avisos de responsabilidade/banimento e edição de template fixo obrigatório com {link}.
 */
export async function openWhatsAppDispatchModal(surveyId) {
  const survey = store.getState().surveys?.find(s => s.id === surveyId);
  if (!survey) return showToast('Pesquisa não encontrada.', 'error');

  openDialog({
    title: 'Disparo de Convites via WhatsApp',
    content: `
      <div id="wa-modal-body" class="p-2">
        <div class="flex items-center justify-center p-8">
          <i class="fa-solid fa-spinner fa-spin color-primary" aria-hidden="true"></i>
          <span class="ml-2 font-medium">Verificando status do aparelho...</span>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    `,
    size: 'lg'
  });

  await renderWhatsAppModalContent(surveyId);
}

export async function renderWhatsAppModalContent(surveyId) {
  const container = document.getElementById('wa-modal-body');
  if (!container) return;

  const survey = store.getState().surveys?.find(s => s.id === surveyId);
  if (!survey) return;

  try {
    const status = await get('/whatsapp/qr');
    const isConnected = Boolean(status.connected);

    const warningHtml = `
      <div class="wa-warning-banner">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <div class="wa-warning-title">Aviso de Responsabilidade e Segurança do Aparelho</div>
          <p class="wa-warning-desc">
            1. <strong>Conexão direta:</strong> O envio é realizado a partir da sessão do seu próprio aparelho/número corporativo conectado.<br>
            2. <strong>Risco de Banimento (Diretrizes Meta):</strong> O WhatsApp aplica bloqueios temporários ou permanentes a números que disparam mensagens repetitivas em lote, especialmente números novos. Dispare com moderação.<br>
            3. <strong>Coleta Segura via Link:</strong> O bot interativo foi desativado. Seus colaboradores receberão uma mensagem com o link oficial e responderão no navegador com sigilo absoluto.
          </p>
        </div>
      </div>
    `;

    if (isConnected) {
      const defaultTemplate = survey.whatsappMessageTemplate || 
        'Olá! O RH convida você a participar da nossa Pesquisa Confidencial sobre Condições de Trabalho: {link}\n\n' +
        'Leva menos de 3 minutos. Sua percepção é fundamental para construirmos um ambiente mais saudável!';

      container.innerHTML = `
        ${warningHtml}
        <div class="card bg-surface p-4 border mb-4">
          <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i>
              <span class="font-bold">Aparelho Conectado:</span>
              <span class="badge badge-success">+${esc(status.phone || 'Ativo')}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="disconnect-wa-device" data-id="${attr(surveyId)}">
              <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> Desconectar Aparelho
            </button>
          </div>
          
          <div class="form-group mb-2">
            <label for="wa-dispatch-message-input" class="form-label font-bold mb-1">
              Mensagem de Convite <span class="form-required">*</span>
            </label>
            <p class="table-subtext mt-0 mb-2">
              A marcação <code>{link}</code> é obrigatória e será substituída automaticamente pelo link seguro e confidencial de cada colaborador.
            </p>
            <textarea id="wa-dispatch-message-input" class="input font-sans w-full" rows="4">${esc(defaultTemplate)}</textarea>
          </div>
        </div>
      `;

      // Atualiza footer do dialog
      const footerEl = container.closest('.dialog-box')?.querySelector('.dialog-footer');
      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="submit-whatsapp-dispatch" data-id="${attr(surveyId)}">
            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Disparar Convites com Link
          </button>
        `;
      }
    } else {
      container.innerHTML = `
        ${warningHtml}
        <div class="wa-qr-container mb-4">
          ${status.qrDataUrl ? `
            <img src="${status.qrDataUrl}" alt="QR Code WhatsApp" class="wa-qr-image mb-3" />
            <div class="text-center">
              <h4 class="font-bold mb-1">Aponte a câmera do seu WhatsApp</h4>
              <p class="table-subtext m-0">No celular: WhatsApp &gt; Configurações/Menu &gt; Aparelhos Conectados &gt; Conectar um Aparelho</p>
            </div>
          ` : `
            <div class="text-center p-6">
              <i class="fa-solid fa-spinner fa-spin color-primary text-3xl mb-3" aria-hidden="true"></i>
              <p class="font-medium mb-1">Inicializando conexão segura...</p>
              <p class="table-subtext m-0">O QR Code aparecerá aqui em instantes. Clique em Atualizar se demorar.</p>
            </div>
          `}
        </div>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-wa-qr" data-id="${attr(surveyId)}">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Atualizar Status / QR Code
          </button>
          <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="reset-wa-auth" data-id="${attr(surveyId)}">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Resetar Sessão
          </button>
        </div>
      `;

      const footerEl = container.closest('.dialog-box')?.querySelector('.dialog-footer');
      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="refresh-wa-qr" data-id="${attr(surveyId)}">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Já Escaneei / Atualizar
          </button>
        `;
      }
    }
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state p-4">
        <i class="fa-solid fa-triangle-exclamation color-danger mb-2" aria-hidden="true"></i>
        <p class="font-medium">Falha ao verificar status do WhatsApp.</p>
        <p class="table-subtext">${esc(err.message || 'Erro de comunicação com o servidor.')}</p>
        <button type="button" class="btn btn-secondary btn-sm mt-3" data-action="refresh-wa-qr" data-id="${attr(surveyId)}">
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

export async function submitWhatsAppDispatch(surveyId) {
  const textarea = document.getElementById('wa-dispatch-message-input');
  const customMessage = textarea ? textarea.value.trim() : '';

  if (!customMessage.includes('{link}')) {
    return showToast('A mensagem deve conter obrigatoriamente a marcação {link}.', 'error');
  }

  const submitBtn = document.querySelector('[data-action="submit-whatsapp-dispatch"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Disparando...';
  }

  try {
    const res = await post(`/surveys/${surveyId}/dispatch-whatsapp`, { customMessage });
    closeDialog();
    showToast(res.message || 'Convites disparados com sucesso!', res.errors > 0 ? 'warning' : 'success');
    await store.loadSurveys();
  } catch (err) {
    showToast(err.message || 'Erro ao disparar mensagens pelo WhatsApp.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Disparar Convites com Link';
    }
  }
}

export async function disconnectWhatsAppDevice(surveyId) {
  try {
    await post('/whatsapp/reset', {});
    showToast('Aparelho desconectado.', 'info');
    await renderWhatsAppModalContent(surveyId);
  } catch (err) {
    showToast(err.message || 'Erro ao desconectar aparelho.', 'error');
  }
}





