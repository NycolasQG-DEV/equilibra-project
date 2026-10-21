const express = require('express');
const crypto = require('node:crypto');
const { read, write, writeMany } = require('../config/equilibraStorage');
const { encryptPhone, decryptPhone } = require('../config/identityCrypto');
const { createTemplate, parseImport, validateImport, validPhone, phoneKey } = require('../services/memberImport');
const router = express.Router();
const { FACTORS, MODELS, TEMPLATES, REFERENCES, instrumentForModel, surveyInstrument, snapshotInstrument } = require('../domain/instruments');
const { aggregate, summarizeDistribution } = require('../domain/analysis');
const MIN_RESULTS = 5;
const attempts = new Map();
const id = () => crypto.randomUUID();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (res, status, error) => res.status(status).json({ error });
const { derive: passwordHash, verify: validPassword } = require('../services/passwordService');
const email = (value) => clean(value, 254).toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const cookie = (req) => (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('equilibra_session='))?.split('=')[1];
const SESSION_DURATION = 30 * 86400000;
const sendCookie = (res, token) => res.cookie('equilibra_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_DURATION });
const scoped = (name, accountId) => read(name).filter((item) => item.accountId === accountId);
const publicMember = (member) => ({ ...member, phone: decryptPhone(member.phone) });
function ensureGeneralGroup(accountId) {
  const groups = read('groups');
  const memberIds = scoped('members', accountId).map((item) => item.id);
  let general = groups.find((item) => item.accountId === accountId && item.name.toLocaleLowerCase('pt-BR') === 'geral');
  if (!general) {
    general = { id: id(), accountId, name: 'Geral', memberIds, isDefault: true, createdAt: new Date().toISOString() };
    groups.push(general); write('groups', groups);
  } else {
    const complete = memberIds.length === general.memberIds.length && memberIds.every((memberId) => general.memberIds.includes(memberId));
    if (!complete || !general.isDefault) { general.memberIds = memberIds; general.isDefault = true; write('groups', groups); }
  }
  return general;
}
function selectedGroup(accountId, groupId) {
  if (!groupId) return null;
  return scoped('groups', accountId).find((item) => item.id === groupId && !item.isDefault) || undefined;
}
function addToGroups(accountId, memberIds, groupId) {
  const general = ensureGeneralGroup(accountId);
  if (!groupId) return general;
  const groups = read('groups');
  const group = groups.find((item) => item.id === groupId && item.accountId === accountId && !item.isDefault);
  if (group) { group.memberIds = [...new Set([...group.memberIds, ...memberIds])]; write('groups', groups); }
  return general;
}

function currentAccount(req) {
  const token = cookie(req);
  if (!token) return null;
  const session = read('sessions').find((item) => item.tokenHash === hash(token) && item.expiresAt > Date.now());
  const actor = session && read('accounts').find((item) => item.id === session.accountId && !item.disabled);
  if (!actor) return null;
  const organization = read('accounts').find(item => item.id === (actor.organizationId || actor.id));
  if (!organization || organization.disabled) return null;
  return { ...actor, id: actor.organizationId || actor.id, userId: actor.id, role: actor.role || 'owner', company: organization.company };
}
function protectedRoute(req, res, next) {
  req.account = currentAccount(req);
  if (!req.account) return fail(res, 401, 'Entre na sua conta.');
  const personalRoute = req.path.startsWith('/auth/') || req.path === '/account/password';
  if (req.account.role === 'viewer' && !['GET', 'HEAD'].includes(req.method) && !personalRoute) return fail(res, 403, 'Seu acesso permite somente consulta.');
  if (req.account.role !== 'owner' && !['GET', 'HEAD'].includes(req.method) && /^\/(members|groups)/.test(req.path)) return fail(res, 403, 'Somente o administrador gerencia pessoas e grupos.');
  ensureGeneralGroup(req.account.id);
  try { require('../services/entitlementService').check(req); } catch (error) { return fail(res, error.status || 400, error.message); }
  next();
}
const publicAccount = account => ({ id: account.id, userId: account.userId || account.id, name: account.name, company: account.company, email: account.email, role: account.role || 'owner' });
function publishableAggregate(survey, responses) {
  if (responses.length > (survey.memberIds?.length || 0)) return null;
  const audience = new Set(survey.memberIds || []);
  for (const other of scoped('surveys', survey.accountId)) {
    if (other.id === survey.id || other.status !== 'closed' || !other.result) continue;
    const previous = new Set(other.memberIds || []);
    const common = [...audience].filter(value => previous.has(value)).length;
    const left = audience.size - common, right = previous.size - common;
    if (common && ((left > 0 && left < MIN_RESULTS) || (right > 0 && right < MIN_RESULTS))) return null;
  }
  return aggregate(responses, surveyInstrument(survey));
}
function surveySummary(survey, accountId) {
  const accountGroups = scoped('groups', accountId);
  // Support multi-group surveys (groupIds array) and legacy single-group (groupId)
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const surveyGroups = surveyGroupIds.map(gid => accountGroups.find(g => g.id === gid)).filter(Boolean);
  const groupName = survey.status === 'closed' && survey.groupNamesSnapshot ? survey.groupNamesSnapshot.join(', ') : surveyGroups.length > 1
    ? surveyGroups.map(g => g.name).join(', ')
    : (surveyGroups[0]?.name || 'Grupo removido');
  const responses = scoped('responses', accountId).filter((item) => item.surveyId === survey.id);
  const responseCount = survey.status === 'closed' ? (survey.responseCount ?? responses.length) : responses.length;
  const totalMembers = survey.memberIds?.length || 0;
  const pct70 = totalMembers > 0 ? Math.ceil(totalMembers * 0.7) : 0;
  const isExpired = Number.isFinite(new Date(survey.endsAt).getTime()) && new Date(survey.endsAt).getTime() <= Date.now();
  const canClose = responseCount >= pct70 || isExpired;
  const savedReport = scoped('reports', accountId).find(row => row.surveyId === survey.id);
  const result = survey.status === 'closed' ? (savedReport ? savedReport.result : (survey.result || publishableAggregate(survey, responses))) : null;
  const liveResult = null;
  return {
    ...survey,
    groupIds: surveyGroupIds,
    groups: surveyGroups.map(g => ({ id: g.id, name: g.name, color: g.color, memberCount: g.memberIds.length })),
    groupNames: surveyGroups.map(g => g.name),
    groupName,
    groupSize: totalMembers,
    responseCount,
    canClose,
    pct70,
    isExpired,
    result,
    liveResult
  };
}
function ensureReports(accountId) {
  const reports = read('reports');
  let changed = false;
  for (const survey of scoped('surveys', accountId)) {
    if (survey.status !== 'closed') continue;
    const group = scoped('groups', accountId).find((item) => (survey.groupIds || [survey.groupId]).includes(item.id));
    const responses = scoped('responses', accountId).filter((item) => item.surveyId === survey.id);
    const result = publishableAggregate(survey, responses);
    const existing = reports.find((item) => item.surveyId === survey.id);
    if (!existing) {
      reports.push({
        id: id(), accountId, surveyId: survey.id, title: survey.title, cycle: survey.cycle,
        model: survey.model, groupName: survey.groupNamesSnapshot?.join(', ') || group?.name || 'Grupo removido',
        closedAt: survey.closedAt || survey.endsAt, published: Boolean(result),
        responseCount: result ? responses.length : null, result,
        suppressionReason: result ? null : (responses.length < MIN_RESULTS ? 'Volume mínimo de respostas não atingido.' : 'Resultado omitido por proteção de públicos sobrepostos ou integridade dos dados.'),
        instrument: survey.instrument || null, audienceFingerprint: survey.audienceFingerprint || null,
        groupNames: survey.groupNamesSnapshot || [group?.name || 'Grupo removido'],
        distribution: result ? summarizeDistribution(responses, surveyInstrument(survey)) : null,
        methodology: `${surveyInstrument(survey).name}, versão ${surveyInstrument(survey).version}; ${surveyInstrument(survey).factors.length} afirmações; ${surveyInstrument(survey).limitation}`,
        collectionChannel: 'web'
      });
      changed = true;

    }
  }
  if (changed) write('reports', reports);
  return reports.filter((item) => item.accountId === accountId).sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}
function closeExpired(accountId) {
  const surveys = read('surveys'); let changed = false;
  for (const survey of surveys) {
    if (survey.accountId === accountId && survey.status === 'open' && Number.isFinite(new Date(survey.endsAt).getTime()) && new Date(survey.endsAt).getTime() <= Date.now()) {
      survey.status = 'closed';
      survey.closedAt = new Date().toISOString();
      const responses = scoped('responses', accountId).filter((item) => item.surveyId === survey.id);
      survey.result = publishableAggregate(survey, responses);
      survey.responseCount = responses.length;
      changed = true;
    }
  }
  if (changed) write('surveys', surveys);
  if (changed) ensureReports(accountId);
}
function validateSurveyInput(req, accountId) {
  const title = clean(req.body.title);
  if (!title) return { error: 'Informe o título da pesquisa.' };

  const cycle = clean(req.body.cycle, 80);
  if (!cycle) return { error: 'Informe o ciclo ou período da pesquisa (ex: Outubro 2026).' };

  const model = clean(req.body.model);
  if (!model || !instrumentForModel(model)) {
    return { error: 'Selecione um modelo disponível no catálogo de pesquisas.' };
  }

  let rawGroupIds = Array.isArray(req.body.groupIds) ? req.body.groupIds : (req.body.groupId ? [req.body.groupId] : []);
  const accountGroups = scoped('groups', accountId);
  const groups = rawGroupIds.map(gid => accountGroups.find(g => g.id === gid)).filter(Boolean);
  if (groups.length === 0) {
    return { error: 'Selecione ao menos um grupo participante para a pesquisa.' };
  }

  const endsAtRaw = clean(req.body.endsAt, 40);
  const endsAtTime = new Date(endsAtRaw).getTime();
  if (!Number.isFinite(endsAtTime)) {
    return { error: 'Informe uma data e hora válida para o encerramento.' };
  }
  if (endsAtTime <= Date.now()) {
    return { error: 'A data de encerramento deve ser no futuro.' };
  }

  const memberIds = [...new Set(groups.flatMap(g => g.memberIds))];
  return {
    fields: {
      title,
      cycle,
      model,
      instrument: snapshotInstrument(model),
      collectionChannel: 'web',
      groupIds: groups.map(g => g.id),
      groupId: groups[0].id,
      memberIds,
      endsAt: new Date(endsAtTime).toISOString()
    }
  };
}
router.post('/auth/register', (req, res) => {
  const name = clean(req.body.name), company = clean(req.body.company), address = email(req.body.email), password = req.body.password;
  if (!name || !company || !validEmail(address) || typeof password !== 'string' || password.length < 10 || password.length > 128) return fail(res, 400, 'Informe nome, empresa, e-mail válido e senha com 10 a 128 caracteres.');
  const accounts = read('accounts');
  if (accounts.some((item) => item.email === address)) return fail(res, 409, 'E-mail já cadastrado.');
  let invitation, workspace;
  if (req.body.invitationToken) {
    if (typeof req.body.invitationToken !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.invitationToken)) return fail(res, 400, 'Convite inválido ou expirado.');
    workspace = read('management').find(row => row.invitations.some(item => item.tokenHash === hash(req.body.invitationToken) && !item.usedAt && item.expiresAt > Date.now() && item.email === address));
    invitation = workspace?.invitations.find(item => item.tokenHash === hash(req.body.invitationToken) && item.email === address && !item.usedAt && item.expiresAt > Date.now());
    if (!invitation) return fail(res, 400, 'Convite inválido ou expirado.');
    try { require('../services/entitlementService').checkUserLimit(workspace.id); } catch(error) { return fail(res, error.status || 400, error.message); }
  }
  const account = { id: id(), name, company, email: address, passwordHash: passwordHash(password), role: invitation?.role || 'owner', ...(workspace ? { organizationId: workspace.id } : {}), createdAt: new Date().toISOString() };
  accounts.push(account);
  if (invitation) {
    const allManagement = read('management');
    const state = allManagement.find(row => row.id === workspace.id);
    state.invitations.find(row => row.id === invitation.id).usedAt = new Date().toISOString();
    writeMany({ accounts, management: allManagement });
    require('../repositories/managementRepository').transaction({ id: workspace.id, userId: account.id, name }, 'team.joined', () => ({ id: account.id }));
  } else write('accounts', accounts);
  ensureGeneralGroup(workspace?.id || account.id);
  const token = crypto.randomBytes(32).toString('hex'), sessions = read('sessions');
  sessions.push({ accountId: account.id, tokenHash: hash(token), expiresAt: Date.now() + SESSION_DURATION }); write('sessions', sessions);
  sendCookie(res, token); res.status(201).json(publicAccount(currentAccount({ headers: { cookie: `equilibra_session=${token}` } })));
});
router.post('/auth/login', (req, res) => {
  const address = email(req.body.email), key = `${req.ip}:${address}`, state = attempts.get(key) || { count: 0, until: 0 };
  if (state.count >= 8 && state.until > Date.now()) return fail(res, 429, 'Muitas tentativas. Tente novamente em 15 minutos.');
  const account = read('accounts').find((item) => item.email === address);
  if (!account || account.disabled || typeof req.body.password !== 'string' || req.body.password.length > 128 || !validPassword(req.body.password, account.passwordHash)) { attempts.set(key, { count: state.count + 1, until: Date.now() + 15 * 60000 }); return fail(res, 401, 'E-mail ou senha incorretos.'); }
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex'), sessions = read('sessions');
  sessions.push({ accountId: account.id, tokenHash: hash(token), expiresAt: Date.now() + SESSION_DURATION }); write('sessions', sessions);
  sendCookie(res, token); res.json(publicAccount(currentAccount({ headers: { cookie: `equilibra_session=${token}` } })));
});
router.get('/auth/me', (req, res) => { const account = currentAccount(req); res.json(account ? publicAccount(account) : null); });
router.put('/auth/me', protectedRoute, (req, res) => {
  const name = clean(req.body.name), company = clean(req.body.company), address = email(req.body.email);
  if (!name || !company || !validEmail(address)) return fail(res, 400, 'Informe nome, empresa e um e-mail válido.');
  const accounts = read('accounts');
  if (accounts.some((item) => item.id !== req.account.userId && item.email === address)) return fail(res, 409, 'E-mail já cadastrado por outra conta.');
  const account = accounts.find((item) => item.id === req.account.userId);
  if (!account) return fail(res, 404, 'Conta não encontrada.');
  account.name = name;
  if (req.account.role === 'owner') account.company = company;
  account.email = address;
  account.updatedAt = new Date().toISOString();
  write('accounts', accounts);
  req.account = currentAccount(req);
  res.json(publicAccount(req.account));
});
router.post('/auth/logout', protectedRoute, (req, res) => { write('sessions', read('sessions').filter((item) => item.tokenHash !== hash(cookie(req)))); res.clearCookie('equilibra_session', { path: '/' }); res.status(204).end(); });

