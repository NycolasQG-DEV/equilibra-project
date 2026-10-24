const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-import-'));
process.env.EQUILIBRA_DATA_DIR = directory;
const app = require('../src/server');

async function workbook(rows, headers = ['Nome', 'Telefone', 'Email', 'Grupo']) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Pessoas');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return { fileName: 'pessoas.xlsx', base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') };
}

test('template, importação validada e grupo Geral automático', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  async function call(route, method = 'GET', body) {
    const response = await fetch(`${base}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  try {
    assert.equal((await call('/auth/register', 'POST', { name: 'Ana', company: 'Empresa', email: 'ana-import@example.test', password: 'senha-segura-123' })).status, 201);
    let groups = (await call('/groups')).body;
    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, 'Geral');
    assert.equal(groups[0].isDefault, true);
    let dashboardData = (await call('/dashboard')).body;
    assert.equal(dashboardData.groups, 1);
    assert.equal(dashboardData.customGroups, 0);

    const first = await call('/members', 'POST', { name: 'Pessoa A', phone: '11999990000', email: 'a@example.test' });
    assert.equal(first.status, 201);
    const custom = await call('/groups', 'POST', { name: 'Operações', memberIds: [first.body.id] });
    const second = await call('/members', 'POST', { name: 'Pessoa B', phone: '11999990001', email: 'b@example.test', groupId: custom.body.id });
    assert.equal(second.status, 201);

    dashboardData = (await call('/dashboard')).body;
    assert.equal(dashboardData.groups, 2);
    assert.equal(dashboardData.customGroups, 1);

    groups = (await call('/groups')).body;
    assert.equal(groups.find((group) => group.isDefault).memberIds.length, 2);
    assert.equal(groups.find((group) => group.id === custom.body.id).memberIds.length, 2);
    assert.equal((await call(`/groups/${groups.find((group) => group.isDefault).id}`, 'PUT', { name: 'Outro', memberIds: [] })).status, 409);
    assert.equal((await call('/members', 'POST', { name: 'Repetida', phone: '11 99999-0001', email: 'outro@example.test' })).status, 409);

    const templateResponse = await fetch(`${base}/api/members/template`, { headers: { Cookie: cookie } });
    assert.equal(templateResponse.status, 200);
    assert.match(templateResponse.headers.get('content-type'), /spreadsheetml/);
    const template = new ExcelJS.Workbook();
    await template.xlsx.load(Buffer.from(await templateResponse.arrayBuffer()));
    assert.deepEqual([1, 2, 3, 4].map((column) => template.worksheets[0].getRow(1).getCell(column).value), ['Nome', 'Telefone', 'Email', 'Grupo']);
    assert.equal(template.worksheets[0].rowCount >= 4, true);
    assert.equal(template.worksheets[0].getRow(2).getCell(1).value, 'Ana Silva');

    const invalid = await workbook([
      ['Pessoa C', '11999990002', 'c@example.test', 'Marketing'],
      ['Pessoa D', '11999990003', 'c@example.test', 'Marketing'],
      ['Pessoa E', '11999990004', 'email-invalido', '']
    ]);
    const preview = await call('/members/import/preview', 'POST', invalid);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.invalid, 2);
    assert.match(preview.body.rows[1].errors.join(' '), /E-mail repetido/);
    assert.equal((await call('/members/import', 'POST', invalid)).status, 422);
    assert.equal((await call('/members')).body.length, 2);
    assert.equal((await call('/members/import/preview', 'POST', await workbook([['A', '11999990005', 'a@example.test', '']], ['Nome', 'Telefone', 'Email', 'Setor']))).status, 400);
    assert.equal((await call('/members/import/preview', 'POST', { ...invalid, fileName: 'pessoas.xls' })).status, 400);

    // Test real spreadsheet features: E-mail header, numeric phone, hyperlink email, and empty rows
    const realBook = new ExcelJS.Workbook();
    const realSheet = realBook.addWorksheet('Pessoas');
    realSheet.addRow(['Nome', 'Telefone', 'E-mail', 'Grupo']);
    const r1 = realSheet.addRow(['Pessoa Real 1', 11999990010, '', 'RH']);
    r1.getCell(3).value = { text: 'real1@example.test', hyperlink: 'mailto:real1@example.test' };
    realSheet.addRow(['Pessoa Real 2', '(11) 99999-0011', 'real2@example.test', '']);
    realSheet.addRow(['', '', '', '']); // empty row
    const realPayload = { fileName: 'pessoas.xlsx', base64: Buffer.from(await realBook.xlsx.writeBuffer()).toString('base64') };
    const realPreview = await call('/members/import/preview', 'POST', realPayload);
    assert.equal(realPreview.status, 200);
    assert.equal(realPreview.body.valid, 2);
    assert.equal(realPreview.body.invalid, 0);
    const realImported = await call('/members/import', 'POST', realPayload);
    assert.equal(realImported.status, 201);
    assert.deepEqual(realImported.body, { imported: 2, groupsCreated: 1 });

    const valid = await workbook([
      ['Pessoa C', '11999990002', 'c@example.test', 'Marketing'],
      ['Pessoa D', '11999990003', 'd@example.test', '']
    ]);
    assert.equal((await call('/members/import/preview', 'POST', valid)).body.invalid, 0);
    const imported = await call('/members/import', 'POST', valid);
    assert.equal(imported.status, 201);
    assert.deepEqual(imported.body, { imported: 2, groupsCreated: 1 });
    groups = (await call('/groups')).body;
    assert.equal(groups.find((group) => group.isDefault).memberIds.length, 6);
    assert.equal(groups.find((group) => group.name === 'Marketing').memberIds.length, 1);
    assert.equal((await call('/members/import', 'POST', valid)).status, 422);
    assert.equal(fs.readFileSync(path.join(directory, 'members.json'), 'utf8').includes('11999990002'), false);

    // Test CSV import with UTF-8 BOM, semicolon delimiters, and new group creation
    const csvContent = '\uFEFFNome;Telefone;Email;Grupo\nPessoa CSV 1;11999990020;csv1@example.test;Tecnologia\nPessoa CSV 2;11999990021;csv2@example.test;\n';
    const csvPayload = { fileName: 'pessoas.csv', base64: Buffer.from(csvContent, 'utf8').toString('base64') };
    const csvPreview = await call('/members/import/preview', 'POST', csvPayload);
    assert.equal(csvPreview.status, 200);
    assert.equal(csvPreview.body.valid, 2);
    assert.equal(csvPreview.body.invalid, 0);
    const csvImported = await call('/members/import', 'POST', csvPayload);
    assert.equal(csvImported.status, 201);
    assert.deepEqual(csvImported.body, { imported: 2, groupsCreated: 1 });
    assert.equal((await call('/members')).body.length, 8);
  } finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); }
});
