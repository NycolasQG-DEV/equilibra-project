// public/js/charts.js
// Módulo de renderização de gráficos com Chart.js, destruição limpa de instâncias e visualizações contextuais.

window.DashboardCharts = (() => {
  const charts = new Map();
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function getCanvas(canvasOrId) {
    if (typeof canvasOrId === 'string') {
      return document.getElementById(canvasOrId);
    }
    return canvasOrId;
  }

  function destroy(canvasOrId) {
    const canvas = getCanvas(canvasOrId);
    if (!canvas) return;
    if (charts.has(canvas)) {
      charts.get(canvas).destroy();
      charts.delete(canvas);
    }
  }

  function markup(rows, comparison = false) {
    return `<div class="dashboard-chart" data-chart="${escape(JSON.stringify({ rows, comparison }))}"><canvas role="img" aria-label="${comparison ? 'Comparação descritiva entre ciclos' : 'Percepção por fator'}: escala de 1 a 5. Valores numéricos disponíveis abaixo."></canvas></div>`;
  }

  function mount() {
    for (const [canvas, chart] of charts) {
      if (!canvas.isConnected) {
        chart.destroy();
        charts.delete(canvas);
      }
    }
    if (!window.Chart) return;

    document.querySelectorAll('[data-chart]').forEach((container) => {
      const canvas = container.querySelector('canvas');
      if (!canvas || charts.has(canvas)) return;
      const { rows, comparison } = JSON.parse(container.dataset.chart);
      if (!rows.length) return;

      container.style.height = `${Math.max(280, rows.length * (comparison ? 58 : 42))}px`;
      const currentColors = rows.map(r => {
        if (r.average < 2.8) return '#dc2626'; // Atenção (< 2.8)
        if (r.average < 3.6) return '#d97706'; // Cuidado (2.8 a 3.59)
        return '#16a34a'; // Adequado (>= 3.6)
      });
      const datasets = [{
        label: comparison ? 'Ciclo atual' : 'Percepção média',
        data: rows.map(r => r.average),
        backgroundColor: comparison ? '#0f172a' : currentColors,
        borderRadius: 6,
        maxBarThickness: 22
      }];
      if (comparison) {
        datasets.unshift({
          label: 'Ciclo de referência',
          data: rows.map(r => r.previous),
          backgroundColor: '#94a3b8',
          borderRadius: 6,
          maxBarThickness: 22
        });
      }
      charts.set(canvas, new Chart(canvas, {
        type: 'bar',
        data: { labels: rows.map(r => r.label), datasets },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
          plugins: {
            legend: {
              display: comparison,
              position: 'bottom',
              labels: { boxWidth: 12, font: { family: "'Montserrat', system-ui, sans-serif", size: 12, weight: 600 }, color: '#334155' }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { family: "'Montserrat', system-ui, sans-serif", size: 13, weight: 700 },
              bodyFont: { family: "'Montserrat', system-ui, sans-serif", size: 12 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: c => {
                  const val = Number(c.raw);
                  let status = '';
                  if (val < 2.8) status = ' (Atenção)';
                  else if (val < 3.6) status = ' (Cuidado)';
                  else status = ' (Adequado)';
                  return `${c.dataset.label}: ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 5.00${status}`;
                }
              }
            }
          },
          scales: {
            x: {
              min: 1,
              max: 5,
              ticks: { stepSize: 1, color: '#64748b', font: { family: "'Montserrat', system-ui, sans-serif", size: 11 } },
              title: { display: true, text: 'Escala Likert (1 = Desfavorável a 5 = Favorável)', color: '#64748b', font: { size: 11, weight: 600 } },
              grid: { color: '#e2e8f0' }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#0f172a', font: { family: "'Montserrat', system-ui, sans-serif", size: 12, weight: 600 } }
            }
          }
        }
      }));
    });
  }

  // Gráfico 1: Evolução da taxa de participação nos ciclos
  function createParticipationTrendChart(canvasId, data = []) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    let list = Array.isArray(data) ? data : [];
    if (!list.length && data && data.labels && data.rates) {
      list = data.labels.map((lbl, i) => ({ cycle: lbl, rate: data.rates[i] }));
    }

    if (!window.Chart || !list.length) return;

    const labels = list.map(d => d.cycle);
    const rates = list.map(d => d.rate);
    const targets = list.map(() => 70);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Taxa de Participação (%)',
            data: rates,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointBackgroundColor: '#0284c7',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Meta Mínima (70%)',
            data: targets,
            borderColor: '#16a34a',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { family: "'Montserrat', system-ui, sans-serif", size: 11, weight: 600 }, color: '#475569' }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => `${c.dataset.label}: ${c.raw}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, callback: val => `${val}%`, font: { size: 10 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600, family: 'Montserrat, sans-serif' }, color: '#334155' }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 2: Fatores mais críticos do último ciclo
  function createFactorBarChart(canvasId, factors = []) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    let list = Array.isArray(factors) ? factors : [];
    if (!list.length && factors && factors.labels && factors.values) {
      list = factors.labels.map((lbl, i) => ({ label: lbl, average: factors.values[i] }));
    }

    if (!window.Chart || !list.length) return;

    const labels = list.map(f => f.label);
    const data = list.map(f => f.average);
    const bgColors = list.map(f => (f.average < 2.8 ? '#dc2626' : f.average < 3.6 ? '#d97706' : '#16a34a'));

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Média (1 a 5)',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          maxBarThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => `Média: ${Number(c.raw).toFixed(2)} / 5,00`
            }
          }
        },
        scales: {
          x: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: '#f1f5f9' }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600, family: 'Montserrat, sans-serif' }, color: '#334155' }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 3: Eficácia das medidas
  function createActionEfficacyChart(canvasId, efficacy = { effective: 0, inProgress: 0, reviewDue: 0 }) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    let eff = efficacy.effective ?? 0;
    let inProg = efficacy.inProgress ?? 0;
    let ineff = efficacy.ineffective ?? 0;

    if (Array.isArray(efficacy.counts)) {
      eff = efficacy.counts[0] || 0;
      inProg = efficacy.counts[1] || 0;
      ineff = efficacy.counts[2] || 0;
    }

    const total = eff + inProg + ineff;

    // Se ainda não há ações, renderiza baseline educativo
    const data = total > 0 ? [eff, inProg, ineff] : [3, 2, 1];
    const labels = total > 0 ? ['Eficazes', 'Em andamento', 'A revisar'] : ['Metas no Prazo', 'Em Estruturação', 'Preventivas'];

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#16a34a', '#0284c7', '#d97706'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { family: "'Montserrat', system-ui, sans-serif", size: 11, weight: 600 }, color: '#475569' }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => `${c.label}: ${c.raw} ${total === 0 ? '(demonstração)' : 'ação(ões)'}`
            }
          }
        },
        cutout: '68%'
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 4: Radar / Spider para Segurança Psicológica & COPSOQ
  function createRadarChart(canvasId, labels = [], data = [], title = 'Percepção Coletiva') {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    if (!window.Chart || !labels.length) return;

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: title,
            data,
            backgroundColor: 'rgba(2, 132, 199, 0.22)',
            borderColor: '#0284c7',
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.2
          },
          {
            label: 'Zona Segura (Meta 3,60)',
            data: labels.map(() => 3.6),
            borderColor: '#16a34a',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Corte Crítico (2,80)',
            data: labels.map(() => 2.8),
            borderColor: '#dc2626',
            borderWidth: 1.2,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, color: '#64748b', font: { size: 10 } },
            grid: { color: '#e2e8f0' },
            angleLines: { color: '#e2e8f0' },
            pointLabels: {
              font: { size: 11, weight: 600, family: "'Montserrat', system-ui, sans-serif" },
              color: '#1e293b'
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { family: "'Montserrat', system-ui, sans-serif", size: 11, weight: 600 }, color: '#475569' }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => `${c.dataset.label}: ${Number(c.raw).toFixed(2)} / 5,00`
            }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 5: Barras horizontais de diagnóstico especializado
  function createSpecializedBarChart(canvasId, labels = [], data = [], thresholds = { crit: 2.8, safe: 3.6 }) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    if (!window.Chart || !labels.length) return;

    const bgColors = data.map(val => (val < thresholds.crit ? '#dc2626' : val < thresholds.safe ? '#d97706' : '#16a34a'));

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Média Coletiva',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          maxBarThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => {
                const val = Number(c.raw);
                const tag = val < thresholds.crit ? ' (Atenção / Risco)' : val < thresholds.safe ? ' (Cuidado)' : ' (Adequado)';
                return `Pontuação: ${val.toFixed(2)} / 5,00${tag}`;
              }
            }
          }
        },
        scales: {
          x: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, color: '#64748b', font: { size: 10 } },
            grid: { color: '#f1f5f9' },
            title: { display: true, text: 'Escala 1 (Crítico) a 5 (Adequado)', color: '#64748b', font: { size: 11, weight: 600 } }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600, family: "'Montserrat', system-ui, sans-serif" }, color: '#0f172a' }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 6: Comparação Bi-direcional Demandas vs Recursos (COPSOQ)
  function createDemandsResourcesChart(canvasId, demands = [], resources = []) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    if (!window.Chart) return;

    const labels = [
      ...demands.map(d => `[Demanda] ${d.label}`),
      ...resources.map(r => `[Recurso] ${r.label}`)
    ];

    const data = [
      ...demands.map(d => d.average),
      ...resources.map(r => r.average)
    ];

    const bgColors = [
      ...demands.map(d => (d.average < 2.8 ? '#dc2626' : d.average < 3.6 ? '#ea580c' : '#f59e0b')),
      ...resources.map(r => (r.average >= 3.6 ? '#16a34a' : r.average >= 2.8 ? '#0284c7' : '#dc2626'))
    ];

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Média Coletiva',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: c => `Pontuação: ${Number(c.raw).toFixed(2)} / 5,00`
            }
          }
        },
        scales: {
          x: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: '#f1f5f9' },
            title: { display: true, text: 'Pontuação (1 a 5)', color: '#64748b', font: { size: 11, weight: 600 } }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600, family: "'Montserrat', system-ui, sans-serif" }, color: '#0f172a' }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  function mountOverviewCharts(todayData) {
    if (!todayData || !todayData.charts) return;
    if (todayData.charts.participationTrend) {
      createParticipationTrendChart('chart-participation-canvas', todayData.charts.participationTrend);
    }
    if (todayData.charts.factorRanking || todayData.charts.factorAverages) {
      createFactorBarChart('chart-factors-canvas', todayData.charts.factorRanking || todayData.charts.factorAverages);
    }
    if (todayData.charts.actionEfficacy || todayData.charts.efficacy) {
      createActionEfficacyChart('chart-actions-canvas', todayData.charts.actionEfficacy || todayData.charts.efficacy);
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        mount();
      });
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    mount();
  });

  window.addEventListener('beforeprint', () => charts.forEach(chart => chart.resize()));
  window.addEventListener('afterprint', () => charts.forEach(chart => chart.resize()));

  return {
    markup,
    mount,
    destroy,
    createParticipationTrendChart,
    createFactorBarChart,
    createActionEfficacyChart,
    createRadarChart,
    createSpecializedBarChart,
    createDemandsResourcesChart,
    mountOverviewCharts
  };
})();
