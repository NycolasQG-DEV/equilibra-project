const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MAYA_PERSONA,
  buildPersonaIntro,
  parseQuickScore,
  generateFallbackResponse,
  processPersonaTurn
} = require('../src/services/whatsappPersona.js');

describe('whatsappPersona — Motor de Conversação e Persona Maya', () => {
  it('MAYA_PERSONA contém propriedades fundamentais configuradas', () => {
    assert.strictEqual(MAYA_PERSONA.name, 'Maya');
    assert.ok(MAYA_PERSONA.role.includes('Escuta'));
    assert.strictEqual(MAYA_PERSONA.maxBubblesPerTurn, 2);
    assert.ok(MAYA_PERSONA.minTypingDelayMs >= 500);
  });

  it('buildPersonaIntro retorna exatamente 2 bolhas humanizadas', () => {
    const bubbles = buildPersonaIntro('Pesquisa de Clima Q1', {
      factors: [
        ['fator1', 'Carga de trabalho', 'Como você avalia a carga?']
      ]
    });

    assert.ok(Array.isArray(bubbles));
    assert.strictEqual(bubbles.length, 2);
    assert.ok(bubbles[0].includes('Maya'));
    assert.ok(bubbles[1].includes('Pesquisa de Clima Q1'));
    assert.ok(bubbles[1].includes('anônimas') || bubbles[1].includes('confidencial'));
    assert.ok(bubbles[1].includes('Podemos começar?'));
  });

  describe('parseQuickScore', () => {
    it('extrai notas numéricas diretas de 1 a 5', () => {
      assert.strictEqual(parseQuickScore('1'), 1);
      assert.strictEqual(parseQuickScore('3'), 3);
      assert.strictEqual(parseQuickScore('5'), 5);
      assert.strictEqual(parseQuickScore('  4  '), 4);
    });

    it('extrai números por extenso', () => {
      assert.strictEqual(parseQuickScore('nota cinco'), 5);
      assert.strictEqual(parseQuickScore('quatro'), 4);
      assert.strictEqual(parseQuickScore('Acho que três'), 3);
      assert.strictEqual(parseQuickScore('dois'), 2);
      assert.strictEqual(parseQuickScore('um'), 1);
    });

    it('extrai nota embutida em frase explicativa', () => {
      assert.strictEqual(parseQuickScore('Foi bem puxado essa semana, daria nota 2'), 2);
      assert.strictEqual(parseQuickScore('4/5 com certeza'), 4);
    });

    it('rejeita valores fora da faixa ou sem nota clara', () => {
      assert.strictEqual(parseQuickScore('0'), null);
      assert.strictEqual(parseQuickScore('6'), null);
      assert.strictEqual(parseQuickScore('não sei dizer'), null);
      assert.strictEqual(parseQuickScore(''), null);
    });
  });

  describe('generateFallbackResponse', () => {
    const sampleSession = {
      questionIndex: 0,
      instrument: {
        factors: [
          ['fator1', 'Carga de trabalho', 'Como você avalia o volume de trabalho?'],
          ['fator2', 'Suporte da liderança', 'Como avalia o apoio da sua chefia?']
        ]
      },
      answers: {}
    };

    it('avança para o próximo fator quando o usuário fornece uma nota válida', () => {
      const res = generateFallbackResponse(sampleSession, '4');
      assert.strictEqual(res.extractedScore, 4);
      assert.ok(res.messages.length > 0 && res.messages.length <= 2);
      assert.ok(res.messages.some(m => m.includes('Suporte da liderança')));
      assert.strictEqual(res.done, false);
    });

    it('solicita a nota de 1 a 5 quando o usuário manda apenas mensagem sem nota', () => {
      const res = generateFallbackResponse(sampleSession, 'olá, como assim?');
      assert.strictEqual(res.extractedScore, null);
      assert.ok(res.messages.some(m => m.includes('1 a 5')));
      assert.strictEqual(res.done, false);
    });

    it('marca done=true e agradece quando é a última pergunta', () => {
      const lastFactorSession = {
        questionIndex: 1,
        instrument: {
          factors: [
            ['fator1', 'Carga de trabalho', 'Como avalia o volume?'],
            ['fator2', 'Suporte da liderança', 'Como avalia o apoio?']
          ]
        },
        answers: { fator1: 4 }
      };

      const res = generateFallbackResponse(lastFactorSession, '5');
      assert.strictEqual(res.extractedScore, 5);
      assert.strictEqual(res.done, true);
      assert.ok(res.messages.some(m => m.includes('Obrigado!')));
    });
  });

  describe('processPersonaTurn', () => {
    it('executa com segurança acionando fallback quando sem Groq API key', async () => {
      const session = {
        questionIndex: 0,
        instrument: {
          factors: [
            ['f1', 'Autonomia', 'Você tem liberdade no seu trabalho?']
          ]
        },
        answers: {},
        history: []
      };

      const turn = await processPersonaTurn(session, '3');
      assert.strictEqual(turn.extractedScore, 3);
      assert.strictEqual(turn.done, true);
      assert.ok(session.history.length >= 2);
    });
  });
});
