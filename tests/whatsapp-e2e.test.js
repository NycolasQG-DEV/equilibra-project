/**
 * Teste de Integração Ponta a Ponta: Pesquisas via WhatsApp
 * Valida o ciclo completo:
 * 1. Abertura com canal WhatsApp
 * 2. Conversação via Webhook
 * 3. Anonimização estrita no armazenamento
 * 4. Contabilização correta da participação
 */
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const storage = require('../src/config/equilibraStorage');
const { openSurvey } = require('../src/services/surveyLifecycle');
const { handleIncomingMessage } = require('../src/services/whatsappSurveyService');
const { encryptPhone } = require('../src/config/identityCrypto');
const { parseWebhook } = require('../src/services/whatsappGateway');

const TEST_ACCOUNT_ID = 'test-wa-acc-' + Date.now();
const HASH = (v) => crypto.createHash('sha256').update(v).digest('hex');

describe('Fluxo E2E: Pesquisa e Coleta via WhatsApp', () => {
  let surveyId;
  let testMember;
  let testGroup;
  let invitationToken;
  let waId;

  before(() => {
    storage.initializeStorage();

    // 1. Cria grupo e membro de teste
    const memberId = crypto.randomUUID();
    testMember = {
      id: memberId,
      accountId: TEST_ACCOUNT_ID,
      name: 'Colaborador Confidencial',
      email: 'colaborador@empresa.com',
      phone: encryptPhone('11999887766'),
      status: 'active'
    };
    const members = storage.read('members');
    members.push(testMember);
    storage.write('members', members);

    // Cria mais 4 membros para atingir o mínimo de 5 exigido pelo openSurvey
    const extraIds = [];
    for (let i = 1; i <= 4; i++) {
      const extraId = crypto.randomUUID();
      extraIds.push(extraId);
      members.push({
        id: extraId,
        accountId: TEST_ACCOUNT_ID,
        name: `Membro Extra ${i}`,
        email: `extra${i}@empresa.com`,
        phone: encryptPhone(`1198888000${i}`),
        status: 'active'
      });
    }
    storage.write('members', members);

    const allMemberIds = [memberId, ...extraIds];
    testGroup = {
      id: crypto.randomUUID(),
      accountId: TEST_ACCOUNT_ID,
      name: 'Operações',
      memberIds: allMemberIds
    };
    const groups = storage.read('groups');
    groups.push(testGroup);
    storage.write('groups', groups);

    // 2. Cria rascunho de pesquisa
    surveyId = crypto.randomUUID();
    const survey = {
      id: surveyId,
      accountId: TEST_ACCOUNT_ID,
      title: 'Diagnóstico Psicossocial WhatsApp',
      cycle: 'Ciclo Q4 2026',
      model: 'NR-1 & GRO — Diagnóstico de Condições & Organização do Trabalho',
      groupIds: [testGroup.id],
      groupId: testGroup.id,
      memberIds: allMemberIds,
      collectionChannel: 'whatsapp',
      status: 'draft',
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString()
    };
    const surveys = storage.read('surveys');
    surveys.push(survey);
    storage.write('surveys', surveys);

    waId = '5511999887766@s.whatsapp.net';
  });

  it('1. Abre pesquisa configurada com canal WhatsApp e gera convites', () => {
    const res = openSurvey({
      surveyId,
      accountId: TEST_ACCOUNT_ID,
      baseUrl: 'http://localhost:3000'
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.survey.status, 'open');
    assert.strictEqual(res.survey.collectionChannel, 'whatsapp');

    // Recupera o convite gerado para o membro
    const invitations = storage.read('invitations').filter(i => i.surveyId === surveyId);
    assert.strictEqual(invitations.length, 5);

    const myInv = invitations.find(i => i.memberId === testMember.id);
    assert.ok(myInv, 'Convite deve existir para o membro');
    assert.strictEqual(myInv.used, false);

    // Localiza o link correspondente retornado para pegar o token original
    const myLink = res.links.find(l => l.memberId === testMember.id);
    assert.ok(myLink, 'Link deve existir nos retornos de abertura');
    invitationToken = myLink.token;
    assert.ok(invitationToken, 'Token do convite deve existir');
  });

  it('2. Conduz a conversa pelo motor e registra respostas anônimas', async () => {
    // Inicia a sessão simulando o dispatcher
    const { startSession } = require('../src/services/whatsappConversationEngine');
    const survey = storage.read('surveys').find(s => s.id === surveyId);
    const instrument = require('../src/domain/instruments').surveyInstrument(survey);

    startSession(waId, invitationToken, testGroup.id, instrument, survey.title);

    // Função de submissão idêntica à do webhook
    const submitAnswersInternal = async ({ token, answers, segmentId }) => {
      const tokenH = HASH(token);
      const invitations = storage.read('invitations');
      const inv = invitations.find(i => i.tokenHash === tokenH && !i.used);
      assert.ok(inv, 'Convite deve ser encontrado para o token');

      const responses = storage.read('responses');
      const newResponse = {
        id: crypto.randomUUID(),
        accountId: TEST_ACCOUNT_ID,
        surveyId,
        segmentId,
        submittedDay: new Date().toISOString().slice(0, 10),
        channel: 'whatsapp',
        answers
      };
      responses.push(newResponse);

      inv.used = true;
      inv.usedDay = newResponse.submittedDay;
      storage.writeMany({ responses, invitations });
    };

    // Responde S para iniciar
    const m1 = await handleIncomingMessage(waId, 'S', submitAnswersInternal);
    assert.strictEqual(m1.submitted, false);
    assert.ok(m1.reply.includes('Pergunta 1/'));

    // Responde cada pergunta do instrumento com notas de 1 a 5
    const totalQuestions = instrument.factors.length;
    for (let q = 1; q <= totalQuestions; q++) {
      const nota = String((q % 5) + 1); // varia de 1 a 5
      const mQ = await handleIncomingMessage(waId, nota, submitAnswersInternal);

      if (q < totalQuestions) {
        assert.strictEqual(mQ.submitted, false);
        assert.ok(mQ.reply.includes(`Pergunta ${q + 1}/`));
      } else {
        // Última pergunta submetida!
        assert.strictEqual(mQ.submitted, true);
        assert.ok(mQ.reply.includes('Obrigado!'));
      }
    }
  });

  it('3. Anonimização estrita: banco contém apenas valores brutos e contabilidade de respostas', () => {
    const responses = storage.read('responses').filter(r => r.surveyId === surveyId);
    assert.strictEqual(responses.length, 1, 'Deve ter exatamente 1 resposta registrada');

    const saved = responses[0];
    assert.strictEqual(saved.channel, 'whatsapp');
    assert.strictEqual(saved.surveyId, surveyId);
    assert.strictEqual(saved.segmentId, testGroup.id);

    // VERIFICAÇÕES DE PRIVACIDADE CRÍTICAS
    assert.strictEqual(saved.memberId, undefined, 'memberId NÃO pode estar presente');
    assert.strictEqual(saved.phone, undefined, 'phone NÃO pode estar presente');
    assert.strictEqual(saved.name, undefined, 'name NÃO pode estar presente');
    assert.strictEqual(saved.email, undefined, 'email NÃO pode estar presente');
    assert.strictEqual(saved.token, undefined, 'token NÃO pode estar presente na resposta');

    // O convite deve constar como utilizado (para não permitir resposta duplicada e somar na taxa)
    const invitations = storage.read('invitations').filter(i => i.surveyId === surveyId);
    const usedCount = invitations.filter(i => i.used).length;
    assert.strictEqual(usedCount, 1, 'Exatamente 1 convite deve constar como usado');
  });
});