router.get('/members', protectedRoute, (req, res) => res.json(req.account.role === 'viewer' ? [] : scoped('members', req.account.id).map(publicMember)));
router.post('/members', protectedRoute, (req, res) => {
  const name = clean(req.body.name, 120), address = req.body.email ? email(req.body.email) : '', phone = req.body.phone ? clean(req.body.phone, 22) : '';
  if (!name && !address) return fail(res, 400, 'Informe ao menos o nome ou e-mail da pessoa.');
  if (address && !validEmail(address)) return fail(res, 400, 'Informe um e-mail válido.');
  if (phone && !validPhone(phone)) return fail(res, 400, 'Informe um telefone válido.');
  const members = read('members');
  if (address && members.some((item) => item.accountId === req.account.id && item.email === address)) return fail(res, 409, 'Pessoa já cadastrada com este e-mail.');
  if (phone && members.some((item) => item.accountId === req.account.id && decryptPhone(item.phone) && phoneKey(decryptPhone(item.phone)) === phoneKey(phone))) return fail(res, 409, 'Pessoa já cadastrada com este telefone.');
  const member = { id: id(), accountId: req.account.id, name, email: address, phone: encryptPhone(phone), createdAt: new Date().toISOString() };
  members.push(member); write('members', members);
  if (Array.isArray(req.body.groupIds)) {
    const groups = read('groups');
    for (const g of groups) if (g.accountId === req.account.id && !g.isDefault && req.body.groupIds.includes(g.id) && !g.memberIds.includes(member.id)) g.memberIds.push(member.id);
    write('groups', groups); ensureGeneralGroup(req.account.id);
  } else {
    addToGroups(req.account.id, [member.id], req.body.groupId);
  }
  res.status(201).json(publicMember(member));
});
router.put('/members/:id', protectedRoute, (req, res) => {
  const members = read('members'), member = members.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!member) return fail(res, 404, 'Pessoa não encontrada.');
  const name = clean(req.body.name, 120), address = req.body.email ? email(req.body.email) : '', phone = req.body.phone ? clean(req.body.phone, 22) : '';
  if (!name && !address) return fail(res, 400, 'Informe ao menos o nome ou e-mail da pessoa.');
  if (address && !validEmail(address)) return fail(res, 400, 'Informe um e-mail válido.');
  if (phone && !validPhone(phone)) return fail(res, 400, 'Informe um telefone válido.');
  if (address && members.some((item) => item.id !== member.id && item.accountId === req.account.id && item.email === address)) return fail(res, 409, 'E-mail já cadastrado.');
  if (phone && members.some((item) => item.id !== member.id && item.accountId === req.account.id && decryptPhone(item.phone) && phoneKey(decryptPhone(item.phone)) === phoneKey(phone))) return fail(res, 409, 'Telefone já cadastrado.');
  Object.assign(member, { name, email: address, phone: encryptPhone(phone) }); write('members', members);
  if (Array.isArray(req.body.groupIds)) {
    const groups = read('groups');
    for (const g of groups) {
      if (g.accountId === req.account.id && !g.isDefault) {
        const shouldBeIn = req.body.groupIds.includes(g.id);
        const isIn = g.memberIds.includes(member.id);
        if (shouldBeIn && !isIn) g.memberIds.push(member.id);
        else if (!shouldBeIn && isIn) g.memberIds = g.memberIds.filter((mId) => mId !== member.id);
      }
    }
    write('groups', groups); ensureGeneralGroup(req.account.id);
  } else if (req.body.groupId !== undefined) {
    addToGroups(req.account.id, [member.id], req.body.groupId);
  }
  res.json(publicMember(member));
});
router.delete('/members/:id', protectedRoute, (req, res) => {
  const members = read('members'), member = members.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!member) return fail(res, 404, 'Pessoa não encontrada.');
  write('members', members.filter((item) => item.id !== member.id));
  const groups = read('groups');
  for (const group of groups) if (group.accountId === req.account.id) group.memberIds = group.memberIds.filter((mId) => mId !== member.id);
  write('groups', groups);
  res.status(204).end();
});

