/* Results and Cycle Reports feature */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmt, fmtPercent, factorBadge, dateText } from '../../domain/formatters.js';
import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { getSolutionsForFactor } from '../../domain/solutionCatalog.js';

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
  const isViewer = state.account?.role === 'viewer';

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
        <a href="#painel-especializado" class="tab-link">Visualização & Matriz</a>
        <a href="#solucoes" class="tab-link">Portal de Soluções (NR-1)</a>
        <a href="#fatores" class="tab-link">Fatores</a>
        <a href="#distribuicao" class="tab-link">Distribuição</a>
        <a href="#segmentos" class="tab-link">Segmentos</a>
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

      <!-- Section: Visualização Especializada do Instrumento -->
      ${renderSpecializedDashboard(report, factors)}

      <!-- Section: Portal de Soluções NR-1 -->
      ${renderSolutionsPortal(report, factors, isViewer)}

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
          ` : isViewer ? `
            <div class="privacy-notice privacy-info">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
              <div>
                <strong>Aceite formal pendente</strong>
                <p class="m-0 text-xs">O registro de aceite formal deste relatório deve ser realizado pelo Administrador ou responsável técnico de RH/SST.</p>
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

/* ── Specialized Instrument Dashboards ── */

function detectDashboardType(report) {
  if (report.instrument?.dashboardType) return report.instrument.dashboardType;
  const name = String(report.model || report.instrument?.name || '').toLowerCase();
  if (name.includes('hse')) return 'hse-nr1';
  if (name.includes('maslach') || name.includes('burnout') || name.includes('jornada')) return 'burnout';
  if (name.includes('edmondson') || name.includes('segurança')) return 'psych-safety';
  if (name.includes('assédio') || name.includes('14.457') || name.includes('respeito')) return 'assedio-compliance';
  if (name.includes('copsoq') || name.includes('demandas')) return 'copsoq';
  if (name.includes('liderança')) return 'lideranca';
  if (name.includes('mudanças') || name.includes('transição')) return 'transicao';
  if (name.includes('pulso')) return 'pulso';
  if (name.includes('medidas') || name.includes('eficácia')) return 'eficacia';
  return 'nr1-pgr';
}

function renderSpecializedDashboard(report, factors) {
  const type = detectDashboardType(report);
  switch (type) {
    case 'burnout':
      return renderBurnoutTriadDashboard(report, factors);
    case 'psych-safety':
      return renderEdmondsonDashboard(report, factors);
    case 'assedio-compliance':
      return renderComplianceAssedioDashboard(report, factors);
    case 'copsoq':
      return renderCopsoqDashboard(report, factors);
    case 'lideranca':
      return renderLiderancaDashboard(report, factors);
    case 'transicao':
      return renderTransicaoDashboard(report, factors);
    case 'pulso':
      return renderPulsoDashboard(report, factors);
    case 'eficacia':
      return renderEficaciaDashboard(report, factors);
    case 'hse-nr1':
    case 'nr1-pgr':
    default:
      return renderPgrRiskMatrix(report, factors);
  }
}

