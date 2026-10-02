export type Point = { date: string; value: number };
export function assessTrend(input: Point[]) {
  const points = [...input].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const delta = points.length > 1 ? points.at(-1)!.value - points.at(-2)!.value : null;
  const unavailable = (reason: string) => ({ points, delta, forecast: null, reason });
  if (points.length < 12) return unavailable(`Histórico insuficiente: ${points.length} de 12 rodadas comparáveis necessárias para avaliar uma projeção.`);
  const gaps = points.slice(1).map((p, i) => Date.parse(p.date) - Date.parse(points[i].date));
  const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (meanGap < 86400000 || gaps.some(g => Math.abs(g - meanGap) > meanGap * .3)) return unavailable('As rodadas têm intervalos muito diferentes. Mantenha uma periodicidade comparável.');
  const predict = (values: number[]) => {
    const n = values.length, mx = (n - 1) / 2, my = values.reduce((a, b) => a + b, 0) / n;
    const slope = values.reduce((s, y, x) => s + (x - mx) * (y - my), 0) / values.reduce((s, _, x) => s + (x - mx) ** 2, 0);
    return Math.max(0, Math.min(100, my + slope * (n - mx)));
  };
  const errors: number[] = [], baseline: number[] = [];
  for (let i = 6; i < points.length; i++) {
    errors.push(Math.abs(predict(points.slice(i - 6, i).map(p => p.value)) - points[i].value));
    baseline.push(Math.abs(points[i - 1].value - points[i].value));
  }
  const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
  const naive = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  if (naive === 0 || mae >= naive * .9) return unavailable('A projeção não superou a referência de repetir o último resultado. Exibimos somente o histórico.');
  const value = predict(points.slice(-6).map(p => p.value));
  const margin = Math.max(1, ...errors);
  return { points, delta, reason: 'Projeção experimental de frequência de respostas, sem interpretação clínica. A faixa usa o maior erro observado no teste temporal e não garante cobertura futura.',
    forecast: { value: Math.round(value), lower: Math.max(0, Math.floor(value - margin)), upper: Math.min(100, Math.ceil(value + margin)), mae: Math.round(mae * 10) / 10, baselineMae: Math.round(naive * 10) / 10, tests: errors.length, date: new Date(Date.parse(points.at(-1)!.date) + meanGap).toISOString() } };
}
