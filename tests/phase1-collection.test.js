const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase1-'));
process.env.EQUILIBRA_DATA_DIR = directory;
const app = require('../src/server');
const storage = require('../src/config/equilibraStorage');
const {
  openSurvey,
  reissueLinks,
  getParticipation,
  extendSurvey,
  closeSurvey,
  closeExpiredSurveys,
  getBand
} = require('../src/services/surveyLifecycle');
const { migrateCollection } = require('../src/services/dataMigration');
const { setupTestCompany } = require('./helpers/syntheticCompany');

test('Fase 1.1: Migração pura e idempotente para o modelo de segmentos', () => {
  const legacyData = {
    surveys: [
      { id: 's1', accountId: 'acc1', title: 'Legado 1', memberIds: ['m1', 'm2'] }
    ],
    invitations: [
      { id: 'i1', accountId: 'acc1', surveyId: 's1', tokenHash: 'th1', usedAt: '2026-01-15T14:32:10.123Z' },
      { id: 'i2', accountId: 'acc1', surveyId: 's1', tokenHash: 'th2', usedAt: null }
    ],
    responses: [
      { id: 'r1', accountId: 'acc1', surveyId: 's1', memberId: 'm1', ip: '127.0.0.1', userAgent: 'Mozilla/5.0', answers: { demandas: 4 } }
    ]
  };

  // Primeira execução
  const firstRun = migrateCollection(legacyData);
  assert.equal(firstRun.changed, true);

  const migrated = firstRun.data;
  assert.equal(migrated.surveys[0].participationTarget, 0.70);
  assert.equal(migrated.surveys[0].segments, null);

  // Convite usado: usedAt removido, vira used: true + usedDay: '2026-01-15'
  assert.equal(migrated.invitations[0].used, true);
  assert.equal(migrated.invitations[0].usedDay, '2026-01-15');
  assert.equal(migrated.invitations[0].usedAt, undefined);
  assert.equal(migrated.invitations[0].segmentId, null);

  // Convite não usado
  assert.equal(migrated.invitations[1].used, false);
  assert.equal(migrated.invitations[1].usedDay, null);
  assert.equal(migrated.invitations[1].usedAt, undefined);

  // Resposta: campos proibidos removidos, segmentId e submittedDay adicionados
  assert.equal(migrated.responses[0].segmentId, null);
  assert.equal(migrated.responses[0].submittedDay, null);
  assert.equal(migrated.responses[0].memberId, undefined);
  assert.equal(migrated.responses[0].ip, undefined);
  assert.equal(migrated.responses[0].userAgent, undefined);

  // Segunda execução sobre os dados migrados (idempotência)
  const secondRun = migrateCollection(migrated);
  assert.equal(secondRun.changed, false, 'Segunda execução não deve alterar dados');
});

test('Fase 1.2: Faixas de participação getBand', () => {
  assert.equal(getBand(0.15), '<30%');
  assert.equal(getBand(0.29), '<30%');
  assert.equal(getBand(0.30), '30–50%');
  assert.equal(getBand(0.49), '30–50%');
  assert.equal(getBand(0.50), '50–70%');
  assert.equal(getBand(0.69), '50–70%');
  assert.equal(getBand(0.70), '≥70%');
  assert.equal(getBand(0.95), '≥70%');
});

