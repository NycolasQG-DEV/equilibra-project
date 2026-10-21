const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-test-'));
process.env.EQUILIBRA_DATA_DIR = directory;
const app = require('../src/server');

test('cadastro, isolamento, ciclos, supressão e convite único', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(route, method = 'GET', body, session = '') {
    const response = await fetch(`${base}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    const account = await call('/auth/register', 'POST', { name: 'Ana', company: 'Empresa A', email: 'ana@example.test', password: 'senha-segura-123' });
    assert.equal(account.status, 201);
    const other = await call('/auth/register', 'POST', { name: 'Bruna', company: 'Empresa B', email: 'bruna@example.test', password: 'senha-segura-456' });
    assert.equal(other.status, 201);
    assert.equal((await call('/members', 'GET', undefined, other.cookie)).body.length, 0);
    assert.equal((await call('/members')).status, 401);
    const members = [];
    for (let index = 0; index < 5; index++) {
      const member = await call('/members', 'POST', { name: `Pessoa ${index}`, email: `p${index}@example.test`, phone: `1199999000${index}` }, account.cookie);
      assert.equal(member.status, 201); members.push(member.body.id);
    }
    assert.equal(fs.readFileSync(path.join(directory, 'members.json'), 'utf8').includes('11999990000'), false);
    const smallGroup = await call('/groups', 'POST', { name: 'Grupo pequeno', memberIds: members.slice(0, 1) }, account.cookie);
    const smallSurvey = await call('/surveys', 'POST', { title: 'Pulso pequeno', cycle: 'Outubro 2026', model: 'Pulso mensal', groupId: smallGroup.body.id, endsAt: new Date(Date.now() + 86400000).toISOString() }, account.cookie);
    assert.equal((await call(`/surveys/${smallSurvey.body.id}/open`, 'POST', {}, account.cookie)).status, 409);
    const group = await call('/groups', 'POST', { name: 'Operações', memberIds: members }, account.cookie);
    assert.equal(group.status, 201);
    const makeSurvey = async (title) => call('/surveys', 'POST', { title, cycle: 'Outubro 2026', model: 'Diagnóstico inicial', groupId: group.body.id, endsAt: new Date(Date.now() + 86400000).toISOString() }, account.cookie);
    const first = await makeSurvey('Primeira escuta');
    assert.equal(first.status, 201);
    assert.equal((await call('/reports', 'GET', undefined, account.cookie)).body.length, 0);
    assert.equal((await call(`/surveys/${first.body.id}/open`, 'POST', {}, other.cookie)).status, 404);
    const opened = await call(`/surveys/${first.body.id}/open`, 'POST', {}, account.cookie);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.links.length, 5);
    assert.equal((await call('/dashboard', 'GET', undefined, account.cookie)).body.result, null);
    const answers = { demandas: 4, autonomia: 4, apoio: 4, relacoes: 4, reconhecimento: 4, jornada: 4, mudancas: 4, seguranca: 4 };
    for (const link of opened.body.links.slice(0, 4)) assert.equal((await call(`/respond/${link.token}`, 'POST', { answers })).status, 201);
    assert.equal((await call(`/respond/${opened.body.links[0].token}`, 'POST', { answers })).status, 409);
    const closed = await call(`/surveys/${first.body.id}/close`, 'POST', {}, account.cookie);
    assert.equal(closed.body.result, null);
    const suppressedReport = (await call('/reports', 'GET', undefined, account.cookie)).body.find((item) => item.surveyId === first.body.id);
    assert.equal(suppressedReport.published, false);
    assert.equal(suppressedReport.result, null);
    assert.equal(suppressedReport.responseCount, null);
    assert.equal((await call('/dashboard', 'GET', undefined, account.cookie)).body.published, 0);
    const second = await makeSurvey('Segunda escuta');
    const reopened = await call(`/surveys/${second.body.id}/open`, 'POST', {}, account.cookie);
    for (const link of reopened.body.links) assert.equal((await call(`/respond/${link.token}`, 'POST', { answers })).status, 201);
    const published = await call(`/surveys/${second.body.id}/close`, 'POST', {}, account.cookie);
    assert.equal(published.body.result[0].average, 4);
    const savedReports = (await call('/reports', 'GET', undefined, account.cookie)).body;
    assert.equal(savedReports.length, 2);
    const saved = savedReports.find((item) => item.surveyId === second.body.id);
    assert.equal(saved.result[0].average, 4);
    assert.equal(saved.responseCount, 5);
    await call('/groups/' + group.body.id, 'PUT', { name: 'Operações renomeadas', memberIds: members }, account.cookie);
    const unchanged = (await call('/reports', 'GET', undefined, account.cookie)).body.find((item) => item.id === saved.id);
    assert.equal(unchanged.groupName, 'Operações');
    assert.equal((await call('/reports', 'GET', undefined, account.cookie)).body.length, 2);
    assert.equal((await call('/reports', 'GET', undefined, other.cookie)).body.length, 0);
    const expiring = await call('/surveys', 'POST', { title: 'Pulso com prazo', cycle: 'Novembro 2026', model: 'Pulso mensal', groupId: group.body.id, endsAt: new Date(Date.now() + 700).toISOString() }, account.cookie);
    assert.equal((await call(`/surveys/${expiring.body.id}/open`, 'POST', {}, account.cookie)).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 850));
    const expiredReports = (await call('/reports', 'GET', undefined, account.cookie)).body;
    assert.equal(expiredReports.length, 3);
    assert.equal(expiredReports.find((item) => item.surveyId === expiring.body.id).published, false);
    assert.equal((await call('/dashboard', 'GET', undefined, account.cookie)).body.published, 1);
    // Test single survey link: access, cookie duplicate prevention, and group size limit
    const singleSurvey = await makeSurvey('Escuta link único');
    const singleOpened = await call(`/surveys/${singleSurvey.body.id}/open`, 'POST', {}, account.cookie);
    assert.equal(singleOpened.status, 200);
    assert.equal(singleOpened.body.link, `/responder/${singleSurvey.body.id}`);

    const surveyInfo = await call(`/respond/${singleSurvey.body.id}`);
    assert.equal(surveyInfo.status, 200);
    assert.equal(surveyInfo.body.title, 'Escuta link único');
    assert.equal(surveyInfo.body.maxResponses, 5);

    const r1 = await call(`/respond/${singleSurvey.body.id}`, 'POST', { answers });
    assert.equal(r1.status, 201);
    assert.match(r1.cookie, /answered_/);

    const dup = await call(`/respond/${singleSurvey.body.id}`, 'POST', { answers }, r1.cookie);
    assert.equal(dup.status, 409);

    for (let i = 2; i <= 5; i++) {
      assert.equal((await call(`/respond/${singleSurvey.body.id}`, 'POST', { answers })).status, 201);
    }

    const overflow = await call(`/respond/${singleSurvey.body.id}`, 'POST', { answers });
    assert.equal(overflow.status, 409);
    assert.match(overflow.body.error, /quantidade limite/);

    await call(`/surveys/${singleSurvey.body.id}/close`, 'POST', {}, account.cookie);

    // Test profile settings update and uniqueness
    const updatedProfile = await call('/auth/me', 'PUT', { name: 'Ana Atualizada', company: 'Empresa Renovada', email: 'ana-novo@example.test' }, account.cookie);
    assert.equal(updatedProfile.status, 200);
    assert.equal(updatedProfile.body.name, 'Ana Atualizada');
    assert.equal(updatedProfile.body.company, 'Empresa Renovada');
    assert.equal(updatedProfile.body.email, 'ana-novo@example.test');

    // Duplicate email conflict check
    const conflictProfile = await call('/auth/me', 'PUT', { name: 'Ana', company: 'Empresa', email: 'bruna@example.test' }, account.cookie);
    assert.equal(conflictProfile.status, 409);

    // Logout and session invalidation check
    const logoutRes = await call('/auth/logout', 'POST', {}, account.cookie);
    assert.equal(logoutRes.status, 204);
    const postLogout = await call('/members', 'GET', undefined, account.cookie);
    assert.equal(postLogout.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); }
});