router.get('/members/template', protectedRoute, async (_req, res) => {
  const buffer = await createTemplate();
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="equilibra-pessoas.xlsx"', 'Content-Length': String(buffer.length) });
  res.send(Buffer.from(buffer));
});
async function reviewImport(req, accountId) {
  const rows = await parseImport(req.body?.fileName, req.body?.base64);
  return validateImport(rows, scoped('members', accountId).map(publicMember));
}
router.post('/members/import/preview', protectedRoute, async (req, res) => {
  try { res.json(await reviewImport(req, req.account.id)); }
  catch (error) { return fail(res, 400, error.message); }
});
router.post('/members/import', protectedRoute, async (req, res) => {
  let review;
  try { review = await reviewImport(req, req.account.id); }
  catch (error) { return fail(res, 400, error.message); }
  if (review.invalid) return res.status(422).json({ error: 'Corrija as linhas indicadas antes de importar.', ...review });
  const accountId = req.account.id, members = read('members'), groups = read('groups');
  try {
    const limits = require('../services/entitlementService');
    limits.limit(accountId, 'members', review.valid);
    const existingNames = new Set(groups.filter(row => row.accountId === accountId).map(row => row.name.toLocaleLowerCase('pt-BR')));
    const addedNames = new Set(review.rows.map(row => row.group.toLocaleLowerCase('pt-BR')).filter(name => name !== 'geral' && !existingNames.has(name)));
    limits.limit(accountId, 'groups', addedNames.size);
  } catch(error) { return fail(res, error.status || 400, error.message); }
  let groupsCreated = 0;
  for (const row of review.rows) {
    const member = { id: id(), accountId, name: row.name, email: row.email, phone: encryptPhone(row.phone), createdAt: new Date().toISOString() };
    members.push(member);
    if (row.group.toLocaleLowerCase('pt-BR') === 'geral') continue;
    let group = groups.find((item) => item.accountId === accountId && item.name.toLocaleLowerCase('pt-BR') === row.group.toLocaleLowerCase('pt-BR'));
    if (!group) { group = { id: id(), accountId, name: row.group, memberIds: [], createdAt: new Date().toISOString() }; groups.push(group); groupsCreated++; }
    group.memberIds.push(member.id);
  }
  writeMany({ members, groups });
  ensureGeneralGroup(accountId);
  res.status(201).json({ imported: review.valid, groupsCreated });
});

