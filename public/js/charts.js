window.DashboardCharts = (() => {
  const charts = new Map();
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function markup(rows, comparison = false) {
    return `<div class="dashboard-chart" data-chart="${escape(JSON.stringify({rows, comparison}))}"><canvas role="img" aria-label="${comparison ? 'Comparação descritiva entre ciclos' : 'Percepção por fator'}: escala de 1 a 5. Valores numéricos disponíveis abaixo."></canvas></div>`;
  }
  function mount() {
    for (const [canvas, chart] of charts) if (!canvas.isConnected) { chart.destroy(); charts.delete(canvas); }
    if (!window.Chart) return;
    document.querySelectorAll('[data-chart]').forEach((container) => {
      const canvas = container.querySelector('canvas');
      if (charts.has(canvas)) return;
      const { rows, comparison } = JSON.parse(container.dataset.chart);
      if (!rows.length) return;
      container.style.height = `${Math.max(280, rows.length * (comparison ? 57 : 39))}px`;
      const datasets = [{ label: comparison ? 'Ciclo atual' : 'Percepção', data: rows.map(r => r.average), backgroundColor: '#32745b', borderRadius: 5, maxBarThickness: 22 }];
      if (comparison) datasets.unshift({ label: 'Ciclo de referência', data: rows.map(r => r.previous), backgroundColor: '#a5b9c9', borderRadius: 5, maxBarThickness: 22 });
      charts.set(canvas, new Chart(canvas, { type: 'bar', data: {labels: rows.map(r => r.label), datasets}, options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : {duration: 250},
        plugins: {legend: {display: comparison, position: 'bottom'}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${Number(c.raw).toLocaleString('pt-BR')} / 5`}}},
        scales: {x: {min: 1, max: 5, ticks: {stepSize: 1}, title: {display: true, text: 'Escala de percepção (1 a 5)'}, grid: {color: '#e9ede9'}}, y: {grid: {display: false}, ticks: {color: '#36483e', font: {size: 12}}}}
      }}));
    });
  }
  let scheduled = false;
  const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => {scheduled = false; mount();}); } });
  document.addEventListener('DOMContentLoaded', () => { observer.observe(document.body, {childList: true, subtree: true}); mount(); });
  window.addEventListener('beforeprint', () => charts.forEach(chart => chart.resize()));
  window.addEventListener('afterprint', () => charts.forEach(chart => chart.resize()));
  return {markup};
})();
