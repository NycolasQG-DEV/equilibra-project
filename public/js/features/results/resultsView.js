/* Results and Cycle Reports feature */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmt, fmtPercent, factorBadge, dateText } from '../../domain/formatters.js';
import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';

export function renderCyclesList({ state }) {
  const reports = state.reports || [];

  const content = `
    <div class="results-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Resultados e Relatórios Coletivos</h1>
          <p class="view-subtitle">
            Indicadores psicossociais, recortes por área e histórico de escuta
          </p>
        </div>
        <div>
          <a href="/api/reports/history/export" class="btn btn-secondary btn-sm" download>
            <i class="fa-solid fa-file-excel" aria-hidden="true"></i> Exportar Histórico Consolidado (.xlsx)
          </a>
        </div>
      </div>

      <nav class="tabs-nav mb-6" aria-label="Seções de resultados">
        <a href="#resultados/ciclos" class="tab-link" aria-current="page">Ciclos (${reports.length})</a>
        <a href="#resultados/relatorios" class="tab-link">Documentos & Exportações</a>
      </nav>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Ciclo / Pesquisa</th>
              <th>Instrumento</th>
              <th>Status do Relatório</th>
              <th>Adesão</th>
              <th>Aceite Formal (NR-1)</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${reports.length === 0 ? `
              <tr>
                <td colspan="6" class="table-empty-cell">
                  Nenhum ciclo de resultados processado ainda.
                </td>
              </tr>
            ` : reports.map(r => {
              const isAccepted = !!r.formalAcceptance;
              const isSuppressed = r.suppression?.isSuppressed;

              return `
                <tr>
                  <td>
                    <strong>${esc(r.title)}</strong>
                    <div class="table-subtext">${esc(r.cycle || 'Geral')}</div>
                  </td>
                  <td>${esc(r.model || 'Diagnóstico')}</td>
                  <td>
                    ${isSuppressed ? `
                      <span class="badge badge-warning">
                        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Suprimido (${esc(r.suppression?.code || 'Protegido')})
                      </span>
                    ` : `
                      <span class="badge badge-success">
                        <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Publicado
                      </span>
                    `}
                  </td>
                  <td><span class="num">${r.responsesCount || 0}</span> respostas</td>
                  <td>
                    ${isAccepted ? `
                      <span class="badge badge-success">
                        <i class="fa-solid fa-signature" aria-hidden="true"></i> Aceito
                      </span>
                    ` : isSuppressed ? `
                      <span class="badge badge-neutral">—</span>
                    ` : `
                      <span class="badge badge-warning">Pendente</span>
                    `}
                  </td>
                  <td class="text-right">
                    <a href="#resultados/ciclo/${attr(r.id)}" class="btn btn-secondary btn-sm">
                      Ver Relatório
                    </a>
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
    activePath: 'resultados/ciclos',
    breadcrumbs: [{ label: 'Resultados' }, { label: 'Ciclos' }],
    content,
    state
  });
}

