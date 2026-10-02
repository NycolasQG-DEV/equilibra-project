require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assessTrend } = require('../lib/product/trend.ts');
const series = values => values.map((value, i) => ({ value, date: new Date(Date.UTC(2025, 0, 1) + i * 30 * 86400000).toISOString() }));
test('não inventa previsão com histórico curto ou série estável', () => {
  assert.equal(assessTrend(series([10,20])).forecast, null);
  assert.equal(assessTrend(series(Array(12).fill(20))).forecast, null);
});
test('projeção de tendência passa pelo teste temporal contra último valor', () => {
  const result = assessTrend(series(Array.from({ length:12 }, (_,i) => 10 + i * 2)));
  assert.equal(result.forecast.value, 34);
  assert.equal(result.forecast.tests, 6);
  assert.ok(result.forecast.mae < result.forecast.baselineMae);
});
test('periodicidade irregular bloqueia previsão', () => {
  const points = series(Array.from({ length:12 }, (_,i) => i));
  points[11].date = '2028-01-01';
  assert.equal(assessTrend(points).forecast, null);
});
