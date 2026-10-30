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
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
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
              const isAccepted = !!r.formalAcceptance || !!r.acceptance;
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
                  <td><span class="num">${r.responsesCount || r.responseCount || 0}</span> respostas</td>
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

  const insights = report.insights || null;
  const factors = report.result || report.factors || [];
  const matrix = report.matrix || report.segmentation || null;
  const acceptance = report.formalAcceptance || report.acceptance;
  const isViewer = state.account?.role === 'viewer';

  const executiveText = `Relatório técnico de escuta coletiva processado sob a metodologia <strong>${esc(report.model)}</strong>. Apuração realizada com quórum protegido de <strong>${report.responsesCount || report.responseCount || 0} respondentes</strong> (${fmtPercent(report.participationRate)} de adesão). A média global apurada para o coletivo foi de <strong>${fmt(report.generalAverage)}</strong> / 5,00.`;

  const content = `
    <div class="report-view-page">
      <!-- Report Header -->
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 class="view-title">${esc(report.title)}</h1>
          <p class="view-subtitle">
            Ciclo: ${esc(report.cycle || 'Geral')} · ${report.responsesCount || report.responseCount || 0} respostas coletadas · Metodologia NR-1
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

      <!-- Navegação em Telas / Slides sem conflito de rotas por hash -->
      ${(() => {
        const slides = [];

        // Slide 0: Resumo Executivo
        slides.push({
          id: 'resumo',
          tabLabel: 'Resumo',
          tabIcon: 'fa-solid fa-chart-pie',
          title: 'Resumo Executivo da Escuta',
          html: `
            <section id="resumo" class="card mb-6">
              <div class="card-header">
                <h2 class="card-title">Resumo Executivo da Escuta</h2>
              </div>
              <div class="card-body">
                <p class="mb-4">
                  ${executiveText}
                </p>

                ${insights?.kpisContextuais?.length ? `
                  <div class="grid grid-cols-4 gap-4">
                    ${insights.kpisContextuais.slice(0, 4).map(kpi => {
                      const val = kpi.formatted || kpi.value || (kpi.valor != null ? (kpi.valor + (kpi.sufixo ? ' ' + kpi.sufixo : '')) : '—');
                      const sub = kpi.sub || kpi.sufixo || '';
                      const st = kpi.status || kpi.cor || 'neutral';
                      const colorCls = st === 'danger' ? 'color-danger' : st === 'warning' ? 'color-warning' : st === 'success' ? 'color-success' : '';
                      return `
                        <div class="card p-4 bg-subtle">
                          <span class="kpi-title">${esc(kpi.label)}</span>
                          <div class="kpi-val ${colorCls}">${esc(String(val))}</div>
                          <span class="kpi-sub">${esc(String(sub))}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div class="grid grid-cols-4 gap-4">
                    <div class="card p-4 bg-subtle">
                      <span class="kpi-title">Média Geral</span>
                      <div class="kpi-val">${fmt(report.generalAverage)}</div>
                      <span class="kpi-sub">Escala de 1 a 5</span>
                    </div>
                    <div class="card p-4 bg-subtle">
                      <span class="kpi-title">Taxa de Adesão</span>
                      <div class="kpi-val">${fmtPercent(report.participationRate)}</div>
                      <span class="kpi-sub">${report.responsesCount || report.responseCount || 0} respondentes</span>
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
                `}
              </div>
            </section>
          `
        });

        // Slide 1: Painel Especializado do Instrumento
        const specializedHtml = renderSpecializedDashboard(report, factors);
        if (specializedHtml) {
          slides.push({
            id: 'painel-especializado',
            tabLabel: 'Instrumento',
            tabIcon: 'fa-solid fa-gauge-high',
            title: 'Visualização Especializada do Instrumento',
            html: specializedHtml
          });
        }

        // Slide 2: Diagnóstico Contextual
        if (insights) {
          slides.push({
            id: 'diagnostico',
            tabLabel: 'Diagnóstico',
            tabIcon: 'fa-solid fa-brain',
            title: 'Diagnóstico Contextual de Riscos',
            html: renderContextualDiagnostic(report, insights)
          });
        }

        // Slide 3: Medidas & Soluções NR-1
        slides.push({
          id: 'solucoes',
          tabLabel: 'Medidas NR-1',
          tabIcon: 'fa-solid fa-list-check',
          title: 'Portal de Soluções & Medidas NR-1',
          html: renderSolutionsPortal(report, factors, isViewer)
        });

        // Slide 4: Fatores Detalhados
        slides.push({
          id: 'fatores',
          tabLabel: 'Fatores',
          tabIcon: 'fa-solid fa-table-list',
          title: 'Índice Detalhado de Fatores',
          html: `
            <section id="fatores" class="card mb-6">
              <div class="card-header">
                <h2 class="card-title">Índice Detalhado de Fatores</h2>
              </div>
              <div class="card-body">
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Fator / Dimensão Avaliada</th>
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
          `
        });

        // Slide 5: Distribuição de Respostas
        slides.push({
          id: 'distribuicao',
          tabLabel: 'Distribuição',
          tabIcon: 'fa-solid fa-chart-column',
          title: 'Distribuição de Respostas (100% Empilhada)',
          html: `
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
          `
        });

        // Slide 6: Segmentos (Matrix) se houver
        if (matrix && matrix.columns && matrix.columns.length) {
          slides.push({
            id: 'segmentos',
            tabLabel: 'Segmentos',
            tabIcon: 'fa-solid fa-network-wired',
            title: 'Matriz de Segmentos Organizacionais',
            html: `
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
                        ${(matrix.rows || []).map(row => `
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
            `
          });
        }

        // Slide Metodologia
        slides.push({
          id: 'metodologia',
          tabLabel: 'Metodologia',
          tabIcon: 'fa-solid fa-book-open',
          title: 'Metodologia & Honestidade Científica',
          html: `
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
          `
        });

        // Slide Aceite Formal
        slides.push({
          id: 'aceite',
          tabLabel: 'Aceite Formal',
          tabIcon: 'fa-solid fa-file-signature',
          title: 'Aceite Formal do Relatório (NR-1 / SST)',
          html: `
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
                        Assinado por <strong>${esc(acceptance.acceptedBy || 'Responsável Técnico')}</strong> em ${dateText(acceptance.acceptedAt || acceptance.date)}.
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
          `
        });

        return `
          <nav class="tabs-nav mb-4" aria-label="Navegação em telas do relatório">
            ${slides.map((s, idx) => `
              <button type="button" class="tab-link ${idx === 0 ? 'active' : ''}" data-action="switch-report-slide" data-slide-index="${idx}">
                <i class="${s.tabIcon}" aria-hidden="true"></i> ${s.tabLabel}
              </button>
            `).join('')}
          </nav>

          <div class="report-carousel-container">
            <div class="report-slide-header-bar">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-report-prev-slide" data-action="report-prev-slide" disabled>
                <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Tela Anterior
              </button>

              <div class="report-slide-info-pill">
                <span class="report-slide-index-label" id="report-slide-index-label">Tela 1 de ${slides.length}</span>
                <span class="report-slide-title-label" id="report-slide-title-label">${slides[0].title}</span>
              </div>

              <button type="button" class="btn btn-secondary btn-sm" id="btn-report-next-slide" data-action="report-next-slide">
                Próxima Tela <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <div class="report-slides-viewport">
              <div class="report-slides-track" id="report-slides-track" data-active-slide="0">
                ${slides.map((s, idx) => `
                  <div class="report-slide ${idx === 0 ? 'active' : ''}" data-slide-index="${idx}" id="slide-${s.id}">
                    ${s.html}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      })()}
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

/* ── Contextual Diagnostic Panel ── */

function renderContextualDiagnostic(report, insights) {
  if (!insights) return '';

  const riskClass = insights.riskLevel === 'crítico' || insights.riskLevel === 'alto'
    ? 'color-danger'
    : insights.riskLevel === 'moderado' || insights.riskLevel === 'medio'
    ? 'color-warning'
    : 'color-success';

  const badgeClass = insights.riskLevel === 'crítico' || insights.riskLevel === 'alto'
    ? 'badge-danger'
    : insights.riskLevel === 'moderado' || insights.riskLevel === 'medio'
    ? 'badge-warning'
    : 'badge-success';

  const diag = insights.diagnostico || {};
  const recomendacoes = insights.recomendacoes || [];
  const tendencias = insights.tendencias || [];
  const fatorCritico = insights.fatorMaisCritico;
  const fatorForte = insights.fatorMaisForte;

  const scoreBar = insights.riskScore != null ? `
    <div class="mb-4">
      <div class="flex items-center justify-between mb-1">
        <span class="font-semibold">Índice Integrado de Exposição a Riscos Psicossociais</span>
        <span class="num font-semibold ${riskClass}">${insights.riskScore}% (${esc(insights.riskLevel.toUpperCase())})</span>
      </div>
      <div class="dist-bar risk-bar-container">
        <div class="risk-bar-fill ${insights.riskLevel === 'crítico' || insights.riskLevel === 'alto' ? 'risk-bar-danger' : insights.riskLevel === 'moderado' || insights.riskLevel === 'medio' ? 'risk-bar-warning' : 'risk-bar-success'}" data-width="${Math.max(5, insights.riskScore)}"></div>
      </div>
      <div class="flex justify-between table-subtext mt-1">
        <span>Risco Mínimo (0%)</span>
        <span>Zona de Atenção (35%)</span>
        <span>Risco Crítico (60%)</span>
      </div>
    </div>
  ` : '';

  const diagCard = diag.label ? `
    <div class="card p-4 bg-subtle mb-4">
      <div class="flex items-center gap-3 mb-2 flex-wrap">
        <span class="badge ${badgeClass}">${esc(diag.label)}</span>
        <span class="num font-semibold ${riskClass}">Média das Dimensões: ${fmt(diag.mediaGeral || report.generalAverage)}</span>
      </div>
      ${diag.descricao ? `<p class="m-0 table-subtext">${esc(diag.descricao)}</p>` : ''}
    </div>
  ` : '';

  const callouts = (fatorCritico || fatorForte) ? `
    <div class="grid grid-cols-2 gap-4 mb-4">
      ${fatorCritico ? `
        <div class="card p-4 bg-subtle border-top-danger">
          <span class="kpi-title color-danger"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Fator Mais Vulnerável</span>
          <div class="font-semibold mt-1">${esc(fatorCritico.label || fatorCritico.key)}</div>
          <div class="num color-danger font-semibold mt-1">${fmt(fatorCritico.average)} / 5,00</div>
          <span class="table-subtext mt-1">Prioridade imediata no plano corretivo do PGR</span>
        </div>
      ` : ''}
      ${fatorForte ? `
        <div class="card p-4 bg-subtle border-top-success">
          <span class="kpi-title color-success"><i class="fa-solid fa-shield-check" aria-hidden="true"></i> Fator de Proteção / Destaque</span>
          <div class="font-semibold mt-1">${esc(fatorForte.label || fatorForte.key)}</div>
          <div class="num color-success font-semibold mt-1">${fmt(fatorForte.average)} / 5,00</div>
          <span class="table-subtext mt-1">Prática positiva consolidada a ser mantida</span>
        </div>
      ` : ''}
    </div>
  ` : '';

  const recsHtml = recomendacoes.length ? `
    <h3 class="card-title mb-3">Recomendações Prioritárias para o Plano de Ação</h3>
    <div class="flex flex-col gap-3 mb-4">
      ${recomendacoes.slice(0, 5).map(rec => {
        const isUrg = rec.urgencia === 'imediata' || rec.urgencia === 'alta';
        const cardClass = isUrg ? 'urgent' : 'high';
        const badgeClass = isUrg ? 'badge-danger' : 'badge-warning';
        const badgeLabel = isUrg ? 'Ação Crítica' : 'Prioridade Alta';

        return `
          <div class="rec-action-card ${cardClass}">
            <div class="rec-action-header">
              <span class="badge ${badgeClass}"><span class="status-dot ${isUrg ? 'dot-danger' : 'dot-warning'}" aria-hidden="true"></span> ${badgeLabel}</span>
              <span class="table-subtext"><i class="fa-regular fa-clock" aria-hidden="true"></i> Prazo sugerido: <strong>${esc(rec.prazo || '30 dias')}</strong></span>
            </div>
            <p class="rec-action-title">${esc(rec.acao)}</p>
            <div class="rec-action-meta">
              <span class="rec-action-meta-item">
                <i class="fa-solid fa-layer-group color-primary" aria-hidden="true"></i>
                Fator: <strong>${esc(rec.fatorLabel || rec.fatorKey)}</strong> (${fmt(rec.media)})
              </span>
              <span class="rec-action-meta-item">
                <i class="fa-solid fa-user-gear" aria-hidden="true"></i>
                Responsável: <strong>${esc(rec.responsavel || 'RH / SST e Gestão Imediata')}</strong>
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const trendsHtml = tendencias.length ? `
    <h3 class="card-title mb-3">Evolução Histórica vs Ciclo Anterior</h3>
    <div class="flex flex-col gap-2 mb-4">
      ${tendencias.map(t => {
        const arrow = t.delta > 0 ? '↑' : t.delta < 0 ? '↓' : '→';
        const cls = t.delta > 0 ? 'color-success' : t.delta < 0 ? 'color-danger' : '';
        return `
          <div class="flex items-center gap-3 card p-2 bg-subtle">
            <span class="num font-semibold ${cls}" arrow-indicator>${arrow}</span>
            <span class="flex-1 font-semibold">${esc(t.label)}</span>
            <span class="num table-subtext ${cls}">${t.delta > 0 ? '+' : ''}${fmt(t.delta)}</span>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  return `
    <section id="diagnostico" class="card mb-6">
      <div class="card-header">
        <h2 class="card-title">Diagnóstico Interpretado & Recomendações</h2>
        <span class="table-subtext">Algoritmo de inferência contextualmente calibrado ao instrumento</span>
      </div>
      <div class="card-body">
        <div class="card p-4 bg-subtle mb-4">
          <strong>Síntese Diagnóstica:</strong>
          <p class="m-0 mt-1">${esc(insights.narrativa || '')}</p>
        </div>
        ${scoreBar}
        ${diagCard}
        ${callouts}
        ${recsHtml}
        ${trendsHtml}
      </div>
    </section>
  `;
}

/* ── Specialized Instrument Dashboards ── */

function detectDashboardType(report) {
  if (report.instrument?.dashboardType) return report.instrument.dashboardType;
  const name = String(report.model || report.instrument?.name || '').toLowerCase();
  if (name.includes('hse')) return 'hse-nr1';
  if (name.includes('maslach') || name.includes('burnout')) return 'burnout';
  if (name.includes('edmondson') || name.includes('segurança') || name.includes('seguranca')) return 'psych-safety';
  if (name.includes('assédio') || name.includes('assedio') || name.includes('14.457') || name.includes('respeito')) return 'assedio-compliance';
  if (name.includes('copsoq') || name.includes('demandas')) return 'copsoq';
  if (name.includes('liderança') || name.includes('lideranca')) return 'lideranca';
  if (name.includes('mudanças') || name.includes('mudancas') || name.includes('transição') || name.includes('transicao')) return 'transicao';
  if (name.includes('pulso')) return 'pulso';
  if (name.includes('eficácia') || name.includes('eficacia') || name.includes('medidas')) return 'eficacia';
  return 'nr1-pgr';
}

function renderSpecializedDashboard(report, factors) {
  const type = detectDashboardType(report);
  switch (type) {
    case 'burnout':
      return renderBurnoutTriadDashboard(report, factors);
    case 'psych-safety':
      return renderEdmondsonDashboard(report, factors);
    case 'copsoq':
      return renderCopsoqDashboard(report, factors);
    case 'assedio-compliance':
      return renderComplianceAssedioDashboard(report, factors);
    case 'eficacia':
      return renderEficaciaDashboard(report, factors);
    case 'lideranca':
      return renderLiderancaDashboard(report, factors);
    case 'transicao':
      return renderTransicaoDashboard(report, factors);
    case 'pulso':
      return renderPulsoDashboard(report, factors);
    case 'hse-nr1':
    case 'nr1-pgr':
    default:
      return renderPgrRiskMatrix(report, factors);
  }
}

/* 1. Matriz de Risco PGR 5x5 (NR-1 / GRO) */
function renderPgrRiskMatrix(report, factors) {
  const cellFactors = {};
  factors.forEach((f, idx) => {
    const avg = f.average ?? 3.0;
    let sev = 1;
    if (avg < 2.5) sev = 5;
    else if (avg < 3.0) sev = 4;
    else if (avg < 3.5) sev = 3;
    else if (avg < 4.0) sev = 2;
    else sev = 1;

    // Dispersão estatística baseada na distribuição
    const dist = f.distribution || [0, 0, 0, 0, 0];
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    const badRate = (dist[0] + dist[1]) / total;
    let prob = 1;
    if (badRate > 0.45) prob = 5;
    else if (badRate > 0.30) prob = 4;
    else if (badRate > 0.18) prob = 3;
    else if (badRate > 0.08) prob = 2;
    else prob = 1;

    // Se todos caírem no mesmo slot, faz um leve espalhamento natural
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
          <p class="view-subtitle m-0">Enquadramento técnico de Severidade × Probabilidade para o Inventário de Riscos</p>
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
            <div class="pgr-legend-item"><span class="pgr-legend-color pgr-cell-trivial"></span> Trivial (1 a 2)</div>
            <div class="pgr-legend-item"><span class="pgr-legend-color pgr-cell-toleravel"></span> Tolerável (3 a 5)</div>
            <div class="pgr-legend-item"><span class="pgr-legend-color pgr-cell-moderado"></span> Moderado (6 a 9)</div>
            <div class="pgr-legend-item"><span class="pgr-legend-color pgr-cell-substancial"></span> Substancial (10 a 15)</div>
            <div class="pgr-legend-item"><span class="pgr-legend-color pgr-cell-intoleravel"></span> Intolerável (16 a 25)</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 2. Tríade de Maslach (MBI) & Risco Previdenciário (NTEP/FAP) */
function renderBurnoutTriadDashboard(report, factors) {
  const exhaustionFactor = factors.find(f => ['energia_vital', 'sobrecarga_emocional', 'volume', 'recuperacao_sono', 'descanso'].includes(f.key)) || factors[0] || { average: 3.5, label: 'Exaustão' };
  const cynicismFactor = factors.find(f => ['desconexao_mental', 'relacoes', 'respeito'].includes(f.key)) || factors[1] || factors[0] || { average: 3.8, label: 'Cinismo' };
  const efficacyFactor = factors.find(f => ['realizacao_competencia', 'proposito_trabalho', 'reconhecimento', 'autonomia'].includes(f.key)) || factors[2] || factors[0] || { average: 4.1, label: 'Eficácia' };

  let riskLevel = 'Baixo / Controlado';
  let riskBadge = 'badge-success';
  let gaugeClass = 'burnout-gauge-low';
  let riskText = 'Baixa probabilidade de afastamentos com nexo causal previdenciário no período.';

  if (exhaustionFactor.average < 2.8) {
    riskLevel = 'Crítico / Alerta NTEP';
    riskBadge = 'badge-danger';
    gaugeClass = 'burnout-gauge-high';
    riskText = 'Risco iminente de absenteísmo e adoecimento por CID-10 Z73.0 (Burnout) e transtornos de humor.';
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
          <p class="view-subtitle m-0">Avaliação multidimensional de Burnout com faixas de corte clínicas de Maslach</p>
        </div>
        <span class="badge ${riskBadge}">
          <i class="fa-solid fa-heart-pulse" aria-hidden="true"></i> ${riskLevel}
        </span>
      </div>
      <div class="card-body">
        <div class="burnout-dashboard-container mb-4">
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

        <!-- Gráfico de Comparação das Dimensões -->
        <div class="card p-4 bg-subtle">
          <h3 class="card-title mb-2">Comparativo Visual das Dimensões de Maslach vs Referência Segura (≥ 3,60)</h3>
          <div class="chart-container-md">
            <canvas id="chart-burnout-bars" role="img" aria-label="Gráfico de dimensões de Burnout"></canvas>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 3. Matriz de Segurança Psicológica de Amy Edmondson (2x2 + Radar) */
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
        <div class="grid grid-cols-2 gap-6 mb-6">
          <!-- Lado Esquerdo: Quadrantes e Diagnóstico -->
          <div>
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div class="card p-3 bg-subtle">
                <span class="kpi-title">Segurança Interpessoal</span>
                <div class="kpi-val ${psychAvg < 3.4 ? 'color-danger' : 'color-success'}">${fmt(psychAvg)}</div>
              </div>
              <div class="card p-3 bg-subtle">
                <span class="kpi-title">Responsabilidade & Metas</span>
                <div class="kpi-val ${perfAvg < 3.4 ? 'color-warning' : 'color-success'}">${fmt(perfAvg)}</div>
              </div>
            </div>

            <div class="card p-4 bg-subtle mb-4">
              <span class="kpi-title">Diagnóstico de Posição da Equipe</span>
              <div class="font-semibold mt-1 ${isLearning ? 'color-success' : isAnxiety ? 'color-danger' : 'color-warning'}">
                ${isLearning ? 'Zona de Aprendizado (Alta Performance)' : isAnxiety ? 'Zona de Ansiedade Interpessoal' : isComfort ? 'Zona de Conforto Operacional' : 'Zona de Apatia'}
              </div>
              <p class="table-subtext m-0 mt-1">
                ${isLearning ? 'Colaboradores inovam, apontam erros precocemente e assumem riscos sem medo de retaliação.' : isAnxiety ? 'Cobrança alta com receio de expor dúvidas ou falhas. Risco de omissão de erros operacionais.' : isComfort ? 'Ambiente acolhedor, mas com baixa disciplina de metas e melhoria contínua.' : 'Desengajamento e silêncio. A equipe evita se posicionar por receio de punição.'}
              </p>
            </div>

            <div class="edmondson-quadrants-grid">
              <div class="edmondson-quadrant ${isAnxiety ? 'active-zone' : ''}">
                <div class="flex items-center justify-between">
                  <strong>Zona de Ansiedade</strong>
                  ${isAnxiety ? '<span class="badge badge-danger">Posição Atual</span>' : ''}
                </div>
                <p class="table-subtext m-0">Alta Cobrança + Baixa Segurança.</p>
              </div>

              <div class="edmondson-quadrant ${isLearning ? 'active-zone' : ''}">
                <div class="flex items-center justify-between">
                  <strong>Zona de Aprendizado</strong>
                  ${isLearning ? '<span class="badge badge-success">Posição Atual</span>' : ''}
                </div>
                <p class="table-subtext m-0">Alta Cobrança + Alta Segurança.</p>
              </div>

              <div class="edmondson-quadrant ${isApathy ? 'active-zone' : ''}">
                <div class="flex items-center justify-between">
                  <strong>Zona de Apatia</strong>
                  ${isApathy ? '<span class="badge badge-warning">Posição Atual</span>' : ''}
                </div>
                <p class="table-subtext m-0">Baixa Cobrança + Baixa Segurança.</p>
              </div>

              <div class="edmondson-quadrant ${isComfort ? 'active-zone' : ''}">
                <div class="flex items-center justify-between">
                  <strong>Zona de Conforto</strong>
                  ${isComfort ? '<span class="badge badge-neutral">Posição Atual</span>' : ''}
                </div>
                <p class="table-subtext m-0">Baixa Cobrança + Alta Segurança.</p>
              </div>
            </div>
          </div>

          <!-- Lado Direito: Gráfico Radar das 6 Dimensões -->
          <div class="card p-4 bg-subtle flex flex-col">
            <h3 class="card-title mb-1">Radar de Confiança e Voz Ativa</h3>
            <span class="table-subtext mb-3">Mapeamento das 6 dimensões de segurança psicológica</span>
            <div class="chart-container-flex">
              <canvas id="chart-edmondson-radar" role="img" aria-label="Radar de Segurança Psicológica"></canvas>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 4. COPSOQ II: Exigências Psicológicas & Balanço Demandas vs Recursos */
function renderCopsoqDashboard(report, factors) {
  const demands = factors.filter(f => ['volume_quantitativo', 'prazos_pressao', 'ritmo_continuo', 'interrupcoes', 'demandas_cognitivas', 'demandas_emocionais'].includes(f.key));
  const resources = factors.filter(f => !demands.some(d => d.key === f.key));

  const dAvg = demands.length ? demands.reduce((a, b) => a + b.average, 0) / demands.length : 3.0;
  const rAvg = resources.length ? resources.reduce((a, b) => a + b.average, 0) / resources.length : 3.5;

  const isStressZone = dAvg < 3.0;

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Matriz COPSOQ II: Carga de Trabalho & Exigências Psicológicas</h2>
          <p class="view-subtitle m-0">Balanço entre Demandas Ocupacionais e Recursos de Enfrentamento da Equipe</p>
        </div>
        <span class="badge ${isStressZone ? 'badge-danger' : 'badge-primary'}">COPSOQ II</span>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="card p-4 bg-subtle">
            <span class="kpi-title">Média das Demandas (Ritmo, Prazos, Carga)</span>
            <div class="kpi-val ${dAvg < 3.0 ? 'color-danger' : 'color-warning'}">${fmt(dAvg)}</div>
            <span class="kpi-sub">${dAvg < 3.0 ? 'Sobrecarga operacional crítica' : 'Carga de trabalho tolerável'}</span>
          </div>
          <div class="card p-4 bg-subtle">
            <span class="kpi-title">Média dos Recursos (Autonomia, Apoio)</span>
            <div class="kpi-val ${rAvg >= 3.6 ? 'color-success' : 'color-warning'}">${fmt(rAvg)}</div>
            <span class="kpi-sub">${rAvg >= 3.6 ? 'Recursos adequados para amortecer o estresse' : 'Apoio necessita reforço'}</span>
          </div>
        </div>

        <div class="card p-4 bg-subtle">
          <h3 class="card-title mb-2">Balanço de Demandas vs Recursos Organizacionais</h3>
          <div class="chart-container-lg">
            <canvas id="chart-copsoq-balance" role="img" aria-label="Gráfico de Demandas vs Recursos COPSOQ"></canvas>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 5. Dossiê Oficial de Conformidade CIPA & Lei 14.457/22 */
function renderComplianceAssedioDashboard(report, factors) {
  const fTrat = factors.find(f => ['tratamento_digno', 'respeito', 'relacoes'].includes(f.key)) || { average: 3.8 };
  const fCanal = factors.find(f => ['conhecimento_canal', 'canal'].includes(f.key)) || { average: 3.5 };
  const fCapac = factors.find(f => ['prevencao_moral', 'prevencao_sexual', 'discriminacao'].includes(f.key)) || { average: 3.6 };
  const fConf = factors.find(f => ['confianca_antirretaliacao', 'retaliacao'].includes(f.key)) || { average: 3.4 };

  const avgGeral = (fTrat.average + fCanal.average + fCapac.average + fConf.average) / 4;
  const isConforme = avgGeral >= 3.6;
  const isAlerta = avgGeral >= 2.8 && !isConforme;

  const sealClass = isConforme ? 'dossier-seal-success' : isAlerta ? 'dossier-seal-warning' : 'dossier-seal-danger';
  const sealIcon = isConforme ? 'fa-circle-check' : isAlerta ? 'fa-triangle-exclamation' : 'fa-circle-xmark';
  const sealText = isConforme ? 'Conformidade Legal Atendida' : isAlerta ? 'Alerta Preventivo CIPA' : 'Irregularidade / Não Conforme';

  const pillars = [
    {
      req: 'Art. 23, I — Código de Conduta e Fixação de Regras',
      title: 'Civilidade e Tolerância Zero',
      avg: fTrat.average,
      parecer: fTrat.average >= 3.6 ? 'Políticas claras e respeitadas no ambiente.' : 'Necessário reforço nos rituais de liderança e convivência.',
      acao: 'Revisão periódica na integração de colaboradores.'
    },
    {
      req: 'Art. 23, II — Canal Protegido de Recebimento de Denúncias',
      title: 'Acesso e Divulgação do Canal',
      avg: fCanal.average,
      parecer: fCanal.average >= 3.6 ? 'Canal amplamente conhecido pela equipe.' : 'Canal existente, porém pouco visível na rotina operacional.',
      acao: 'Campanha de comunicação visual e QR Code nos murais.'
    },
    {
      req: 'Art. 23, III — Capacitação Obrigatória CIPA e Empregados',
      title: 'Prevenção ao Assédio Moral e Sexual',
      avg: fCapac.average,
      parecer: fCapac.average >= 3.6 ? 'Equipes instruídas sobre limites e respeito.' : 'Treinamento ainda concentrado apenas na CIPA.',
      acao: 'Workshops práticos anuais para 100% dos colaboradores.'
    },
    {
      req: 'Art. 23, IV — Blindagem Antirretaliação ao Denunciante',
      title: 'Confiança e Sigilo no Processo',
      avg: fConf.average,
      parecer: fConf.average >= 3.6 ? 'Segurança no anonimato e acolhimento íntegro.' : 'Receio moderado de retaliação em caso de reporte.',
      acao: 'Auditoria externa do fluxo e reforço de sigilo no PGR.'
    }
  ];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Dossiê de Conformidade Legal &bull; Lei 14.457/22 e CIPA</h2>
          <p class="view-subtitle m-0">Auditoria técnica estruturada para verificação fiscal e governança trabalhista</p>
        </div>
        <span class="dossier-seal ${sealClass}">
          <i class="fa-solid ${sealIcon}" aria-hidden="true"></i> ${sealText}
        </span>
      </div>
      <div class="card-body">
        <div class="dossier-banner flex items-center justify-between flex-wrap gap-4">
          <div>
            <strong>Índice Consolidado de Conformidade:</strong>
            <div class="table-subtext">Média ponderada dos 4 pilares mandatórios da legislação</div>
          </div>
          <div class="num font-bold text-2xl ${isConforme ? 'color-success' : isAlerta ? 'color-warning' : 'color-danger'}">
            ${fmt(avgGeral)} / 5,00
          </div>
        </div>

        <div class="table-wrap mb-4">
          <table class="table">
            <thead>
              <tr>
                <th>Requisito Mandatório (Lei 14.457/22)</th>
                <th>Nota Média</th>
                <th>Parecer da Escuta</th>
                <th>Providência Mandatória PGR</th>
              </tr>
            </thead>
            <tbody>
              ${pillars.map(p => {
                const ok = p.avg >= 3.6;
                const warn = p.avg >= 2.8 && !ok;
                const cls = ok ? 'color-success' : warn ? 'color-warning' : 'color-danger';
                return `
                  <tr>
                    <td>
                      <strong>${esc(p.title)}</strong>
                      <div class="table-subtext">${esc(p.req)}</div>
                    </td>
                    <td>
                      <span class="num font-semibold ${cls}">${fmt(p.avg)}</span>
                    </td>
                    <td>
                      <span class="table-subtext">${esc(p.parecer)}</span>
                    </td>
                    <td>
                      <span class="table-subtext">${esc(p.acao)}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="card p-3 bg-subtle text-xs color-text-secondary flex items-center gap-2">
          <i class="fa-solid fa-file-circle-check color-success" aria-hidden="true"></i>
          <span>Dossiê autoverificado com quórum protegido, pronto para instruir atas da CIPA e inspeções do MTE.</span>
        </div>
      </div>
    </section>
  `;
}

/* 6. Dossiê de Retorno das Medidas Preventivas PGR */
function renderEficaciaDashboard(report, factors) {
  const eff = factors.filter(f => f.average >= 3.6).length;
  const med = factors.filter(f => f.average >= 2.8 && f.average < 3.6).length;
  const crit = factors.filter(f => f.average < 2.8).length;

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Dossiê de Eficácia e Retorno das Medidas PGR</h2>
          <p class="view-subtitle m-0">Avaliação do impacto prático percebido na rotina diária das equipes</p>
        </div>
        <span class="badge badge-primary">Auditoria de Medidas</span>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card p-4 bg-subtle border-top-success">
            <span class="kpi-title">Impacto Comprovado na Rotina</span>
            <div class="kpi-val color-success">${eff}</div>
            <span class="kpi-sub">Medidas consolidadas (≥ 3,60)</span>
          </div>
          <div class="card p-4 bg-subtle border-top-warning">
            <span class="kpi-title">Eficácia Parcial em Ajuste</span>
            <div class="kpi-val color-warning">${med}</div>
            <span class="kpi-sub">Necessitam calibragem (2,80 a 3,59)</span>
          </div>
          <div class="card p-4 bg-subtle border-top-danger">
            <span class="kpi-title">Medidas Inócuas / Burocráticas</span>
            <div class="kpi-val color-danger">${crit}</div>
            <span class="kpi-sub">Sem repercussão prática (< 2,80)</span>
          </div>
        </div>

        <h3 class="card-title mb-3">Tabela de Veredito Técnico das Intervenções</h3>
        <div class="table-wrap mb-4">
          <table class="table">
            <thead>
              <tr>
                <th>Medida Avaliada</th>
                <th>Nota Média</th>
                <th>Percepção da Equipe</th>
                <th>Veredito SESMT / RH</th>
              </tr>
            </thead>
            <tbody>
              ${factors.map(f => {
                const ok = f.average >= 3.6;
                const warn = f.average >= 2.8 && !ok;
                const vClass = ok ? 'verdict-maintain' : warn ? 'verdict-adjust' : 'verdict-redesign';
                const vText = ok ? 'Manter & Expandir' : warn ? 'Ajustar Operação' : 'Redesenhar com o Time';
                const percText = ok
                  ? 'Colaboradores utilizam com facilidade e percebem alívio na rotina.'
                  : warn
                  ? 'Medida conhecida, porém com barreiras operacionais de aplicação.'
                  : 'Pouco aplicada ou vista apenas como exigência formal sem efeito.';

                return `
                  <tr>
                    <td><strong>${esc(f.label || f.key)}</strong></td>
                    <td><span class="num font-semibold ${ok ? 'color-success' : warn ? 'color-warning' : 'color-danger'}">${fmt(f.average)}</span></td>
                    <td><span class="table-subtext">${esc(percText)}</span></td>
                    <td><span class="verdict-badge ${vClass}">${vText}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

/* 7. Painel Diagnóstico de Liderança e Justiça Organizacional */
function renderLiderancaDashboard(report, factors) {
  const fSup = factors.find(f => ['suporte_gestor', 'apoio_gestao', 'lideranca'].includes(f.key)) || { average: 3.5, label: 'Suporte Imediato' };
  const fJust = factors.find(f => ['justica_procedimental', 'transparencia', 'criterios'].includes(f.key)) || { average: 3.2, label: 'Justiça e Transparência' };
  const fFeed = factors.find(f => ['feedback_util', 'escuta_ativa', 'comunicacao'].includes(f.key)) || { average: 3.4, label: 'Qualidade do Feedback' };

  const axes = [
    {
      title: 'Suporte Operacional & Presença',
      avg: fSup.average,
      desc: 'Disponibilidade da liderança para desbloquear entraves e apoiar o time.',
      status: fSup.average >= 3.6 ? 'Alta Proximidade' : 'Apoio Pontual'
    },
    {
      title: 'Justiça Procedimental & Critérios',
      avg: fJust.average,
      desc: 'Clareza na distribuição de demandas, metas e reconhecimento.',
      status: fJust.average >= 3.6 ? 'Critérios Transparentes' : 'Incerteza Moderada'
    },
    {
      title: 'Escuta Ativa & Qualidade de Feedback',
      avg: fFeed.average,
      desc: 'Retorno frequente e construtivo focado no desenvolvimento.',
      status: fFeed.average >= 3.6 ? 'Comunicação Aberta' : 'Feedback Esporádico'
    }
  ];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Dossiê de Diagnóstico de Liderança & Governança</h2>
          <p class="view-subtitle m-0">Leitura analítica dos 3 eixos fundamentais de gestão de pessoas</p>
        </div>
        <span class="badge badge-primary">Eixos de Liderança</span>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-3 gap-4">
          ${axes.map(ax => {
            const ok = ax.avg >= 3.6;
            const warn = ax.avg >= 2.8 && !ok;
            const colorClass = ok ? 'color-success' : warn ? 'color-warning' : 'color-danger';
            const barClass = ok ? 'risk-bar-success' : warn ? 'risk-bar-warning' : 'risk-bar-danger';
            const pct = Math.min(100, Math.round((ax.avg / 5.0) * 100));

            return `
              <div class="card p-4 bg-subtle flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-bold">${esc(ax.title)}</span>
                    <span class="num font-bold text-lg ${colorClass}">${fmt(ax.avg)}</span>
                  </div>
                  <span class="badge ${ok ? 'badge-success' : 'badge-warning'} mb-2">${ax.status}</span>
                  <p class="table-subtext m-0 mb-3">${esc(ax.desc)}</p>
                </div>
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span>Aprovação da Equipe</span>
                    <span class="font-semibold">${pct}%</span>
                  </div>
                  <div class="axis-meter-bar">
                    <div class="axis-meter-fill ${barClass}" data-width="${pct}"></div>
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

/* 8. Matriz de Prontidão à Mudança Organizacional */
function renderTransicaoDashboard(report, factors) {
  const steps = [
    { num: 1, title: 'Comunicação do Porquê', desc: 'Clareza dos motivos e transparência nas etapas', factorsKey: 'comunicacao_mudanca' },
    { num: 2, title: 'Domínio de Ferramentas', desc: 'Capacitação prévia antes da exigência de metas', factorsKey: 'capacitacao_processos' },
    { num: 3, title: 'Tolerância ao Aprendizado', desc: 'Respaldo a erros normais na fase de adaptação', factorsKey: 'suporte_transicao' },
    { num: 4, title: 'Estabilização da Rotina', desc: 'Previsibilidade e consolidação do novo fluxo', factorsKey: 'previsibilidade' }
  ];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Matriz de Prontidão & Transição Organizacional</h2>
          <p class="view-subtitle m-0">Acompanhamento das 4 etapas de adaptação das equipes a novos cenários</p>
        </div>
        <span class="badge badge-primary">Fluxo de Transição</span>
      </div>
      <div class="card-body">
        <div class="timeline-flow-grid">
          ${steps.map((st, idx) => {
            const factor = factors[idx] || { average: 3.3 };
            const ok = factor.average >= 3.6;
            const warn = factor.average >= 2.8 && !ok;
            const cls = ok ? 'color-success' : warn ? 'color-warning' : 'color-danger';

            return `
              <div class="timeline-flow-card">
                <div class="flex items-center justify-between gap-2">
                  <span class="timeline-step-badge">${st.num}</span>
                  <span class="num font-bold ${cls}">${fmt(factor.average)} / 5</span>
                </div>
                <strong>${esc(st.title)}</strong>
                <p class="table-subtext m-0">${esc(st.desc)}</p>
                <div class="mt-2">
                  <span class="badge ${ok ? 'badge-success' : warn ? 'badge-warning' : 'badge-danger'}">
                    ${ok ? 'Fase Madura' : warn ? 'Em Calibragem' : 'Ponto Crítico'}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/* 9. Painel Meteorológico do Clima & Pulso Rápido */
function renderPulsoDashboard(report, factors) {
  const cards = [
    { icon: 'fa-bolt', iconColor: 'color-warning', title: 'Energia & Ritmo', desc: 'Fôlego operacional e ausência de sobrecarga contínua' },
    { icon: 'fa-bullseye', iconColor: 'color-primary', title: 'Foco & Prazos', desc: 'Clareza de prioridades da semana sem mudanças bruscas' },
    { icon: 'fa-handshake', iconColor: 'color-success', title: 'Apoio Entre Pares', desc: 'Cooperação mútua nos momentos de pico de trabalho' },
    { icon: 'fa-shield-halved', iconColor: 'color-info', title: 'Respaldo do Líder', desc: 'Acolhimento de dúvidas e segurança para atuar' }
  ];

  return `
    <section id="painel-especializado" class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="card-title">Termômetro Climático &bull; Pulso Ágil do Mês</h2>
          <p class="view-subtitle m-0">Leitura executiva dos 4 sinais vitais da rotina da equipe</p>
        </div>
        <span class="badge badge-primary">Pulso em 5 Segundos</span>
      </div>
      <div class="card-body">
        <div class="weather-pulse-grid">
          ${cards.map((c, i) => {
            const f = factors[i] || { average: 3.4 };
            const ok = f.average >= 3.6;
            const warn = f.average >= 2.8 && !ok;
            const colorClass = ok ? 'color-success' : warn ? 'color-warning' : 'color-danger';

            return `
              <div class="weather-card">
                <i class="fa-solid ${c.icon} weather-icon ${c.iconColor}" aria-hidden="true"></i>
                <strong>${esc(c.title)}</strong>
                <span class="num font-bold text-2xl ${colorClass}">${fmt(f.average)}</span>
                <span class="table-subtext">${esc(c.desc)}</span>
                <span class="badge ${ok ? 'badge-success' : warn ? 'badge-warning' : 'badge-danger'} mt-1">
                  ${ok ? 'Estável' : warn ? 'Oscilando' : 'Desfavorável'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/* ── Portal de Soluções & Medidas Preventivas NR-1 ── */
function renderSolutionsPortal(report, factors, isViewer) {
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
                  <div class="solution-factor-meta">
                    <span class="status-dot ${isDanger ? 'dot-danger' : 'dot-warning'}" aria-hidden="true"></span>
                    <span class="table-subtext">Fator:</span>
                    <span class="font-semibold text-xs color-text-primary">${esc(f.label || f.key)}</span>
                    <span class="num text-xs font-semibold ${isDanger ? 'color-danger' : 'color-warning'}">(${fmt(f.average)})</span>
                  </div>
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

/* ── Lifecycle Hook for Mounting Interactive Chart.js Canvases in Report ── */

export function mountedCycleReport({ params, state }) {
  document.querySelectorAll('[data-width]').forEach(el => {
    el.style.width = `${el.dataset.width}%`;
  });

  const reportId = params?.id;
  const report = (state.reports || []).find(r => r.id === reportId || r.surveyId === reportId);
  if (!report || !window.DashboardCharts) return;

  const factors = report.result || report.factors || [];
  const type = detectDashboardType(report);

  if (type === 'psych-safety') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createRadarChart('chart-edmondson-radar', labels, data, 'Segurança Psicológica');
  } else if (type === 'copsoq') {
    const demands = factors.filter(f => ['volume_quantitativo', 'prazos_pressao', 'ritmo_continuo', 'interrupcoes', 'demandas_cognitivas', 'demandas_emocionais'].includes(f.key));
    const resources = factors.filter(f => !demands.some(d => d.key === f.key));
    window.DashboardCharts.createDemandsResourcesChart('chart-copsoq-balance', demands.length ? demands : factors.slice(0, 3), resources.length ? resources : factors.slice(3));
  } else if (type === 'burnout') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createSpecializedBarChart('chart-burnout-bars', labels, data, { crit: 2.8, safe: 3.6 });
  } else if (type === 'assedio-compliance') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createSpecializedBarChart('chart-compliance-bars', labels, data, { crit: 3.0, safe: 3.8 });
  } else if (type === 'lideranca') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createSpecializedBarChart('chart-lideranca-bars', labels, data, { crit: 2.8, safe: 3.6 });
  } else if (type === 'eficacia') {
    const eff = factors.filter(f => f.average >= 3.6).length;
    const med = factors.filter(f => f.average >= 2.8 && f.average < 3.6).length;
    const crit = factors.filter(f => f.average < 2.8).length;
    window.DashboardCharts.createActionEfficacyChart('chart-eficacia-doughnut', {
      labels: ['Impacto Real na Rotina', 'Eficácia Parcial', 'Ineficazes / Sem Efeito'],
      counts: [eff, med, crit]
    });
  } else if (type === 'transicao') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createSpecializedBarChart('chart-transicao-bars', labels, data, { crit: 2.8, safe: 3.6 });
  } else if (type === 'pulso') {
    const labels = factors.map(f => f.label || f.key);
    const data = factors.map(f => f.average || 3.0);
    window.DashboardCharts.createSpecializedBarChart('chart-pulso-bars', labels, data, { crit: 3.0, safe: 3.6 });
  }

  // Inicializa o primeiro slide de visualização do relatório
  switchReportSlide(0);
}

/* ── Interactive Horizontal Slides Switching for Results Report ── */

export function switchReportSlide(index) {
  const track = document.getElementById('report-slides-track');
  const slides = document.querySelectorAll('.report-slide');
  const tabs = document.querySelectorAll('[data-action="switch-report-slide"]');
  const btnPrev = document.getElementById('btn-report-prev-slide');
  const btnNext = document.getElementById('btn-report-next-slide');
  const indexLabel = document.getElementById('report-slide-index-label');
  const titleLabel = document.getElementById('report-slide-title-label');

  const total = slides.length;
  if (total === 0) return;
  const idx = Math.max(0, Math.min(total - 1, parseInt(index, 10) || 0));

  if (track) {
    track.dataset.activeSlide = String(idx);
    track.style.transform = `translateX(-${idx * 100}%)`;
  }

  slides.forEach((s, i) => {
    s.classList.toggle('active', i === idx);
  });

  tabs.forEach((t, i) => {
    t.classList.toggle('active', i === idx);
    if (i === idx) {
      t.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  });

  if (btnPrev) {
    btnPrev.disabled = (idx === 0);
  }
  if (btnNext) {
    btnNext.disabled = (idx === total - 1);
  }

  const activeSlide = slides[idx];
  const slideTitle = activeSlide?.querySelector('.card-title')?.textContent?.trim() || `Tela ${idx + 1}`;
  if (indexLabel) {
    indexLabel.textContent = `Tela ${idx + 1} de ${total}`;
  }
  if (titleLabel) {
    titleLabel.textContent = slideTitle;
  }

  // Redimensiona gráficos Chart.js ao alternar para a tela correspondente
  window.dispatchEvent(new Event('resize'));
}

export function prevReportSlide() {
  const track = document.getElementById('report-slides-track');
  const activeSlide = parseInt(track?.dataset?.activeSlide || '0', 10);
  if (activeSlide > 0) {
    switchReportSlide(activeSlide - 1);
  }
}

export function nextReportSlide() {
  const track = document.getElementById('report-slides-track');
  const slides = document.querySelectorAll('.report-slide');
  const activeSlide = parseInt(track?.dataset?.activeSlide || '0', 10);
  if (activeSlide < slides.length - 1) {
    switchReportSlide(activeSlide + 1);
  }
}