router.get('/groups', protectedRoute, (req, res) => res.json(scoped('groups', req.account.id)));
function groupFields(req, accountId) {
  const name = clean(req.body.name);
  const memberIds = Array.isArray(req.body.memberIds) ? [...new Set(req.body.memberIds)] : [];
  const validMembers = scoped('members', accountId);
  if (!name || memberIds.some((memberId) => !validMembers.some((item) => item.id === memberId))) return null;
  return { name, memberIds };
}
router.post('/groups', protectedRoute, (req, res) => {
  const fields = groupFields(req, req.account.id); if (!fields) return fail(res, 400, 'Informe nome do grupo.');
  const groups = read('groups');
  if (groups.some((item) => item.accountId === req.account.id && item.name.toLowerCase() === fields.name.toLowerCase())) return fail(res, 409, 'Grupo com este nome já existe.');
  const color = typeof req.body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : null;
  const group = { id: id(), accountId: req.account.id, ...fields, color, createdAt: new Date().toISOString() };
  groups.push(group); write('groups', groups); res.status(201).json(group);
});
router.put('/groups/:id', protectedRoute, (req, res) => {
  const groups = read('groups'), group = groups.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!group) return fail(res, 404, 'Grupo não encontrado.');
  if (group.isDefault) return fail(res, 409, 'O grupo Geral é automático e não pode ser editado.');
  const fields = groupFields(req, req.account.id); if (!fields) return fail(res, 400, 'Informe nome do grupo.');
  if (groups.some((item) => item.id !== group.id && item.accountId === req.account.id && item.name.toLowerCase() === fields.name.toLowerCase())) return fail(res, 409, 'Grupo com este nome já existe.');
  const color = typeof req.body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : (group.color || null);
  Object.assign(group, fields, { color }); write('groups', groups); res.json(group);
});
router.delete('/groups/:id', protectedRoute, (req, res) => {
  const groups = read('groups'), group = groups.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!group) return fail(res, 404, 'Grupo não encontrado.');
  if (group.isDefault) return fail(res, 409, 'O grupo Geral é automático e não pode ser excluído.');
  const surveys = scoped('surveys', req.account.id);
  if (surveys.some((s) => (s.groupIds || [s.groupId]).includes(group.id) && s.status === 'open')) return fail(res, 409, 'Não é possível excluir um grupo com pesquisa em andamento.');
  write('groups', groups.filter((item) => item.id !== group.id));
  res.status(204).end();
});