/* 1. Matriz de Risco PGR 5x5 (NR-1 / GRO) */
function renderPgrRiskMatrix(report, factors) {
  // Mapear cada fator para a célula da matriz 5x5
  const cellFactors = {};
  factors.forEach(f => {
    const avg = f.average ?? 3.0;
    let sev = 1;
    if (avg < 2.5) sev = 5;
    else if (avg < 3.0) sev = 4;
    else if (avg < 3.5) sev = 3;
    else if (avg < 4.0) sev = 2;
    else sev = 1;

    const dist = f.distribution || [0, 0, 0, 0, 0];
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    const badRate = (dist[0] + dist[1]) / total;
    let prob = 1;
    if (badRate > 0.50) prob = 5;
    else if (badRate > 0.35) prob = 4;
    else if (badRate > 0.20) prob = 3;
    else if (badRate > 0.10) prob = 2;
    else prob = 1;

    const key = `${sev}-${prob}`;
    if (!cellFactors[key]) cellFactors[key] = [];
    cellFactors[key].push(f);
  });

  const sevLabels = [
    { num: 5, label: '5. Crítica' },
    { num: 4, label: '4. Grave' },
    { num: 3, label: '3. Média' },
    { num: 2, label: '2. Leve' },
    { num: 1, label: '1. Mínima' }
  ];

  const probLabels = ['1. Rara', '2. Improvável', '3. Possível', '4. Provável', '5. Quase Certa'];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Matriz de Risco Psicossocial PGR (NR-1 / GRO)</h2>
          <p class="view-subtitle m-0">Enquadramento técnico de Severidade × Probabilidade conforme Portaria MTE</p>
        </div>
        <span class="badge badge-primary">
          <i class="fa-solid fa-table-cells" aria-hidden="true"></i> Matriz 5x5 NR-1
        </span>
      </div>
      <div class="card-body">
        <div class="pgr-matrix-container">
          <div class="pgr-matrix-wrapper">
            <div class="pgr-matrix-header-labels">
              <span class="pgr-matrix-row-label">Severidade ↓</span>
              ${probLabels.map(p => `<span>${esc(p)}</span>`).join('')}
            </div>

            <div class="pgr-matrix-grid">
              ${sevLabels.map(s => `
                <div class="pgr-matrix-row">
                  <div class="pgr-matrix-row-label">${esc(s.label)}</div>
                  ${[1, 2, 3, 4, 5].map(p => {
                    const key = `${s.num}-${p}`;
                    const items = cellFactors[key] || [];
                    const score = s.num * p;

                    let cellClass = 'pgr-cell-trivial';
                    if (score >= 16) cellClass = 'pgr-cell-intoleravel';
                    else if (score >= 10) cellClass = 'pgr-cell-substancial';
                    else if (score >= 6) cellClass = 'pgr-cell-moderado';
                    else if (score >= 3) cellClass = 'pgr-cell-toleravel';

                    return `
                      <div class="pgr-matrix-cell ${cellClass}">
                        ${items.map(f => {
                          const pillClass = f.average < 2.8 ? 'pill-danger' : f.average < 3.6 ? 'pill-warning' : '';
                          return `
                            <span class="pgr-factor-pill ${pillClass}" title="Média: ${fmt(f.average)}">
                              ${esc(f.label || f.key)} (${fmt(f.average)})
                            </span>
                          `;
                        }).join('')}
                      </div>
                    `;
                  }).join('')}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="pgr-matrix-legend">
            <span class="font-semibold">Níveis de Risco no PGR:</span>
            <div class="pgr-legend-item">
              <span class="pgr-legend-color pgr-cell-trivial"></span> Trivial (1 a 2)
            </div>
            <div class="pgr-legend-item">
              <span class="pgr-legend-color pgr-cell-toleravel"></span> Tolerável (3 a 5)
            </div>
            <div class="pgr-legend-item">
              <span class="pgr-legend-color pgr-cell-moderado"></span> Moderado (6 a 9)
            </div>
            <div class="pgr-legend-item">
              <span class="pgr-legend-color pgr-cell-substancial"></span> Substancial (10 a 15)
            </div>
            <div class="pgr-legend-item">
              <span class="pgr-legend-color pgr-cell-intoleravel"></span> Intolerável (16 a 25)
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 2. Tríade de Maslach (MBI) & Risco Previdenciário (NTEP/FAP) */
function renderBurnoutTriadDashboard(report, factors) {
  const exhaustionFactor = factors.find(f => ['energia_vital', 'volume', 'recuperacao_sono', 'descanso'].includes(f.key)) || factors[0] || { average: 3.5, label: 'Exaustão' };
  const cynicismFactor = factors.find(f => ['desconexao_mental', 'sobrecarga_emocional', 'relacoes', 'respeito'].includes(f.key)) || factors[1] || factors[0] || { average: 3.8, label: 'Cinismo' };
  const efficacyFactor = factors.find(f => ['realizacao_competencia', 'proposito_trabalho', 'reconhecimento', 'autonomia'].includes(f.key)) || factors[2] || factors[0] || { average: 4.1, label: 'Eficácia' };

  let riskLevel = 'Baixo / Controlado';
  let riskBadge = 'badge-success';
  let gaugeClass = 'burnout-gauge-low';
  let riskText = 'Baixa probabilidade de afastamentos com nexo causal no período corrente.';

  if (exhaustionFactor.average < 2.8) {
    riskLevel = 'Crítico / Elevado (Alerta NTEP)';
    riskBadge = 'badge-danger';
    gaugeClass = 'burnout-gauge-high';
    riskText = 'Risco iminente de adoecimento e absenteísmo por CID-10 Z73.0 (Burnout) e transtornos mentais.';
  } else if (exhaustionFactor.average < 3.5) {
    riskLevel = 'Moderado / Atenção';
    riskBadge = 'badge-warning';
    gaugeClass = 'burnout-gauge-moderate';
    riskText = 'Sinais precoces de fadiga acumulada exigem intervenções preventivas imediatas na jornada.';
  }

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Tríade de Maslach & Risco Previdenciário (NTEP / FAP)</h2>
          <p class="view-subtitle m-0">Avaliação multidimensional de Burnout e probabilidade de impacto previdenciário</p>
        </div>
        <span class="badge ${riskBadge}">
          <i class="fa-solid fa-heart-pulse" aria-hidden="true"></i> ${riskLevel}
        </span>
      </div>
      <div class="card-body">
        <div class="burnout-dashboard-container">
          <div class="burnout-kpi-banner">
            <div class="burnout-pillar-card burnout-card-exhaustion">
              <span class="kpi-title">1. Exaustão Emocional</span>
              <div class="kpi-val ${exhaustionFactor.average < 3.0 ? 'color-danger' : ''}">${fmt(exhaustionFactor.average)}</div>
              <span class="kpi-sub">Esgotamento físico e mental no trabalho</span>
              <div class="mt-2">${factorBadge(exhaustionFactor.average, true)}</div>
            </div>

            <div class="burnout-pillar-card burnout-card-cynicism">
              <span class="kpi-title">2. Despersonalização / Cinismo</span>
              <div class="kpi-val ${cynicismFactor.average < 3.0 ? 'color-warning' : ''}">${fmt(cynicismFactor.average)}</div>
              <span class="kpi-sub">Distanciamento interpessoal e insensibilidade</span>
              <div class="mt-2">${factorBadge(cynicismFactor.average, true)}</div>
            </div>

            <div class="burnout-pillar-card burnout-card-efficacy">
              <span class="kpi-title">3. Realização Profissional</span>
              <div class="kpi-val color-success">${fmt(efficacyFactor.average)}</div>
              <span class="kpi-sub">Autoeficácia e sentimento de competência</span>
              <div class="mt-2">${factorBadge(efficacyFactor.average, true)}</div>
            </div>
          </div>

          <div class="burnout-gauge-meter">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-shield-virus color-primary" aria-hidden="true"></i>
              <strong>Indicador de Nexo Previdenciário:</strong>
              <span class="table-subtext">${esc(riskText)}</span>
            </div>
            <div class="burnout-gauge-bar">
              <div class="burnout-gauge-fill ${gaugeClass}"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 3. Matriz de 4 Quadrantes de Amy Edmondson */
function renderEdmondsonDashboard(report, factors) {
  const psychFactors = factors.filter(f => ['expressao_segura', 'aceitacao_erros', 'tomada_risco', 'seguranca', 'escuta'].includes(f.key));
  const psychAvg = psychFactors.length ? psychFactors.reduce((a, b) => a + b.average, 0) / psychFactors.length : report.generalAverage;

  const perfFactors = factors.filter(f => ['clareza_decisao', 'ajuda_mutua', 'valorizacao_diferencas', 'autonomia', 'papel'].includes(f.key));
  const perfAvg = perfFactors.length ? perfFactors.reduce((a, b) => a + b.average, 0) / perfFactors.length : report.generalAverage;

  const isLearning = psychAvg >= 3.4 && perfAvg >= 3.4;
  const isAnxiety = psychAvg < 3.4 && perfAvg >= 3.4;
  const isComfort = psychAvg >= 3.4 && perfAvg < 3.4;
  const isApathy = psychAvg < 3.4 && perfAvg < 3.4;

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Matriz de Segurança Psicológica de Amy Edmondson</h2>
          <p class="view-subtitle m-0">Cruzamento de Segurança Interpessoal × Responsabilidade e Padrões de Desempenho</p>
        </div>
        <span class="badge badge-primary">
          <i class="fa-solid fa-compass" aria-hidden="true"></i> Modelo Edmondson
        </span>
      </div>
      <div class="card-body">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div class="card p-3 bg-subtle">
            <span class="kpi-title">Segurança Psicológica</span>
            <div class="kpi-val ${psychAvg < 3.4 ? 'color-danger' : 'color-success'}">${fmt(psychAvg)}</div>
          </div>
          <div class="card p-3 bg-subtle">
            <span class="kpi-title">Responsabilidade & Padrões</span>
            <div class="kpi-val ${perfAvg < 3.4 ? 'color-warning' : 'color-success'}">${fmt(perfAvg)}</div>
          </div>
          <div class="flex-1 p-3 card bg-subtle">
            <span class="kpi-title">Diagnóstico da Equipe</span>
            <div class="font-semibold ${isLearning ? 'color-success' : isAnxiety ? 'color-danger' : 'color-warning'}">
              ${isLearning ? 'Zona de Aprendizado & Alta Performance' : isAnxiety ? 'Zona de Ansiedade Interpessoal' : isComfort ? 'Zona de Conforto Operacional' : 'Zona de Apatia'}
            </div>
            <span class="table-subtext">
              ${isLearning ? 'Equipe inovadora, com abertura para assumir riscos calculados e aprender com erros.' : isAnxiety ? 'Alta cobrança combinada com receio de expor dúvidas ou falhas. Risco de omissão e estresse.' : isComfort ? 'Ambiente acolhedor, mas com baixa clareza de metas e baixa responsabilização por resultados.' : 'Desengajamento generalizado com medo de punição e ausência de desafios claros.'}
            </span>
          </div>
        </div>

        <div class="edmondson-quadrants-grid">
          <div class="edmondson-quadrant ${isAnxiety ? 'active-zone' : ''}">
            <div class="flex items-center justify-between">
              <strong>Zona de Ansiedade</strong>
              ${isAnxiety ? '<span class="edmondson-zone-badge badge-danger">Posição Atual</span>' : ''}
            </div>
            <p class="table-subtext m-0">Baixa Segurança + Alta Cobrança. Colaboradores têm medo de errar, mascaram problemas e temem retaliação da liderança.</p>
          </div>

          <div class="edmondson-quadrant ${isLearning ? 'active-zone' : ''}">
            <div class="flex items-center justify-between">
              <strong>Zona de Aprendizado (Alta Performance)</strong>
              ${isLearning ? '<span class="edmondson-zone-badge badge-success">Posição Atual</span>' : ''}
            </div>
            <p class="table-subtext m-0">Alta Segurança + Alta Cobrança. Colaboradores colaboram ativamente, inovam e resolvem problemas complexos com agilidade.</p>
          </div>

          <div class="edmondson-quadrant ${isApathy ? 'active-zone' : ''}">
            <div class="flex items-center justify-between">
              <strong>Zona de Apatia</strong>
              ${isApathy ? '<span class="edmondson-zone-badge badge-warning">Posição Atual</span>' : ''}
            </div>
            <p class="table-subtext m-0">Baixa Segurança + Baixa Cobrança. Apenas cumprem o horário, sem engajamento e sem senso de pertencimento.</p>
          </div>

          <div class="edmondson-quadrant ${isComfort ? 'active-zone' : ''}">
            <div class="flex items-center justify-between">
              <strong>Zona de Conforto</strong>
              ${isComfort ? '<span class="edmondson-zone-badge badge-neutral">Posição Atual</span>' : ''}
            </div>
            <p class="table-subtext m-0">Alta Segurança + Baixa Cobrança. Clima agradável e amigável, porém com baixa disciplina de metas e melhoria contínua.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 4. Barômetro de Conformidade Legal CIPA & Lei 14.457/22 */
function renderComplianceAssedioDashboard(report, factors) {
  const fTrat = factors.find(f => ['tratamento_digno', 'respeito', 'relacoes'].includes(f.key)) || { average: 3.8 };
  const fCanal = factors.find(f => ['conhecimento_canal', 'canal'].includes(f.key)) || { average: 3.5 };
  const fCapac = factors.find(f => ['prevencao_moral', 'prevencao_sexual', 'discriminacao'].includes(f.key)) || { average: 3.6 };
  const fConf = factors.find(f => ['confianca_antirretaliacao', 'retaliacao'].includes(f.key)) || { average: 3.4 };

  const pillars = [
    { title: '1. Código de Conduta & Civilidade', avg: fTrat.average, desc: 'Normas claras de comportamento e tolerância zero a humilhações.' },
    { title: '2. Acesso ao Canal de Denúncias', avg: fCanal.average, desc: 'Conhecimento amplo e facilidade de acionamento do canal protegido.' },
    { title: '3. Prevenção ao Assédio Sexual & Moral', avg: fCapac.average, desc: 'Capacitação anual obrigatória e acolhimento efetivo às vítimas.' },
    { title: '4. Garantia Contra Retaliação', avg: fConf.average, desc: 'Confiança na integridade e sigilo do processo apuratório da CIPA.' }
  ];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Barômetro de Conformidade CIPA & Lei 14.457/22</h2>
          <p class="view-subtitle m-0">Auditoria dos 4 requisitos legais mandatórios para prevenção ao assédio no trabalho</p>
        </div>
        <span class="badge badge-primary">
          <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Lei 14.457/22
        </span>
      </div>
      <div class="card-body">
        <div class="compliance-checklist-grid">
          ${pillars.map(p => {
            const isOk = p.avg >= 3.6;
            return `
              <div class="compliance-check-card ${isOk ? 'compliant' : 'attention'}">
                <div class="compliance-icon ${isOk ? 'color-success' : 'color-danger'}">
                  <i class="fa-solid ${isOk ? 'fa-circle-check' : 'fa-circle-exclamation'}" aria-hidden="true"></i>
                </div>
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <strong>${esc(p.title)}</strong>
                    <span class="num font-semibold ${isOk ? 'color-success' : 'color-danger'}">${fmt(p.avg)}</span>
                  </div>
                  <p class="table-subtext m-0 mt-1">${esc(p.desc)}</p>
                  <div class="mt-2">
                    <span class="badge ${isOk ? 'badge-success' : 'badge-warning'}">
                      ${isOk ? 'Conforme' : 'Ação Preventiva Recomendada'}
                    </span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/* 5. COPSOQ II: Exigências Psicológicas & Carga Mental */
function renderCopsoqDashboard(report, factors) {
  const quant = factors.find(f => f.key.includes('volume') || f.key.includes('prazos')) || { average: 3.2 };
  const mental = factors.find(f => f.key.includes('cognitivas') || f.key.includes('interrupcoes')) || { average: 3.4 };
  const emot = factors.find(f => f.key.includes('emocionais')) || { average: 3.6 };

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Matriz COPSOQ II: Carga de Trabalho & Exigências Psicológicas</h2>
          <p class="view-subtitle m-0">Avaliação do ritmo de trabalho, exigências quantitativas e demandas emocionais</p>
        </div>
        <span class="badge badge-primary">COPSOQ II</span>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-3 gap-4">
          <div class="card p-4 bg-subtle">
            <span class="kpi-title">Exigências Quantitativas</span>
            <div class="kpi-val ${quant.average < 3.2 ? 'color-danger' : ''}">${fmt(quant.average)}</div>
            <span class="kpi-sub">Pressão temporal e volume</span>
          </div>
          <div class="card p-4 bg-subtle">
            <span class="kpi-title">Exigências Cognitivas</span>
            <div class="kpi-val ${mental.average < 3.2 ? 'color-warning' : ''}">${fmt(mental.average)}</div>
            <span class="kpi-sub">Concentração e interrupções</span>
          </div>
          <div class="card p-4 bg-subtle">
            <span class="kpi-title">Demandas Emocionais</span>
            <div class="kpi-val">${fmt(emot.average)}</div>
            <span class="kpi-sub">Lidar com conflitos e tensão</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 6. Liderança e Justiça Organizacional */
function renderLiderancaDashboard(report, factors) {
  return renderPgrRiskMatrix(report, factors);
}

/* 7. Transição e Mudanças */
function renderTransicaoDashboard(report, factors) {
  return renderPgrRiskMatrix(report, factors);
}

/* 8. Pulso Contínuo */
function renderPulsoDashboard(report, factors) {
  return renderPgrRiskMatrix(report, factors);
}

/* 9. Eficácia das Medidas */
function renderEficaciaDashboard(report, factors) {
  return renderPgrRiskMatrix(report, factors);
}

/* ── Portal de Soluções & Medidas Preventivas NR-1 ── */
function renderSolutionsPortal(report, factors, isViewer) {
  // Encontrar fatores que exigem intervenção (< 3.6)
  const priorityFactors = factors.filter(f => f.average < 3.6).sort((a, b) => a.average - b.average);
  const displayFactors = priorityFactors.length > 0 ? priorityFactors : factors.slice(0, 3);
  const isAllAdequate = priorityFactors.length === 0;

  return `
    <section id="solucoes" class="solutions-portal-section mb-6">
      <div class="solutions-portal-header">
        <div>
          <h2 class="solutions-portal-title">
            <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
            Portal de Soluções & Medidas Preventivas (NR-1 / PGR)
          </h2>
          <p class="view-subtitle m-0">
            Recomendações técnicas imediatas baseadas nos fatores críticos deste ciclo de escuta
          </p>
        </div>
        <div>
          ${isAllAdequate ? `
            <span class="badge badge-success">
              <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Todos os fatores adequados (≥ 3,6)
            </span>
          ` : `
            <span class="badge badge-warning">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${priorityFactors.length} fatores com recomendação de ação
            </span>
          `}
        </div>
      </div>

      <div class="solutions-grid">
        ${displayFactors.map(f => {
          const solutions = getSolutionsForFactor(f.key);
          const sol = solutions[0];
          const isDanger = f.average < 2.8;

          return `
            <div class="solution-card">
              <div class="solution-card-top">
                <div class="solution-card-header">
                  <span class="solution-category-tag">${esc(sol.category)}</span>
                  <span class="badge ${isDanger ? 'badge-danger' : 'badge-warning'}">
                    Fator: ${esc(f.label || f.key)} (${fmt(f.average)})
                  </span>
                </div>

                <h3 class="solution-title">${esc(sol.title)}</h3>

                <div class="solution-diagnosis">
                  <strong>Achado Técnico:</strong> ${esc(sol.diagnosis)}
                </div>

                <div class="solution-measure">
                  <strong>Medida Preventiva Recomendada:</strong> ${esc(sol.measure)}
                </div>

                <div class="solution-meta-pills">
                  <span class="solution-meta-item">
                    <i class="fa-solid fa-user-tie" aria-hidden="true"></i> ${esc(sol.owner)}
                  </span>
                  <span class="solution-meta-item">
                    <i class="fa-regular fa-clock" aria-hidden="true"></i> Prazo: ${sol.days} dias
                  </span>
                  <span class="solution-meta-item">
                    <i class="fa-solid fa-bullseye" aria-hidden="true"></i> ${esc(sol.criteria)}
                  </span>
                </div>
              </div>

              <div class="solution-card-footer">
                ${!isViewer ? `
                  <button type="button" class="btn btn-primary btn-sm quick-add-solution-btn" data-action="quick-add-solution"
                    data-report-id="${attr(report.id)}"
                    data-factor-key="${attr(f.key)}"
                    data-factor-label="${attr(f.label || f.key)}"
                    data-solution-title="${attr(sol.title)}"
                    data-owner="${attr(sol.owner)}"
                    data-days="${attr(sol.days)}"
                    data-criteria="${attr(sol.criteria)}"
                    data-desc="${attr(sol.description)}">
                    <i class="fa-solid fa-plus-circle" aria-hidden="true"></i> Adicionar ao Plano de Ação NR-1
                  </button>
                ` : `
                  <span class="badge badge-neutral">
                    <i class="fa-solid fa-lock" aria-hidden="true"></i> Visualização restrita a administradores
                  </span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}
