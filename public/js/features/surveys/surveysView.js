/* Surveys feature: Listing, creation wizard, and distribution management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmtPercent, date } from '../../domain/formatters.js';
import { surveyStatusLabels } from '../../domain/labels.js';
import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';

export function renderSurveysList({ state }) {
  const surveys = state.surveys || [];

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
          <a href="#pesquisas/nova" class="btn btn-primary">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Pesquisa
          </a>
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
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${surveys.length === 0 ? `
              <tr>
                <td colspan="7" class="table-empty-cell">
                  Nenhuma pesquisa cadastrada. Inicie um novo ciclo de escuta.
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
                    <div class="table-subtext">${esc(s.model || 'Diagnóstico')}</div>
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
                  <td class="text-right">
                    ${s.status === 'open' ? `
                      <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Distribuição
                      </a>
                    ` : s.status === 'closed' ? `
                      <a href="#resultados/ciclo/${attr(s.id)}" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Relatório
                      </a>
                    ` : `
                      <button type="button" class="btn btn-primary btn-sm" data-action="open-survey-direct" data-id="${attr(s.id)}">
                        Abrir Coleta
                      </button>
                    `}
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

  if (!survey) {
    return renderShell({
      activePath: 'pesquisas',
      breadcrumbs: [{ label: 'Pesquisas', path: 'pesquisas' }, { label: 'Distribuição' }],
      content: '<p>Pesquisa não encontrada.</p>',
      state
    });
  }

  const invitedCount = survey.memberIds?.length || 0;
  const responsesCount = survey.responsesCount || 0;
  const rate = invitedCount > 0 ? responsesCount / invitedCount : 0;

  const content = `
    <div class="survey-dist-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Distribuição & Acompanhamento de Quórum</h1>
          <p class="view-subtitle">
            ${esc(survey.title)} · Ciclo: ${esc(survey.cycle || 'Geral')}
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary" data-action="open-extend-modal" data-id="${attr(survey.id)}">
            <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Prorrogar Prazo
          </button>
          <button type="button" class="btn btn-ghost color-danger" data-action="open-close-early-modal" data-id="${attr(survey.id)}">
            <i class="fa-solid fa-lock" aria-hidden="true"></i> Encerrar Antecipadamente
          </button>
        </div>
      </div>

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
          <span class="kpi-sub">Proteção de anonimato e integridade do relatório</span>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Links Individuais Seguros</h2>
          <a href="/api/surveys/${attr(survey.id)}/invitation-links/export" class="btn btn-primary btn-sm" download>
            <i class="fa-solid fa-file-csv" aria-hidden="true"></i> Baixar Planilha de Links (CSV)
          </a>
        </div>
        <div class="card-body">
          <p class="mb-4">
            Cada colaborador possui um token único pseudonimizado. O servidor computa as respostas sem armazenar o remetente junto às respostas coletivas.
          </p>
          <div class="card bg-subtle p-4">
            <div class="flex items-center justify-between mb-2">
              <strong>Modelo de mensagem para WhatsApp / E-mail:</strong>
              <button type="button" class="btn btn-ghost btn-sm" data-action="copy-invite-template">
                <i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar Texto
              </button>
            </div>
            <pre id="invite-template-text" class="table-subtext m-0">
Olá! Sua voz é fundamental para construirmos um ambiente de trabalho mais saudável.
Participe da nossa pesquisa confidencial sobre fatores psicossociais e condições de trabalho.
Leva apenas 5 minutos e suas respostas são processadas de forma 100% coletiva (sem identificação individual).

Acesse pelo seu link exclusivo: {{LINK_INDIVIDUAL}}
Prazo final: ${date(survey.endsAt)}.
            </pre>
          </div>
        </div>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'pesquisas',
    breadcrumbs: [
      { label: 'Pesquisas', path: 'pesquisas' },
      { label: survey.title, path: `pesquisas/${survey.id}` },
      { label: 'Distribuição' }
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
