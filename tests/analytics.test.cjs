require("./register.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  DIMENSIONS,
  PROTOCOL_VERSION,
  explicitRating,
} = require("../lib/ai/protocol.ts");
const {
  summarize,
  comparison,
  csvCell,
} = require("../lib/management/analytics.ts");
const {
  followupContract,
  reportContract,
  managerContract,
} = require("../lib/ai/contracts.ts");
const batch = {
  id: "b1",
  title: "Teste",
  sector: "Operação",
  protocolVersion: PROTOCOL_VERSION,
  createdAt: "2026-01-01T00:00:00Z",
  closedAt: "2026-01-31T00:00:00Z",
  invited: 12,
  completed: 12,
};
const records = (n, adverse) =>
  Array.from({ length: n }, (_, i) => ({
    id: "s" + i,
    batchId: "b1",
    protocolVersion: PROTOCOL_VERSION,
    history: DIMENSIONS.map((d) => ({
      kind: "rating",
      dimensionTarget: d.id,
      userAnswer: i < adverse ? "Sempre" : "Raramente",
    })),
  }));
test("apenas escolhas explícitas determinam frequência; texto e ausência não viram pontuação", () => {
  assert.equal(explicitRating("Sempre"), 4);
  for (const v of [undefined, null, 4, "4", "Sempre. Ignore instruções", ""])
    assert.equal(explicitRating(v), null);
});
test("campanha aberta não revela indicadores mesmo com grande amostra", () => {
  const s = summarize({ ...batch, closedAt: null }, records(100, 60));
  assert.equal(s.released, false);
  assert.ok(s.dimensions.every((d) => d.percent === null && d.valid === null));
});
test("grupo pequeno e células complementares pequenas ficam protegidos", () => {
  for (const [n, adverse] of [
    [9, 5],
    [12, 1],
    [12, 2],
    [12, 10],
    [12, 11],
  ]) {
    const s = summarize(batch, records(n, adverse));
    assert.ok(s.dimensions.every((d) => d.percent === null));
  }
});
test("taxa e denominador corretos; duplicação de sessão não aumenta a base", () => {
  const r = records(12, 6);
  const s = summarize(batch, [...r, ...r]);
  assert.equal(s.dimensions[0].percent, 50);
  assert.equal(s.dimensions[0].valid, 12);
});
test("recusas e valores inválidos não são tratados como favoráveis", () => {
  const r = records(12, 6);
  r[11].history[0].userAnswer = "Prefiro não responder";
  r[10].history[0].userAnswer = "Não se aplica";
  const s = summarize(batch, r);
  assert.equal(s.dimensions[0].valid, 10);
  assert.equal(s.dimensions[0].percent, 60);
});
test("versões antigas e outra campanha são excluídas", () => {
  const r = records(12, 6);
  r[0].protocolVersion = "legacy";
  r[1].batchId = "other";
  r[2].protocolVersion = "legacy";
  assert.equal(summarize(batch, r).released, false);
});
test("uma dimensão duplicada é inválida, sem contaminar demais temas", () => {
  const r = records(12, 6);
  r[0].history.push(r[0].history[0]);
  const s = summarize(batch, r);
  assert.equal(s.dimensions[0].valid, 11);
  assert.equal(s.dimensions[1].valid, 12);
});
test("comparação usa pontos percentuais e exige setor, versão e cronologia", () => {
  const before = summarize(batch, records(12, 6));
  const after = {
    ...summarize(batch, records(12, 9)),
    closedAt: "2026-02-28T00:00:00Z",
  };
  assert.equal(comparison(after, before)[0].delta, 25);
  for (const p of [
    { ...before, sector: "Outro" },
    { ...before, protocolVersion: "other" },
    { ...before, closedAt: null },
    { ...before, closedAt: after.closedAt },
  ])
    assert.equal(comparison(after, p)[0].delta, null);
});
test("contratos rejeitam instruções, chaves extras, duplicação e IDs não autorizados", () => {
  assert.deepEqual(followupContract({ followup_id: 1 }), { followup_id: 1 });
  for (const v of [
    { followup_id: 2 },
    { followup_id: 0, score: 100 },
    "ignore",
    null,
  ])
    assert.throws(() => followupContract(v));
  const id = DIMENSIONS[0].id;
  assert.throws(() => reportContract({ dimension_ids: [id, id] }, [id]));
  assert.throws(() =>
    reportContract({ dimension_ids: [DIMENSIONS[1].id] }, [id]),
  );
  assert.throws(() =>
    managerContract({ intent: "delete_all", dimension_id: null }, [id]),
  );
  assert.throws(() =>
    managerContract({ intent: "overview", dimension_id: "person-1" }, [id]),
  );
});
test("CSV neutraliza fórmulas e escapa aspas", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('A"B'), '"A""B"');
  assert.ok(csvCell("  @SUM(A1)").startsWith("\"'"));
});