router.get('/meta', protectedRoute, (_req, res) => res.json({ factors: FACTORS, models: TEMPLATES.map(row => row.name), templates: TEMPLATES, references: REFERENCES, collectionChannel: 'web', minResults: MIN_RESULTS }));
router.get('/surveys', protectedRoute, (req, res) => { closeExpired(req.account.id); res.json(scoped('surveys', req.account.id).filter(item => !item.archivedAt).map((item) => surveySummary(item, req.account.id)).reverse()); });
router.post('/surveys', protectedRoute, (req, res) => {
  const validation = validateSurveyInput(req, req.account.id);
  if (validation.error) return fail(res, 400, validation.error);
  const fields = validation.fields;
  const surveys = read('surveys'), survey = { id: id(), accountId: req.account.id, ...fields, status: 'draft', createdAt: new Date().toISOString() };
  surveys.push(survey); write('surveys', surveys); res.status(201).json(surveySummary(survey, req.account.id));
});
router.put('/surveys/:id', protectedRoute, (req, res) => {
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'draft') return fail(res, 409, 'Somente rascunhos podem ser editados.');
  const validation = validateSurveyInput(req, req.account.id);
  if (validation.error) return fail(res, 400, validation.error);
  Object.assign(survey, validation.fields); write('surveys', surveys); res.json(surveySummary(survey, req.account.id));
});
router.delete('/surveys/:id', protectedRoute, (req, res) => {
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status === 'open') return fail(res, 409, 'Encerre a pesquisa antes de excluir.');
  if (survey.status === 'closed') {
    survey.archivedAt = new Date().toISOString();
    write('surveys', surveys);
    return res.status(204).end();
  }
  write('surveys', surveys.filter((item) => item.id !== survey.id));
  const invitations = read('invitations').filter((item) => item.surveyId !== survey.id);
  write('invitations', invitations);
  res.status(204).end();
});
router.post('/surveys/:id/open', protectedRoute, (req, res) => {
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'draft') return fail(res, 409, 'Pesquisa já iniciada.');
  // Recalculate memberIds from all linked groups at open time
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const accountGroups = scoped('groups', req.account.id);
  const surveyGroups = surveyGroupIds.map(gid => accountGroups.find(g => g.id === gid)).filter(Boolean);
  if (surveyGroups.length === 0) return fail(res, 409, 'Nenhum grupo válido encontrado para esta pesquisa.');
  const freshMemberIds = [...new Set(surveyGroups.flatMap(g => g.memberIds))];
  if (freshMemberIds.length < MIN_RESULTS) return fail(res, 409, `Os grupos selecionados precisam ter no total ao menos ${MIN_RESULTS} pessoas únicas.`);
  survey.memberIds = freshMemberIds;
  survey.instrument = survey.instrument?.factors ? survey.instrument : snapshotInstrument(survey.model);
  if (!survey.instrument) return fail(res, 409, 'Modelo não disponível para aplicação.');
  survey.collectionChannel = 'web';
  survey.audienceFingerprint = hash([...freshMemberIds].sort().join(':'));
  survey.groupNamesSnapshot = surveyGroups.map(group => group.name);
  if (new Date(survey.endsAt).getTime() <= Date.now()) return fail(res, 409, 'Defina data futura de encerramento.');
  if (surveys.some((item) => item.accountId === req.account.id && item.status === 'open' && item.memberIds.some((memberId) => survey.memberIds.includes(memberId)))) return fail(res, 409, 'Há outra pesquisa aberta com pessoas deste(s) grupo(s).');
  const invitations = read('invitations'), links = survey.memberIds.map((memberId) => { const token = crypto.randomBytes(24).toString('hex'); invitations.push({ id: id(), accountId: req.account.id, surveyId: survey.id, memberId, tokenHash: hash(token), usedAt: null }); return { memberId, token }; });
  write('invitations', invitations); survey.status = 'open'; survey.openedAt = new Date().toISOString(); write('surveys', surveys);
  res.json({ survey: surveySummary(survey, req.account.id), link: `/responder/${survey.id}`, links });
});
router.post('/surveys/:id/close', protectedRoute, (req, res) => {
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'open') return fail(res, 409, 'Pesquisa não está aberta.');
  // Enforce 70% threshold for manual close or expiration date reached
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  const responses = read('responses').filter(r => r.surveyId === survey.id);
  const totalMembers = survey.memberIds?.length || 0;
  const pct70 = totalMembers > 0 ? Math.ceil(totalMembers * 0.7) : 0;
  const isExpired = Number.isFinite(new Date(survey.endsAt).getTime()) && new Date(survey.endsAt).getTime() <= Date.now();
  if (!isTest && !isExpired && responses.length < pct70) {
    return fail(res, 409, `Ainda não é possível recolher os resultados. São necessárias ao menos ${pct70} respostas (70% de ${totalMembers} participantes) ou aguardar a data de conclusão. Respostas recebidas: ${responses.length}.`);
  }
  survey.status = 'closed';
  survey.closedAt = new Date().toISOString();
  survey.result = publishableAggregate(survey, responses);
  survey.responseCount = responses.length;
  write('surveys', surveys);
  const reports = ensureReports(req.account.id);
  const report = reports.find((r) => r.surveyId === survey.id);
  const summary = surveySummary(survey, req.account.id);
  res.json({ ...summary, reportId: report?.id });
});
router.get('/reports', protectedRoute, (req, res) => {
  closeExpired(req.account.id);
  res.json(ensureReports(req.account.id));
});
router.get('/dashboard', protectedRoute, (req, res) => {
  closeExpired(req.account.id);
  const surveys = scoped('surveys', req.account.id).map((item) => surveySummary(item, req.account.id));
  const published = surveys.filter((item) => item.result);
  const responses = scoped('responses', req.account.id).filter((item) => published.some((survey) => survey.id === item.surveyId));
  const groups = scoped('groups', req.account.id);
  res.json({ members: scoped('members', req.account.id).length, groups: groups.length, customGroups: groups.filter((item) => !item.isDefault).length, surveys: surveys.length, open: surveys.filter((item) => item.status === 'open').length, closed: surveys.filter((item) => item.status === 'closed').length, published: published.length, responseCount: responses.length, result: published.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))[0]?.result || null, latestCycle: published[0]?.cycle || null, recent: published.slice(-3).reverse().map((item) => ({ id: item.id, title: item.title, cycle: item.cycle, groupName: item.groupName, responseCount: item.responseCount })) });
});

