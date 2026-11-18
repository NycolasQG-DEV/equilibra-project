const test = require("node:test");
const assert = require("node:assert/strict");
const { TEMPLATES, REFERENCES } = require("../src/domain/surveyCatalog");

test("EQ-004: Governança dos instrumentos psicossociais e metadados metodológicos", () => {
  assert.ok(Array.isArray(TEMPLATES), "TEMPLATES deve ser uma lista");
  assert.equal(TEMPLATES.length, 9, "Devem existir 9 templates próprios de triagem exploratória");

  for (const t of TEMPLATES) {
    assert.ok(t.id, "Todo instrumento deve ter id");
    assert.ok(t.name, "Todo instrumento deve ter nome");
    assert.ok(t.version, "Todo instrumento deve ter versão");
    assert.ok(t.author, "Todo instrumento deve ter autoria identificada");
    assert.ok(t.methodologicalStatus, "Todo instrumento deve declarar status metodológico");
    assert.ok(t.usageRights, "Todo instrumento deve declarar direitos de uso");
    assert.ok(t.scoringMethod, "Todo instrumento deve declarar método de pontuação");
    assert.ok(t.limitation, "Todo instrumento deve declarar limitações conhecidas");
    assert.ok(t.population, "Todo instrumento deve declarar população-alvo");
    assert.equal(t.minimumResponses, 5, "Quórum mínimo de supressão deve ser 5");

    // Roteiros próprios de triagem são exploratórios e NÃO devem alegar validação psicométrica formal
    assert.equal(
      t.validated,
      false,
      `Template próprio ${t.id} não deve declarar validated=true sem estudo psicométrico publicado`,
    );
    assert.equal(
      t.methodologicalStatus,
      "exploratorio",
      `Template próprio ${t.id} deve ter status 'exploratorio'`,
    );

    assert.ok(Array.isArray(t.factors) && t.factors.length > 0, "Deve ter fatores definidos");
    for (const [key, label, prompt] of t.factors) {
      assert.ok(key, "Fator deve ter chave");
      assert.ok(label, "Fator deve ter rótulo");
      assert.ok(prompt, "Fator deve ter enunciado");
    }
  }

  assert.ok(Array.isArray(REFERENCES), "REFERENCES deve ser uma lista");
  assert.ok(REFERENCES.length >= 10, "Devem existir ao menos 10 instrumentos de referência catalogados");

  for (const ref of REFERENCES) {
    assert.ok(ref.id, "Referência deve ter id");
    assert.ok(ref.name, "Referência deve ter nome");
    assert.equal(ref.available, false, "Instrumentos de referência não habilitados devem ter available=false");
    assert.ok(ref.limitation, "Referência deve ter limitações e condições de aplicação documentadas");
    assert.ok(ref.sources?.length, "Referência deve ter link de fonte");
  }
});
