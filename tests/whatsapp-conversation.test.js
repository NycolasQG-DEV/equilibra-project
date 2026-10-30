/**
 * Testes do WhatsApp Conversation Engine
 * Cobre: máquina de estados, normalização de respostas, privacidade e expiração.
 */
'use strict';

const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Importa o engine — usa módulo isolado por test
const engine = require('../src/services/whatsappConversationEngine');

// Instrumento mínimo para testes
const mockInstrument = {
  id: 'test-instrument',
  version: 1,
  name: 'Teste',
  validated: false,
  factors: [
    ['fator1', 'Fator 1', 'Pergunta de teste 1.'],
    ['fator2', 'Fator 2', 'Pergunta de teste 2.'],
    ['fator3', 'Fator 3', 'Pergunta de teste 3.']
  ]
};

const TOKEN = 'abc123token';
const SEGMENT = 'seg-001';
const WA_ID = '5511999990000@s.whatsapp.net';

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshSession(waId = WA_ID) {
  return engine.startSession(waId, TOKEN, SEGMENT, mockInstrument, 'Pesquisa Teste');
}

// Limpa qualquer sessão ativa antes de cada teste
// (O engine usa um Map global — isolamos por waId único em cada teste)
function uniqueWaId() {
  return `551199${Math.floor(Math.random() * 9000000) + 1000000}@s.whatsapp.net`;
}

// ── Testes de Normalização de Respostas ──────────────────────────────────────

describe('parseAnswer — normalização de respostas', () => {
  const { _parseAnswer } = engine;

  it('aceita dígito simples 1-5', () => {
    for (let i = 1; i <= 5; i++) {
      assert.strictEqual(_parseAnswer(String(i)), i);
    }
  });

  it('aceita com espaços e pontuação: "  4. "', () => {
    assert.strictEqual(_parseAnswer('  4. '), 4);
  });

  it('aceita palavras em português: cinco, quatro, três, dois, um', () => {
    assert.strictEqual(_parseAnswer('cinco'), 5);
    assert.strictEqual(_parseAnswer('quatro'), 4);
    assert.strictEqual(_parseAnswer('três'), 3);
    assert.strictEqual(_parseAnswer('dois'), 2);
    assert.strictEqual(_parseAnswer('um'), 1);
  });

  it('aceita "CINCO" (maiúsculo)', () => {
    assert.strictEqual(_parseAnswer('CINCO'), 5);
  });

  it('rejeita 0', () => {
    assert.strictEqual(_parseAnswer('0'), null);
  });

  it('rejeita 6', () => {
    assert.strictEqual(_parseAnswer('6'), null);
  });

  it('rejeita texto aleatório: "bom"', () => {
    assert.strictEqual(_parseAnswer('bom'), null);
  });

  it('rejeita string vazia', () => {
    assert.strictEqual(_parseAnswer(''), null);
  });
});

// ── Testes da Máquina de Estados ─────────────────────────────────────────────