export function renderCycleReport({ params, state }) {
  const reportId = params.id;
  const report = (state.reports || []).find(r => r.id === reportId || r.surveyId === reportId);

  if (!report) {
    return renderShell({
      activePath: 'resultados',
      breadcrumbs: [{ label: 'Resultados', path: 'resultados/ciclos' }, { label: 'Relatório' }],
      content: '<p>Relatório não encontrado.</p>',
      state
    });
  }

  // Set cycle context in store
  store.setCycleContext({
    reportId: report.id,
    surveyId: report.surveyId || report.id,
    title: report.title,
    cycle: report.cycle || 'Geral',
    status: report.status
  });

  const isSuppressed = report.suppression?.isSuppressed;

  // Handle Suppressed State
  if (isSuppressed) {
    const content = `
      <div class="report-suppressed-page">
        <div class="card card-warning-edge mb-6">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-2">
              <span class="auth-logo color-warning">
                <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
              </span>
              <h1 class="card-title">Relatório Coletivo Protegido por Supressão</h1>
            </div>
            <p class="view-subtitle mb-4">
              <strong>Motivo da supressão:</strong> ${esc(report.suppression?.reason || 'O quórum mínimo de respostas não foi atingido.')}
            </p>
            <div class="card bg-subtle p-4 mb-4">
              <h2 class="card-title mb-2">Ação Recomendada pelo RH / SST:</h2>
              <p class="table-subtext m-0">
                ${esc(report.suppression?.actionableAdvice || 'Promova uma nova rodada de comunicação com prazos ampliados ou integre o grupo ao próximo ciclo de escuta geral.')}
              </p>
            </div>
            <div class="flex gap-2">
              <a href="/api/reports/${attr(report.id)}/export?format=json" class="btn btn-secondary btn-sm" download>
                <i class="fa-solid fa-download" aria-hidden="true"></i> Baixar Metadados de Auditoria (JSON)
              </a>
              <a href="#resultados/ciclos" class="btn btn-primary btn-sm">
                Voltar aos Ciclos
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    return renderShell({
      activePath: 'resultados',
      breadcrumbs: [
        { label: 'Resultados', path: 'resultados/ciclos' },
        { label: report.title }
      ],
      content,
      state
    });
  }

  // Published Report View with 7 Sections
  const summaryText = report.deterministicSummary || 'Relatório processado sob os critérios de proteção coletiva NR-1.';
  const factors = report.result || [];
  const matrix = report.matrix || null;
  const acceptance = report.formalAcceptance;

  const content = `
    <div class="report-view-page">
      <!-- Report Header -->
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 class="view-title">${esc(report.title)}</h1>
          <p class="view-subtitle">
            Ciclo: ${esc(report.cycle || 'Geral')} · ${report.responsesCount || 0} respostas coletadas
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <a href="/api/reports/${attr(report.id)}/export?format=pdf" class="btn btn-secondary btn-sm" download>
            <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> PDF
          </a>
          <a href="/api/reports/${attr(report.id)}/export?format=xlsx" class="btn btn-secondary btn-sm" download>
            <i class="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
          </a>
          <a href="/api/reports/${attr(report.id)}/export?format=csv" class="btn btn-secondary btn-sm" download>
            <i class="fa-solid fa-file-csv" aria-hidden="true"></i> CSV
          </a>
          <a href="/api/reports/${attr(report.id)}/export?format=json" class="btn btn-secondary btn-sm" download>
            <i class="fa-solid fa-code" aria-hidden="true"></i> JSON
          </a>
          <button type="button" class="btn btn-ghost btn-sm" data-action="print-page">
            <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
          </button>
        </div>
      </div>

      <!-- Anchor Sub-Navigation -->
      <nav class="tabs-nav mb-6" aria-label="Navegação interna do relatório">
        <a href="#resumo" class="tab-link">Resumo</a>
        <a href="#fatores" class="tab-link">Fatores</a>
        <a href="#distribuicao" class="tab-link">Distribuição</a>
        <a href="#segmentos" class="tab-link">Segmentos</a>
        <a href="#participacao" class="tab-link">Participação</a>
        <a href="#metodologia" class="tab-link">Metodologia</a>
        <a href="#aceite" class="tab-link">Aceite Formal</a>
      </nav>

      <!-- Section: Resumo -->
      <section id="resumo" class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Resumo Executivo da Escuta</h2>
        </div>
        <div class="card-body">
          <p class="mb-4">
            ${esc(summaryText)}
          </p>
          <div class="grid grid-cols-4 gap-4">
            <div class="card p-4 bg-subtle">
              <span class="kpi-title">Média Geral</span>
              <div class="kpi-val">${fmt(report.generalAverage)}</div>
              <span class="kpi-sub">Escala de 1 a 5</span>
            </div>
            <div class="card p-4 bg-subtle">
              <span class="kpi-title">Taxa de Adesão</span>
              <div class="kpi-val">${fmtPercent(report.participationRate)}</div>
              <span class="kpi-sub">${report.responsesCount} respondentes</span>
            </div>
            <div class="card p-4 bg-subtle">
              <span class="kpi-title">Fatores Adequados</span>
              <div class="kpi-val color-success">
                ${factors.filter(f => f.average >= 3.6).length}
              </div>
              <span class="kpi-sub">Pontuação ≥ 3,6</span>
            </div>
            <div class="card p-4 bg-subtle">
              <span class="kpi-title">Pontos de Atenção</span>
              <div class="kpi-val color-danger">
                ${factors.filter(f => f.average < 2.8).length}
              </div>
              <span class="kpi-sub">Pontuação < 2,8</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: Fatores -->
      <section id="fatores" class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Índice de Fatores Psicossociais</h2>
        </div>
        <div class="card-body">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fator / Dimensão</th>
                  <th>Média Coletiva</th>
                  <th>Classificação Semáforo</th>
                  <th>Delta vs Ciclo Anterior</th>
                </tr>
              </thead>
              <tbody>
                ${factors.map(f => {
                  const delta = f.delta ?? null;
                  const deltaText = delta !== null ? `${delta >= 0 ? '+' : ''}${fmt(delta)}` : '—';
                  const deltaClass = delta > 0 ? 'color-success' : delta < 0 ? 'color-danger' : '';

                  return `
                    <tr>
                      <td><strong>${esc(f.label || f.key)}</strong></td>
                      <td><span class="num font-semibold">${fmt(f.average)}</span></td>
                      <td>${factorBadge(f.average, true)}</td>
                      <td><span class="num ${deltaClass}">${deltaText}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section: Distribuição -->
      <section id="distribuicao" class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Distribuição de Respostas (100% Empilhada)</h2>
        </div>
        <div class="card-body">
          <div class="flex flex-col gap-4">
            ${factors.map(f => {
              const dist = f.distribution || [0, 0, 0, 0, 0];
              const total = dist.reduce((a, b) => a + b, 0) || 1;
              const p = dist.map(count => (count / total) * 100);

              return `
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-semibold">${esc(f.label || f.key)}</span>
                    <span class="table-subtext">Média: ${fmt(f.average)}</span>
                  </div>
                  <div class="dist-bar">
                    <div class="dist-bar-seg dist-seg-1" data-width="${p[0]}" title="Discordo totalmente: ${fmtPercent(p[0]/100)}"></div>
                    <div class="dist-bar-seg dist-seg-2" data-width="${p[1]}" title="Discordo: ${fmtPercent(p[1]/100)}"></div>
                    <div class="dist-bar-seg dist-seg-3" data-width="${p[2]}" title="Neutro: ${fmtPercent(p[2]/100)}"></div>
                    <div class="dist-bar-seg dist-seg-4" data-width="${p[3]}" title="Concordo: ${fmtPercent(p[3]/100)}"></div>
                    <div class="dist-bar-seg dist-seg-5" data-width="${p[4]}" title="Concordo totalmente: ${fmtPercent(p[4]/100)}"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="flex items-center gap-4 mt-4 text-center justify-between table-subtext flex-wrap">
            <span><span class="legend-dot bg-danger"></span> 1 - Discordo total</span>
            <span><span class="legend-dot bg-orange"></span> 2 - Discordo</span>
            <span><span class="legend-dot bg-yellow"></span> 3 - Neutro</span>
            <span><span class="legend-dot bg-lime"></span> 4 - Concordo</span>
            <span><span class="legend-dot bg-success"></span> 5 - Concordo total</span>
          </div>
        </div>
      </section>

      <!-- Section: Segmentos (Matrix) -->
      ${matrix ? `
        <section id="segmentos" class="card mb-6">
          <div class="card-header">
            <h2 class="card-title">Matriz de Segmentos Organizacionais</h2>
          </div>
          <div class="card-body">
            <p class="table-subtext mb-3">
              Segmentos com quórum protegido (N ≥ 5). Áreas menores são agregadas automaticamente em "Demais áreas (agrupadas)".
            </p>
            <div class="table-wrap">
              <table class="table matrix-table">
                <thead>
                  <tr>
                    <th>Fator</th>
                    ${matrix.columns.map(col => `<th>${esc(col.label)} (${col.count})</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${matrix.rows.map(row => `
                    <tr>
                      <td><strong>${esc(row.label)}</strong></td>
                      ${row.cells.map(cell => {
                        const bandClass = cell.average >= 3.6 ? 'band-adequado' : cell.average >= 2.8 ? 'band-cuidado' : 'band-atencao';

                        return `
                          <td class="${bandClass}">
                            ${cell.average !== null ? fmt(cell.average) : '—'}
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ` : ''}

      <!-- Section: Metodologia -->
      <section id="metodologia" class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Metodologia & Honestidade Científica</h2>
        </div>
        <div class="card-body">
          <p class="mb-2">
            <strong>Natureza dos Dados:</strong> Os indicadores apresentados refletem a percepção coletiva das condições de trabalho declaradas pelos participantes no período da coleta.
          </p>
          <p class="mb-2">
            <strong>Não Substituição de Laudo:</strong> Este documento não constitui diagnóstico clínico individual, laudo pericial ou atestado automático de conformidade legal. Serve como subsídio técnico de entrada para o Programa de Gerenciamento de Riscos (PGR) conforme a Norma Regulamentadora NR-1.
          </p>
          <p class="m-0">
            <strong>Proteção de Privacidade:</strong> Nenhum resultado individual é acessível. O limiar mínimo de 5 respondentes por segmento é garantido no servidor.
          </p>
        </div>
      </section>

      <!-- Section: Aceite Formal -->
      <section id="aceite" class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Aceite Formal do Relatório (NR-1 / SST)</h2>
        </div>
        <div class="card-body">
          ${acceptance ? `
            <div class="flex items-center gap-3">
              <div class="status-icon-circle status-icon-circle-success">
                <i class="fa-solid fa-signature" aria-hidden="true"></i>
              </div>
              <div>
                <strong class="color-primary">Relatório aceito formalmente</strong>
                <p class="view-subtitle m-0">
                  Assinado por <strong>${esc(acceptance.acceptedBy)}</strong> em ${dateText(acceptance.acceptedAt)}.
                </p>
                ${acceptance.notes ? `<p class="table-subtext mt-1">"${esc(acceptance.notes)}"` : ''}
              </div>
            </div>
          ` : `
            <p class="view-subtitle mb-4">
              O aceite formal registra a concordância do responsável técnico de RH/SST com a integridade do processo de escuta e integra os resultados ao inventário de riscos da NR-1.
            </p>
            <button type="button" class="btn btn-primary" data-action="open-accept-modal" data-id="${attr(report.id)}">
              <i class="fa-solid fa-file-signature" aria-hidden="true"></i> Registrar Aceite Formal
            </button>
          `}
        </div>
      </section>
    </div>
  `;

  return renderShell({
    activePath: 'resultados',
    breadcrumbs: [
      { label: 'Resultados', path: 'resultados/ciclos' },
      { label: report.title }
    ],
    content,
    state
  });
}

export function openAcceptModal(reportId) {
  const content = `
    <form id="accept-report-form">
      <p class="view-subtitle mb-4">
        Ao registrar o aceite formal, você confirma que o ciclo de escuta seguiu os parâmetros metodológicos e que os achados foram integrados ao plano de ação da NR-1.
      </p>
      <div class="form-group">
        <label class="form-label form-label-required">Responsável Técnico (Nome e Cargo)</label>
        <input type="text" name="acceptedBy" class="form-input" required placeholder="ex: Ana Silva - Engenheira de Segurança do Trabalho">
      </div>
      <div class="form-group">
        <label class="form-label">Observações / Número de Registro (opcional)</label>
        <textarea name="notes" class="form-textarea" rows="2" placeholder="ex: Integrado à ata da CIPA e inventário de riscos 2026"></textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-accept-report" data-id="${attr(reportId)}">Confirmar Aceite</button>
  `;

  openDialog({ title: 'Aceite Formal do Relatório', content, footer });
}

export async function submitAcceptReport(reportId) {
  const form = document.getElementById('accept-report-form');
  if (!form) return;

  const acceptedBy = form.acceptedBy.value.trim();
  const notes = form.notes.value.trim();

  if (!acceptedBy) {
    showToast('Informe o nome e cargo do responsável.', 'error');
    return;
  }

  try {
    await post(`/reports/${reportId}/accept`, { acceptedBy, notes });
    await store.loadReports();
    closeDialog();
    showToast('Aceite formal registrado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao registrar aceite.', 'error');
  }
}
