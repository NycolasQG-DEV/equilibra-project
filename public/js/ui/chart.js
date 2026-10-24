/* Chart UI component wrapping Chart.js lifecycle and accessible fallbacks */

export function renderChart({ canvas, type, data, options = {} }) {
  if (!window.Chart || !canvas) return null;

  if (window.DashboardCharts) {
    window.DashboardCharts.destroy(canvas);
  }

  const chart = new window.Chart(canvas, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options
    }
  });

  return chart;
}

export function destroyChart(canvas) {
  if (window.DashboardCharts) {
    window.DashboardCharts.destroy(canvas);
  }
}

export const DashboardCharts = window.DashboardCharts;
