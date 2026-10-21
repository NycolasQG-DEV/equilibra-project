const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
process.env.EQUILIBRA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-models-'));
process.env.BILLING_ENFORCE = 'false';
const app = require('../src/server');
const storage = require('../src/config/equilibraStorage');
const { aggregate, compareReports, summarizeDistribution } = require('../src/domain/analysis');
const { TEMPLATES, surveyInstrument } = require('../src/domain/instruments');
const hse = require('../src/domain/hseInstrument');

test('HSE: subescalas, itens invertidos, extremos e dados incompletos', () => {
  const answers = Object.fromEntries(hse.factors.map(([key]) => [key, 1]));
  const rows = Array.from({length:5}, () => ({answers}));
  const result = aggregate(rows, hse);
  assert.deepEqual(result.map(row => [row.key,row.average]), [
    ['demandas',5], ['controle',1], ['apoio_gestao',1], ['apoio_colegas',1], ['relacoes',5], ['papel',1], ['mudancas',1],
  ]);
  const allFavorable = Object.fromEntries(hse.factors.map(([key],i) => [key, hse.scoring.reverseItems.includes(i+1) ? 1 : 5]));
  assert.ok(aggregate(Array.from({length:5},()=>({answers:allFavorable})),hse).every(row=>row.average===5));
  const mixed = {...answers, hse_3:5};
  assert.equal(aggregate(Array.from({length:5},()=>({answers:mixed})),hse)[0].average,4.5);
  assert.equal(aggregate(rows.slice(0,4),hse),null);
  assert.equal(aggregate([{answers:{}},...rows],hse),null);
  assert.equal(summarizeDistribution(rows,hse),null);
  assert.equal(hse.options[22][0],'Nunca');
  assert.equal(hse.options[23][0],'Discordo fortemente');
  assert.equal(surveyInstrument({model:'Evento: mudança'}).factors.length,8);
});

test('modelos web: escolha, snapshot, respostas, publicação e proteção de capacidade concorrente', async () => {
  const server = app.listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let session='';
  async function call(route, method='GET', body, authenticated=true) {
    const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(authenticated && session ? {Cookie:session}: {})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,body:res.status===204?null:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    const account=await call('/auth/register','POST',{name:'Teste',company:'Empresa teste',email:'modelos@example.test',password:'senha-segura-123'});
    session=account.cookie;
    for(let i=0;i<5;i++) assert.equal((await call('/members','POST',{name:`Pessoa ${i}`,email:`p${i}@example.test`})).status,201);
    const group=(await call('/groups')).body.find(row=>row.isDefault);
    const meta=(await call('/meta')).body;
    assert.equal(meta.templates.length,10);
    assert.ok(meta.references.every(row=>!row.available));
    assert.ok(!meta.models.includes('COPSOQ II / III'));
    const fields={title:'Pesquisa web',cycle:'Teste',groupIds:[group.id],endsAt:new Date(Date.now()+86400000).toISOString()};
    assert.equal((await call('/surveys','POST',{...fields,model:'COPSOQ II / III'})).status,400);
    const reports=[];
    for(const template of TEMPLATES) {
      const draft=await call('/surveys','POST',{...fields,model:template.name,instrument:{id:'injetado',factors:[]}});
      assert.equal(draft.status,201);
      assert.equal(draft.body.instrument.id,template.id);
      const opened=await call(`/surveys/${draft.body.id}/open`,'POST',{});
      assert.equal(opened.status,200);
      const publicSurvey=await call(`/respond/${draft.body.id}`,'GET',undefined,false);
      assert.equal(publicSurvey.body.factors.length,template.factors.length);
      assert.equal(publicSurvey.body.collectionChannel,'web');
      assert.equal(publicSurvey.body.instrument.id,template.id);
      assert.equal(publicSurvey.body.memberIds,undefined);
      assert.equal((await call(`/respond/${draft.body.id}`,'POST',{answers:{}},false)).status,400);
      const answers=Object.fromEntries(template.factors.map(([key])=>[key,4]));
      if(template.id==='equilibra-medidas') {
        for(const link of opened.body.links.slice(0,4)) assert.equal((await call(`/respond/${link.token}`,'POST',{answers},false)).status,201);
        const raced=await Promise.all(Array.from({length:6},()=>call(`/respond/${draft.body.id}`,'POST',{answers},false)));
        assert.equal(raced.filter(r=>r.status===201).length,1);
        assert.equal(raced.filter(r=>r.status===409).length,5);
      } else {
        for(const link of opened.body.links) assert.equal((await call(`/respond/${link.token}`,'POST',{answers},false)).status,201);
      }
      assert.equal((await call(`/respond/${opened.body.links[0].token}`,'POST',{answers},false)).status,409);
      const closed=await call(`/surveys/${draft.body.id}/close`,'POST',{});
      assert.equal(closed.status,200);
      const report=(await call('/reports')).body.find(row=>row.surveyId===draft.body.id);
      assert.equal(report.published,true);
      assert.equal(report.instrument.id,template.id);
      assert.equal(report.result.length,template.scoring ? 7 : template.factors.length);
      assert.ok(report.methodology.includes(String(template.factors.length)));
      assert.equal(report.responseCount,5);
      assert.equal((await call(`/respond/${draft.body.id}`,'GET',undefined,false)).status,410);
      assert.equal((await call(`/surveys/${draft.body.id}`,'PUT',{...fields,model:TEMPLATES[0].name})).status,409);
      reports.push(report);
    }
    assert.equal(compareReports(reports[0],reports[1]).comparable,false);
    const saved=storage.read('reports')[0];
    const before=JSON.stringify(saved);
    const raw=storage.read('responses'); raw[0].answers={}; storage.write('responses',raw);
    assert.equal(JSON.stringify((await call('/reports')).body.find(row=>row.id===saved.id)),before);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