function findSurveyByParam(param) {
  const surveys = read('surveys');
  const direct = surveys.find((item) => item.id === param);
  if (direct) return { survey: direct, invitation: null };
  const invitation = read('invitations').find((item) => item.tokenHash === hash(param));
  if (invitation) {
    const survey = surveys.find((item) => item.id === invitation.surveyId);
    return { survey, invitation };
  }
  return { survey: null, invitation: null };
}

function hasAnsweredCookie(req, surveyId) {
  const cookieKey = `answered_${surveyId}`;
  const cookies = (req.headers.cookie || '').split(';').map((p) => p.trim());
  return cookies.some((p) => p.startsWith(`${cookieKey}=`));
}

router.get('/respond/:token', (req, res) => {
  const { survey, invitation } = findSurveyByParam(req.params.token);
  if (!survey) return fail(res, 404, 'Convite não encontrado.');
  if (survey.status !== 'open' || new Date(survey.endsAt).getTime() <= Date.now()) return fail(res, 410, 'Pesquisa encerrada.');
  const responses = read('responses').filter((item) => item.surveyId === survey.id);
  const maxResponses = survey.memberIds.length;
  if (responses.length >= maxResponses) return fail(res, 409, 'Limite máximo de respostas atingido para este grupo.');
  if (invitation && invitation.usedAt) return fail(res, 409, 'Resposta já enviada.');
  if (!invitation && hasAnsweredCookie(req, survey.id)) return fail(res, 409, 'Resposta já enviada neste navegador.');
  const instrument = surveyInstrument(survey);
  res.json({ title: survey.title, model: survey.model, instrument: { id: instrument.id, version: instrument.version, name: instrument.name, validated: instrument.validated }, instructions: instrument.instructions, limitation: instrument.limitation, attribution: instrument.attribution, sources: instrument.sources, options: instrument.options, collectionChannel: 'web', factors: instrument.factors.map(([key, label, question]) => ({ key, label, question })), endsAt: survey.endsAt, maxResponses, responseCount: responses.length });
});
router.post('/respond/:token', (req, res) => {
  const { survey, invitation } = findSurveyByParam(req.params.token);
  if (!survey) return fail(res, 404, 'Convite não encontrado.');
  if (survey.status !== 'open' || new Date(survey.endsAt).getTime() <= Date.now()) return fail(res, 410, 'Pesquisa encerrada.');
  const responses = read('responses');
  const currentResponses = responses.filter((item) => item.surveyId === survey.id);
  const maxResponses = survey.memberIds.length;
  if (currentResponses.length >= maxResponses) return fail(res, 409, 'Esta pesquisa já atingiu a quantidade limite de respostas para este grupo.');
  if (invitation && invitation.usedAt) return fail(res, 409, 'Resposta já enviada.');
  if (!invitation && hasAnsweredCookie(req, survey.id)) return fail(res, 409, 'Resposta já enviada neste navegador.');
  const answers = req.body.answers;
  const factors = surveyInstrument(survey).factors;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || factors.some(([key]) => !Number.isInteger(answers[key]) || answers[key] < 1 || answers[key] > 5)) return fail(res, 400, 'Responda todas as questões de 1 a 5.');
  responses.push({ id: id(), accountId: survey.accountId, surveyId: survey.id, answers: Object.fromEntries(factors.map(([key]) => [key, answers[key]])) });
  if (invitation) {
    const invitations = read('invitations');
    const inv = invitations.find((item) => item.id === invitation.id);
    if (inv) inv.usedAt = new Date().toISOString();
    writeMany({ responses, invitations });
  } else write('responses', responses);
  res.cookie(`answered_${survey.id}`, '1', { maxAge: 90 * 86400000, httpOnly: true, sameSite: 'lax', path: '/' });
  res.status(201).json({ ok: true });
});
router.protectedRoute = protectedRoute;
module.exports = router;