test('Fase 1.3: Ciclo de vida da pesquisa (surveyLifecycle) e acompanhamento por segmento', () => {
  const seed = setupTestCompany(directory);
  const accountId = seed.account.id;

    // 1. Validar survey draft para abertura (fechando o s2 antes para não ter conflito de público)
    const allSurveys = storage.read('surveys');
    for (const s of allSurveys) {
      if (s.status === 'open') s.status = 'closed';
    }
    storage.write('surveys', allSurveys);

    const draftSurvey = seed.surveys.find(s => s.status === 'draft');
    assert.ok(draftSurvey);

    const openResult = openSurvey({
      surveyId: draftSurvey.id,
      accountId,
      baseUrl: 'http://localhost:3000'
    });
    assert.equal(openResult.ok, true);
    assert.ok(openResult.links.length >= 25);
    assert.ok(openResult.links[0].token);
    assert.ok(openResult.links[0].link.includes('/responder/'));
    assert.ok(openResult.links[0].segmentId);

    // Snapshot de segmentos gravado no survey
    const savedSurvey = storage.read('surveys').find(s => s.id === draftSurvey.id);
    assert.equal(savedSurvey.status, 'open');
    assert.ok(Array.isArray(savedSurvey.segments));
    assert.equal(savedSurvey.participationTarget, 0.70);

    // 2. Acompanhamento de participação inicial (0 respostas)
    const partInitial = getParticipation({ surveyId: draftSurvey.id, accountId });
    assert.equal(partInitial.ok, true);
    assert.equal(partInitial.total.invited, savedSurvey.memberIds.length);
    assert.equal(partInitial.total.responded, 0);
    assert.equal(partInitial.total.rate, 0);
    assert.equal(partInitial.total.band, '<30%');
    assert.equal(partInitial.isBelowTarget, true);

    // 3. Reemissão de links (nenhum token foi usado ainda)
    const reissueResult = reissueLinks({
      surveyId: draftSurvey.id,
      accountId,
      baseUrl: 'http://localhost:3000'
    });
    assert.equal(reissueResult.ok, true);
    assert.equal(reissueResult.reissuedCount, savedSurvey.memberIds.length);
    assert.equal(reissueResult.links.length, savedSurvey.memberIds.length);

    // 4. Prorrogação de prazo (data posterior à data atual de encerramento)
    const newFutureDate = new Date(new Date(savedSurvey.endsAt).getTime() + 15 * 86400000).toISOString();
    const extendResult = extendSurvey({
      surveyId: draftSurvey.id,
      accountId,
      newEndsAt: newFutureDate,
      reason: 'Mais tempo para adesão'
    });
    assert.equal(extendResult.ok, true);
    assert.equal(extendResult.survey.endsAt, newFutureDate);
    assert.equal(extendResult.survey.extensions.length, 1);

    // 5. Encerramento antecipado sem confirmação exige confirmação
    const closeBlocked = closeSurvey({
      surveyId: draftSurvey.id,
      accountId,
      confirmEarlyClose: false
    });
    assert.equal(closeBlocked.error, 'participation_below_target');
    assert.equal(closeBlocked.requiresConfirmation, true);

    // 6. Encerramento antecipado com confirmação explícita
    const closeConfirmed = closeSurvey({
      surveyId: draftSurvey.id,
      accountId,
      confirmEarlyClose: true,
      reason: 'Encerramento especial de teste'
    });
    assert.equal(closeConfirmed.ok, true);
    assert.equal(closeConfirmed.survey.status, 'closed');
    assert.equal(closeConfirmed.survey.closedEarly, true);
    assert.equal(closeConfirmed.survey.earlyCloseReason, 'Encerramento especial de teste');
});

