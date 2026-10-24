// public/js/charts.js
// Módulo de renderização de gráficos com Chart.js, destruição limpa de instâncias e tabelas acessíveis.

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
        if (r.average < 2.8) return '#b91c1c'; // Atenção (< 2.8)
        if (r.average < 3.6) return '#b45309'; // Cuidado (2.8 a 3.59)
        return '#581c43'; // Adequado (>= 3.6)
      });
      const datasets = [{
        label: comparison ? 'Ciclo atual' : 'Percepção média',
        data: rows.map(r => r.average),
        backgroundColor: comparison ? '#581c43' : currentColors,
        borderRadius: 6,
        maxBarThickness: 22
      }];
      if (comparison) {
        datasets.unshift({
          label: 'Ciclo de referência',
          data: rows.map(r => r.previous),
          backgroundColor: '#cfc6dc',
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
              labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 12, weight: 600 }, color: '#524765' }
            },
            tooltip: {
              backgroundColor: '#1c142b',
              titleFont: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 13, weight: 700 },
              bodyFont: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 12 },
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
              ticks: { stepSize: 1, color: '#827796', font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 11 } },
              title: { display: true, text: 'Escala Likert (1 = Desfavorável a 5 = Favorável)', color: '#827796', font: { size: 11, weight: 600 } },
              grid: { color: '#eee8f4' }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#1c142b', font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 12, weight: 600 } }
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

    if (!window.Chart || !data.length) {
      const fallback = document.getElementById(`${canvasId}-fallback`);
      if (fallback) fallback.hidden = false;
      return;
    }

    const labels = data.map(d => d.cycle);
    const rates = data.map(d => d.rate);
    const targets = data.map(() => 70);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Taxa de Participação (%)',
            data: rates,
            borderColor: '#581c43',
            backgroundColor: 'rgba(88, 28, 67, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointBackgroundColor: '#581c43',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Meta Mínima (70%)',
            data: targets,
            borderColor: '#15803d',
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
            labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 11, weight: 600 } }
          },
          tooltip: {
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
            grid: { color: '#eee8f4' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600 } }
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

    if (!window.Chart || !factors.length) {
      const fallback = document.getElementById(`${canvasId}-fallback`);
      if (fallback) fallback.hidden = false;
      return;
    }

    const labels = factors.map(f => f.label);
    const data = factors.map(f => f.average);
    const bgColors = factors.map(f => (f.average < 2.8 ? '#b91c1c' : f.average < 3.6 ? '#b45309' : '#581c43'));

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
            callbacks: {
              label: c => `Média: ${Number(c.raw).toFixed(2)} / 5.00`
            }
          }
        },
        scales: {
          x: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: '#eee8f4' }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: 600 } }
          }
        }
      }
    });

    charts.set(canvas, chart);
  }

  // Gráfico 3: Eficácia das medidas
  function createActionEfficacyChart(canvasId, efficacy = { effective: 0, ineffective: 0, inProgress: 0 }) {
    const canvas = getCanvas(canvasId);
    if (!canvas) return;
    destroy(canvas);

    const total = (efficacy.effective || 0) + (efficacy.ineffective || 0) + (efficacy.inProgress || 0);

    if (!window.Chart || total === 0) {
      const fallback = document.getElementById(`${canvasId}-fallback`);
      if (fallback) fallback.hidden = false;
      return;
    }

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Eficazes', 'Não eficazes', 'Em andamento'],
        datasets: [{
          data: [efficacy.effective, efficacy.ineffective, efficacy.inProgress],
          backgroundColor: ['#15803d', '#b91c1c', '#7048b6'],
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
            labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 11, weight: 600 } }
          },
          tooltip: {
            callbacks: {
              label: c => {
                const count = c.raw;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return `${c.label}: ${count} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });

    charts.set(canvas, chart);
  }

  function mountOverviewCharts(todayData) {
    if (!todayData || !todayData.charts) return;
    if (todayData.charts.participationTrend && todayData.charts.participationTrend.length) {
      createParticipationTrendChart('chart-participation-trend', todayData.charts.participationTrend);
    }
    if (todayData.charts.factorRanking && todayData.charts.factorRanking.length) {
      createFactorBarChart('chart-factors-ranking', todayData.charts.factorRanking);
    }
    if (todayData.charts.efficacy && todayData.charts.efficacy.total > 0) {
      createActionEfficacyChart('chart-action-efficacy', todayData.charts.efficacy);
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
    mountOverviewCharts
  };
})();