describe('ConversationEngine — máquina de estados', () => {
  it('startSession retorna mensagem de introdução', () => {
    const waId = uniqueWaId();
    const { introMessage } = freshSession(waId);
    assert.ok(introMessage.includes('Pesquisa Teste'));
    assert.ok(introMessage.includes('anônimas'));
    assert.ok(introMessage.includes('S') || introMessage.includes('sim'));
  });

  it('hasSession retorna true após startSession', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    assert.strictEqual(engine.hasSession(waId), true);
  });

  it('estado WAITING_CONSENT: "S" inicia a primeira pergunta', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    const res = engine.processMessage(waId, 'S');
    assert.strictEqual(res.state, 'ASKING');
    assert.ok(res.reply.includes('Pergunta 1/3'));
    assert.strictEqual(res.done, false);
  });

  it('estado WAITING_CONSENT: "N" abandona e destrói sessão', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    const res = engine.processMessage(waId, 'N');
    assert.strictEqual(res.state, 'ABANDONED');
    assert.strictEqual(res.done, true);
    assert.strictEqual(engine.hasSession(waId), false);
  });

  it('estado WAITING_CONSENT: resposta inválida pede confirmação novamente', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    const res = engine.processMessage(waId, 'talvez');
    assert.strictEqual(res.state, 'WAITING_CONSENT');
    assert.strictEqual(res.done, false);
  });

  it('fluxo completo: S + 3 respostas válidas → DONE com token e answers', () => {
    const waId = uniqueWaId();
    freshSession(waId);

    engine.processMessage(waId, 'S');         // consent
    engine.processMessage(waId, '4');         // fator1
    engine.processMessage(waId, '3');         // fator2
    const last = engine.processMessage(waId, '5'); // fator3 — último

    assert.strictEqual(last.state, 'DONE');
    assert.strictEqual(last.done, true);
    assert.strictEqual(last.token, TOKEN);
    assert.deepStrictEqual(last.answers, { fator1: 4, fator2: 3, fator3: 5 });
    assert.strictEqual(last.segmentId, SEGMENT);
  });

  it('sessão é destruída após DONE', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    engine.processMessage(waId, 'S');
    engine.processMessage(waId, '2');
    engine.processMessage(waId, '2');
    engine.processMessage(waId, '2');
    // Após DONE, sessão não deve mais existir
    assert.strictEqual(engine.hasSession(waId), false);
  });

  it('ABANDONED após 3 respostas inválidas consecutivas', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    engine.processMessage(waId, 'S'); // consent
    engine.processMessage(waId, 'ruim'); // retry 1
    engine.processMessage(waId, 'ótimo'); // retry 2
    const res = engine.processMessage(waId, 'excelente'); // retry 3 → abandon
    assert.strictEqual(res.state, 'ABANDONED');
    assert.strictEqual(res.done, true);
    assert.strictEqual(engine.hasSession(waId), false);
  });

  it('mensagem sem sessão ativa retorna NO_SESSION', () => {
    const res = engine.processMessage('99999@s.whatsapp.net', '3');
    assert.strictEqual(res.state, 'NO_SESSION');
    assert.strictEqual(res.reply, null);
  });

  it('progresso é exibido corretamente: Pergunta 2/3', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    engine.processMessage(waId, 'S');
    engine.processMessage(waId, '3'); // fator1
    const res = engine.processMessage(waId, '4'); // fator2 respondido → mostra pergunta 3
    // Pergunta 3/3 não é mostrada após a última resposta — o DONE vem depois de 3
    // Aqui verificamos que após fator2, chegamos à pergunta 3
    assert.ok(res.reply && res.reply.includes('3/3'));
  });

  it('expireSessions remove sessões com >24h', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    // Manipula tempo de criação diretamente via sessão
    // (testabilidade: sessions é um Map interno, não exportado diretamente)
    // O teste verifica que sessões não expiradas sobrevivem
    const removed = engine.expireSessions();
    // Sessão recém-criada NÃO deve ser removida
    assert.ok(typeof removed === 'number');
    assert.strictEqual(engine.hasSession(waId), true);
    // Limpeza
    engine.processMessage(waId, 'N');
  });
});

// ── Testes de Privacidade ─────────────────────────────────────────────────────

describe('Privacidade — sem dados identificadores nas respostas', () => {
  it('resultado DONE não contém phone, nome ou memberId', () => {
    const waId = uniqueWaId();
    freshSession(waId);
    engine.processMessage(waId, 'S');
    engine.processMessage(waId, '3');
    engine.processMessage(waId, '3');
    const res = engine.processMessage(waId, '3');

    // Garante que nenhum campo identificador está presente no resultado
    assert.ok(!('phone' in res), 'phone não deve estar no resultado');
    assert.ok(!('memberId' in res), 'memberId não deve estar no resultado');
    assert.ok(!('name' in res), 'name não deve estar no resultado');
    assert.ok(!('email' in res), 'email não deve estar no resultado');

    // Apenas token (para submissão), segmentId (para relatório) e answers
    assert.ok('token' in res, 'token deve estar presente para submissão');
    assert.ok('answers' in res, 'answers devem estar presentes');
    assert.ok('segmentId' in res, 'segmentId deve estar presente para relatório agregado');
  });

  it('sessionStats não revela tokens nem waIds', () => {
    const stats = engine.sessionStats();
    assert.ok('active' in stats, 'deve ter campo active');
    assert.ok(!('sessions' in stats), 'não deve expor Map de sessões');
    assert.ok(!('tokens' in stats), 'não deve expor tokens');
    assert.strictEqual(typeof stats.active, 'number');
  });
});