test('Fase 1.4: Integração HTTP — abertura, distribuição, resposta por convite, prorrogação e privacidade', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(route, method = 'GET', body, session = '') {
    const response = await fetch(`${base}/api${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Cookie: session } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0]
    };
  }

  try {
    // 1. Registro de duas empresas para teste de isolamento
    const accA = await call('/auth/register', 'POST', {
      name: 'Gestor A',
      company: 'Empresa A [DEMO]',
      email: 'gestorA@exemplo.test',
      password: 'senha-segura-123'
    });
    assert.equal(accA.status, 201);

    const accB = await call('/auth/register', 'POST', {
      name: 'Gestor B',
      company: 'Empresa B [DEMO]',
      email: 'gestorB@exemplo.test',
      password: 'senha-segura-123'
    });
    assert.equal(accB.status, 201);

    // 2. Empresa A cadastra 6 colaboradores e 2 grupos
    const memberIds = [];
    for (let i = 1; i <= 6; i++) {
      const m = await call('/members', 'POST', {
        name: `Participante A${i}`,
        email: `a${i}@exemplo.test`,
        phone: `1197777000${i}`
      }, accA.cookie);
      assert.equal(m.status, 201);
      memberIds.push(m.body.id);
    }

    const grp1 = await call('/groups', 'POST', { name: 'Operação A', memberIds: memberIds.slice(0, 3) }, accA.cookie);
    const grp2 = await call('/groups', 'POST', { name: 'Suporte A', memberIds: memberIds.slice(3, 6) }, accA.cookie);

    // 3. Empresa A cria pesquisa com os 2 grupos
    const survey = await call('/surveys', 'POST', {
      title: 'Pesquisa com Segmentos A',
      cycle: 'Fase 1 Teste',
      model: 'Diagnóstico inicial',
      groupIds: [grp1.body.id, grp2.body.id],
      endsAt: new Date(Date.now() + 86400000).toISOString()
    }, accA.cookie);
    assert.equal(survey.status, 201);

    // Isolamento: Empresa B não pode abrir a pesquisa de A
    const forbiddenOpen = await call(`/surveys/${survey.body.id}/open`, 'POST', {}, accB.cookie);
    assert.equal(forbiddenOpen.status, 404);

    // 4. Empresa A abre a pesquisa e recebe os links de distribuição
    const opened = await call(`/surveys/${survey.body.id}/open`, 'POST', {}, accA.cookie);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.links.length, 6);
    assert.ok(opened.body.links[0].token);
    assert.ok(opened.body.links[0].segmentId);

    // 5. Acompanhamento de participação via GET /surveys/:id/participation
    const partBefore = await call(`/surveys/${survey.body.id}/participation`, 'GET', undefined, accA.cookie);
    assert.equal(partBefore.status, 200);
    assert.equal(partBefore.body.total.invited, 6);
    assert.equal(partBefore.body.total.responded, 0);
    assert.equal(partBefore.body.segments.length, 2);

    // Varredura de privacidade na rota de participação
    const partJsonStr = JSON.stringify(partBefore.body);
    assert.equal(partJsonStr.includes('memberId'), false, 'participation não pode conter memberId');
    assert.equal(partJsonStr.includes('tokenHash'), false, 'participation não pode conter tokenHash');

    // 6. Resposta via token individual
    const firstLink = opened.body.links[0];
    const answers = {
      demandas: 4,
      autonomia: 4,
      apoio: 4,
      relacoes: 4,
      reconhecimento: 4,
      jornada: 4,
      mudancas: 4,
      seguranca: 4
    };

    const respResult = await call(`/respond/${firstLink.token}`, 'POST', { answers });
    assert.equal(respResult.status, 201);

    // Reutilizar o mesmo token deve falhar
    const duplicateResp = await call(`/respond/${firstLink.token}`, 'POST', { answers });
    assert.equal(duplicateResp.status, 409);
    assert.equal(duplicateResp.body.error, 'Resposta já enviada.');

    // 7. Acompanhamento após 1 resposta
    const partAfter = await call(`/surveys/${survey.body.id}/participation`, 'GET', undefined, accA.cookie);
    assert.equal(partAfter.body.total.responded, 1);
    const segResponded = partAfter.body.segments.find(s => s.id === firstLink.segmentId);
    assert.equal(segResponded.responded, 1);

    // 8. Reemissão de links: deve reemitir para os 5 ainda não usados
    const reissued = await call(`/surveys/${survey.body.id}/reissue`, 'POST', {}, accA.cookie);
    assert.equal(reissued.status, 200);
    assert.equal(reissued.body.reissuedCount, 5);

    // O token antigo de um dos não respondidos deve agora ser inválido
    const oldUnusedToken = opened.body.links[1].token;
    const oldResp = await call(`/respond/${oldUnusedToken}`, 'GET');
    assert.equal(oldResp.status, 404, 'Token anterior não usado deve ser invalidado após reemissão');

    // 9. Prorrogação de prazo
    const extendedDate = new Date(Date.now() + 10 * 86400000).toISOString();
    const extendHttp = await call(`/surveys/${survey.body.id}/extend`, 'POST', {
      endsAt: extendedDate,
      reason: 'Mais prazo solicitado pela CIPA'
    }, accA.cookie);
    assert.equal(extendHttp.status, 200);
    assert.equal(extendHttp.body.endsAt, extendedDate);

    // 10. Encerramento antecipado:
    // Sem confirmEarlyClose -> 409 + requiresConfirmation
    const closeBlockedHttp = await call(`/surveys/${survey.body.id}/close`, 'POST', {}, accA.cookie);
    assert.equal(closeBlockedHttp.status, 409);
    assert.equal(closeBlockedHttp.body.requiresConfirmation, true);

    // Com confirmEarlyClose -> fecha com sucesso
    const closeConfirmedHttp = await call(`/surveys/${survey.body.id}/close`, 'POST', {
      confirmEarlyClose: true,
      reason: 'Encerramento voluntário antecipado'
    }, accA.cookie);
    assert.equal(closeConfirmedHttp.status, 200);
    assert.equal(closeConfirmedHttp.body.status, 'closed');

    // 11. Varredura rigorosa de privacidade nas respostas salvas em disco
    const allResponses = storage.read('responses');
    const surveyResponses = allResponses.filter(r => r.surveyId === survey.body.id);
    assert.equal(surveyResponses.length, 1);
    const savedR = surveyResponses[0];
    assert.ok(savedR.segmentId, 'Resposta deve conter segmentId');
    assert.ok(savedR.submittedDay, 'Resposta deve conter submittedDay');
    assert.equal(savedR.memberId, undefined, 'PROIBIDO: memberId em responses');
    assert.equal(savedR.ip, undefined, 'PROIBIDO: ip em responses');
    assert.equal(savedR.userAgent, undefined, 'PROIBIDO: userAgent em responses');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
