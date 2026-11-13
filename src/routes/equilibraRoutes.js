const express = require('express');
const crypto = require('node:crypto');
const { read, write, writeMany } = require('../config/equilibraStorage');
const { encryptPhone, decryptPhone } = require('../config/identityCrypto');
const { createTemplate, parseImport, validateImport, validPhone, phoneKey } = require('../services/memberImport');
const router = express.Router();
const { FACTORS, MODELS, TEMPLATES, REFERENCES, instrumentForModel, surveyInstrument, snapshotInstrument } = require('../domain/instruments');
const { aggregate, summarizeDistribution } = require('../domain/analysis');
const { openSurvey, closeSurvey, reissueLinks, getParticipation, extendSurvey, closeExpiredSurveys, openScheduledSurveys } = require('../services/surveyLifecycle');
const { buildCycleReport, preflightSurveyAudience } = require('../domain/reporting');
const exportService = require('../services/reportExportService');
const managementRepo = require('../repositories/managementRepository');
const todayService = require('../services/todayService');
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
  return {
    ...actor,
    id: actor.organizationId || actor.id,
    userId: actor.id,
    role: actor.role || 'owner',
    company: organization.company,
    avatarUrl: actor.avatarUrl || organization.avatarUrl || null
  };
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
const publicAccount = account => ({
  id: account.id,
  userId: account.userId || account.id,
  name: account.name,
  company: account.company,
  email: account.email,
  role: account.role || 'owner',
  avatarUrl: account.avatarUrl || null
});
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
  // For open surveys: count used invitations as participation source of truth
  // (invitations are marked used=true at response submission time, even if responses.json
  //  entry is somehow missing — used invitations represent real answered surveys)
  const usedInvitations = survey.status !== 'closed'
    ? scoped('invitations', accountId).filter(i => i.surveyId === survey.id && i.used === true).length
    : 0;
  const rawCount = survey.status === 'closed'
    ? (survey.responseCount ?? responses.length)
    : Math.max(responses.length, usedInvitations);
  const responseCount = rawCount;
  const totalMembers = survey.memberIds?.length || 0;
  const invitedCount = totalMembers;
  const target = survey.participationTarget || 0.70;
  const pct70 = totalMembers > 0 ? Math.ceil(totalMembers * target) : 0;
  const participationRate = invitedCount > 0 ? responseCount / invitedCount : 0;
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
    invitedCount,
    // responsesCount alias for frontend compatibility (surveysView.js reads this field)
    responsesCount: responseCount,
    responseCount,
    participationRate,
    participationTarget: target,
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
  const accountSurveys = scoped('surveys', accountId);
  const closedSurveys = accountSurveys.filter(s => s.status === 'closed');
  for (const survey of closedSurveys) {
    const existing = reports.find((item) => item.surveyId === survey.id);
    if (!existing) {
      const instrument = surveyInstrument(survey);
      const responses = scoped('responses', accountId).filter((item) => item.surveyId === survey.id);
      const previousReports = reports.filter((item) => item.accountId === accountId && item.surveyId !== survey.id);
      const previousSurveys = accountSurveys.filter((item) => item.id !== survey.id);

      const report = buildCycleReport({
        survey,
        instrument,
        responses,
        previousReports,
        previousSurveys,
        minResults: MIN_RESULTS
      });

      reports.push(report);
      changed = true;
    }
  }
  if (changed) write('reports', reports);
  return reports.filter((item) => item.accountId === accountId).sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}
function closeExpired(accountId, req = null) {
  const check = closeExpiredSurveys(accountId);
  if (check.changed) ensureReports(accountId);
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  openScheduledSurveys(accountId, baseUrl);
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

  const startsAtRaw = clean(req.body.startsAt, 40);
  let startsAt = null;
  if (startsAtRaw) {
    const startsAtTime = new Date(startsAtRaw).getTime();
    if (Number.isFinite(startsAtTime)) {
      startsAt = new Date(startsAtTime).toISOString();
    }
  }

  const memberIds = [...new Set(groups.flatMap(g => g.memberIds))];
  return {
    fields: {
      title,
      cycle,
      model,
      instrument: snapshotInstrument(model),
      collectionChannel: req.body.collectionChannel === 'whatsapp' ? 'whatsapp' : 'web',
      groupIds: groups.map(g => g.id),
      groupId: groups[0].id,
      memberIds,
      startsAt,
      endsAt: new Date(endsAtTime).toISOString()
    }
  };
}
router.get('/auth/invite-info', (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return fail(res, 400, 'Convite inválido ou expirado.');
  }
  const tokenH = hash(token);
  const workspace = read('management').find(row => (row.invitations || []).some(item => item.tokenHash === tokenH && !item.usedAt && item.expiresAt > Date.now()));
  const invitation = workspace?.invitations.find(item => item.tokenHash === tokenH && !item.usedAt && item.expiresAt > Date.now());
  if (!invitation) return fail(res, 404, 'Convite não encontrado ou já expirado.');
  const org = read('accounts').find(a => a.id === workspace.id);
  res.json({
    email: invitation.email,
    role: invitation.role,
    company: org?.company || 'Equilibra',
    expiresAt: invitation.expiresAt
  });
});
router.post('/auth/register', (req, res) => {
  const name = clean(req.body.name);
  let company = clean(req.body.company);
  const address = email(req.body.email);
  const password = req.body.password;
  const accounts = read('accounts');
  if (accounts.some((item) => item.email === address)) return fail(res, 409, 'E-mail já cadastrado.');
  let invitation, workspace;
  if (req.body.invitationToken) {
    if (typeof req.body.invitationToken !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.invitationToken)) return fail(res, 400, 'Convite inválido ou expirado.');
    workspace = read('management').find(row => (row.invitations || []).some(item => item.tokenHash === hash(req.body.invitationToken) && !item.usedAt && item.expiresAt > Date.now() && item.email === address));
    invitation = workspace?.invitations.find(item => item.tokenHash === hash(req.body.invitationToken) && item.email === address && !item.usedAt && item.expiresAt > Date.now());
    if (!invitation) return fail(res, 400, 'Convite inválido ou expirado.');
    try { require('../services/entitlementService').checkUserLimit(workspace.id); } catch (error) { return fail(res, error.status || 400, error.message); }
    if (!company && workspace) {
      const org = accounts.find(a => a.id === workspace.id);
      company = org?.company || 'Equilibra';
    }
  }
  if (!name || !company || !validEmail(address) || typeof password !== 'string' || password.length < 10 || password.length > 128) return fail(res, 400, 'Informe nome, empresa, e-mail válido e senha com 10 a 128 caracteres.');
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
  const name = clean(req.body.name);
  const company = req.body.company ? clean(req.body.company) : req.account.company;
  const address = req.body.email ? email(req.body.email) : req.account.email;
  if (!name || !validEmail(address)) return fail(res, 400, 'Informe seu nome e um e-mail válido.');
  const accounts = read('accounts');
  if (accounts.some((item) => item.id !== req.account.userId && item.email === address)) return fail(res, 409, 'E-mail já cadastrado por outra conta.');
  const account = accounts.find((item) => item.id === req.account.userId);
  if (!account) return fail(res, 404, 'Conta não encontrada.');
  account.name = name;
  if (req.account.role === 'owner' && req.body.company) account.company = company;
  account.email = address;
  if (req.body.avatarUrl !== undefined) {
    account.avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.trim() : null;
  }
  account.updatedAt = new Date().toISOString();
  write('accounts', accounts);
  req.account = currentAccount(req);
  res.json(publicAccount(req.account));
});
router.post('/auth/avatar', protectedRoute, (req, res) => {
  const accounts = read('accounts');
  const account = accounts.find((item) => item.id === req.account.userId);
  if (!account) return fail(res, 404, 'Conta não encontrada.');
  const avatarUrl = typeof req.body.avatarUrl === 'string' && req.body.avatarUrl.trim() ? req.body.avatarUrl.trim() : null;
  account.avatarUrl = avatarUrl;
  account.updatedAt = new Date().toISOString();
  write('accounts', accounts);
  req.account = currentAccount(req);
  res.json({ ok: true, account: publicAccount(req.account) });
});
router.post('/auth/logout', protectedRoute, (req, res) => { write('sessions', read('sessions').filter((item) => item.tokenHash !== hash(cookie(req)))); res.clearCookie('equilibra_session', { path: '/' }); res.status(204).end(); });

router.get('/members', protectedRoute, (req, res) => res.json(req.account.role === 'viewer' ? [] : scoped('members', req.account.id).map(publicMember)));
router.post('/members', protectedRoute, (req, res) => {
  const name = clean(req.body.name, 120), address = req.body.email ? email(req.body.email) : '', phone = req.body.phone ? clean(req.body.phone, 22) : '';
  if (!name && !address) return fail(res, 400, 'Informe ao menos o nome ou e-mail da pessoa.');
  if (address && !validEmail(address)) return fail(res, 400, 'Informe um e-mail válido.');
  if (phone && !validPhone(phone)) return fail(res, 400, 'Informe um telefone válido com DDD (ex: 11987654321).');
  const members = read('members');
  if (address && members.some((item) => item.accountId === req.account.id && item.email === address)) return fail(res, 409, 'Pessoa já cadastrada com este e-mail.');
  if (phone && members.some((item) => item.accountId === req.account.id && decryptPhone(item.phone) && phoneKey(decryptPhone(item.phone)) === phoneKey(phone))) return fail(res, 409, 'Pessoa já cadastrada com este telefone.');
  const registration = clean(req.body.registration, 50);
  const member = { id: id(), accountId: req.account.id, name, email: address, phone: encryptPhone(phone), registration, createdAt: new Date().toISOString() };
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
  const name = clean(req.body.name, 120), address = req.body.email ? email(req.body.email) : '', phone = req.body.phone ? clean(req.body.phone, 25) : '';
  if (!name && !address) return fail(res, 400, 'Informe ao menos o nome ou e-mail da pessoa.');
  if (address && !validEmail(address)) return fail(res, 400, 'Informe um e-mail válido.');
  if (address && members.some((item) => item.id !== member.id && item.accountId === req.account.id && item.email === address)) return fail(res, 409, 'E-mail já cadastrado.');

  let updatedPhone = member.phone;
  if (phone) {
    const currentDecrypted = decryptPhone(member.phone);
    // Se o telefone mudou ou foi fornecido pela primeira vez
    if (phone !== currentDecrypted && (!currentDecrypted || phoneKey(phone) !== phoneKey(currentDecrypted))) {
      if (!validPhone(phone)) return fail(res, 400, 'Informe um telefone válido com DDD (ex: 11987654321).');
      if (members.some((item) => item.id !== member.id && item.accountId === req.account.id && decryptPhone(item.phone) && phoneKey(decryptPhone(item.phone)) === phoneKey(phone))) {
        return fail(res, 409, 'Telefone já cadastrado.');
      }
      updatedPhone = encryptPhone(phone);
    }
  }

  const registration = clean(req.body.registration, 50);
  Object.assign(member, { name, email: address, phone: updatedPhone, registration });
  write('members', members);

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
  const nextMembers = members.filter((item) => item.id !== member.id);
  const groups = read('groups');
  for (const group of groups) if (group.accountId === req.account.id) group.memberIds = group.memberIds.filter((mId) => mId !== member.id);
  writeMany({ members: nextMembers, groups });
  res.status(204).end();
});

// Bulk delete members
router.delete('/members', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem excluir colaboradores.');
  const ids = req.body && req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) return fail(res, 400, 'Informe os IDs dos colaboradores a excluir.');

  const members = read('members');
  const toDelete = members.filter(m => ids.includes(m.id) && m.accountId === req.account.id);
  if (toDelete.length === 0) return fail(res, 404, 'Nenhum colaborador encontrado para exclusão.');

  const deletedIds = toDelete.map(m => m.id);
  const nextMembers = members.filter(m => !(deletedIds.includes(m.id) && m.accountId === req.account.id));

  const groups = read('groups');
  for (const group of groups) {
    if (group.accountId === req.account.id) {
      group.memberIds = group.memberIds.filter(mId => !deletedIds.includes(mId));
    }
  }
  writeMany({ members: nextMembers, groups });

  res.json({ ok: true, deleted: deletedIds.length });
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
  } catch (error) { return fail(res, error.status || 400, error.message); }
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
  const nextGroups = groups.filter((item) => item.id !== group.id);
  const members = read('members');
  let membersChanged = false;
  for (const m of members) {
    if (m.accountId === req.account.id && Array.isArray(m.groupIds) && m.groupIds.includes(group.id)) {
      m.groupIds = m.groupIds.filter(gid => gid !== group.id);
      membersChanged = true;
    }
  }
  if (membersChanged) {
    writeMany({ groups: nextGroups, members });
  } else {
    write('groups', nextGroups);
  }
  res.status(204).end();
});

router.get('/meta', protectedRoute, (req, res) => res.json({
  factors: FACTORS,
  models: TEMPLATES.map(row => row.name),
  templates: TEMPLATES,
  references: REFERENCES,
  collectionChannel: 'web',
  minResults: MIN_RESULTS,
  account: { companyName: req.account?.company || '' }
}));

router.put('/meta/account', protectedRoute, (req, res) => {
  const companyName = clean(req.body.companyName || req.body.company);
  if (!companyName) return fail(res, 400, 'Informe o nome da empresa.');
  const accounts = read('accounts');
  const org = accounts.find((item) => item.id === req.account.id);
  if (!org) return fail(res, 404, 'Organização não encontrada.');
  org.company = companyName;
  org.updatedAt = new Date().toISOString();
  const user = accounts.find((item) => item.id === req.account.userId);
  if (user && user.id !== org.id) {
    user.company = companyName;
    user.updatedAt = new Date().toISOString();
  }
  write('accounts', accounts);
  req.account = currentAccount(req);
  res.json({ ok: true, companyName, account: publicAccount(req.account) });
});

router.delete('/auth/me', protectedRoute, (req, res) => {
  if (req.account.role !== 'owner') {
    return fail(res, 403, 'Apenas o proprietário da conta pode excluir a organização.');
  }
  const accountId = req.account.id;
  const userId = req.account.userId;

  const allSurveys = read('surveys');
  const accountSurveys = allSurveys.filter(s => s.accountId === accountId);
  const surveyIds = accountSurveys.map(s => s.id);

  const accounts = read('accounts').filter(a => a.id !== accountId && a.organizationId !== accountId && a.id !== userId);
  const members = read('members').filter(m => m.accountId !== accountId);
  const groups = read('groups').filter(g => g.accountId !== accountId);
  const surveys = allSurveys.filter(s => s.accountId !== accountId);
  const invitations = read('invitations').filter(i => !surveyIds.includes(i.surveyId));
  const responses = read('responses').filter(r => !surveyIds.includes(r.surveyId));
  const reports = read('reports').filter(rp => rp.accountId !== accountId && !surveyIds.includes(rp.surveyId));
  const sessions = read('sessions').filter(s => s.accountId !== accountId && s.accountId !== userId);
  const management = read('management').filter(m => m.id !== accountId);

  writeMany({
    accounts,
    members,
    groups,
    surveys,
    invitations,
    responses,
    reports,
    sessions,
    management
  });

  res.clearCookie('equilibra_session', { path: '/' });
  res.status(204).end();
});

router.get('/surveys', protectedRoute, (req, res) => { closeExpired(req.account.id, req); res.json(scoped('surveys', req.account.id).filter(item => !item.archivedAt).map((item) => surveySummary(item, req.account.id)).reverse()); });
router.post('/surveys', protectedRoute, async (req, res) => {
  const validation = validateSurveyInput(req, req.account.id);
  if (validation.error) return fail(res, 400, validation.error);
  const fields = validation.fields;

  if (fields.collectionChannel === 'whatsapp') {
    const { healthCheck } = require('../services/whatsappGateway');
    const waStatus = await healthCheck(req.account.id);
    if (!waStatus.connected) {
      return fail(res, 400, 'WhatsApp não está conectado. Conecte o aparelho via QR Code antes de criar uma pesquisa com este canal.');
    }
  }

  const surveys = read('surveys'), survey = { id: id(), accountId: req.account.id, ...fields, status: 'draft', createdAt: new Date().toISOString() };
  surveys.push(survey); write('surveys', surveys); res.status(201).json(surveySummary(survey, req.account.id));
});
router.put('/surveys/:id', protectedRoute, async (req, res) => {
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'draft') return fail(res, 409, 'Somente rascunhos podem ser editados.');
  const validation = validateSurveyInput(req, req.account.id);
  if (validation.error) return fail(res, 400, validation.error);

  if (validation.fields.collectionChannel === 'whatsapp') {
    const { healthCheck } = require('../services/whatsappGateway');
    const waStatus = await healthCheck(req.account.id);
    if (!waStatus.connected) {
      return fail(res, 400, 'WhatsApp não está conectado. Conecte o aparelho via QR Code antes de definir este canal.');
    }
  }

  Object.assign(survey, validation.fields); write('surveys', surveys); res.json(surveySummary(survey, req.account.id));
});
router.put('/surveys/:id/dates', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem alterar datas de pesquisas.');
  const surveys = read('surveys');
  const survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status === 'closed') return fail(res, 409, 'Não é possível alterar datas de uma pesquisa já encerrada.');

  const { startsAt, endsAt, cycle, title, reason } = req.body || {};

  if (cycle) survey.cycle = clean(cycle, 80);
  if (title) survey.title = clean(title, 120);

  if (endsAt) {
    const endsAtTime = new Date(endsAt).getTime();
    if (!Number.isFinite(endsAtTime) || endsAtTime <= Date.now()) {
      return fail(res, 400, 'A data de encerramento deve ser no futuro.');
    }
    if (survey.status === 'open' && endsAt !== survey.endsAt) {
      survey.extensions = survey.extensions || [];
      survey.extensions.push({
        previousEndsAt: survey.endsAt,
        newEndsAt: endsAt,
        extendedAt: new Date().toISOString(),
        reason: (reason || '').trim() || 'Alteração de prazo'
      });
    }
    survey.endsAt = new Date(endsAtTime).toISOString();
  }

  if (startsAt !== undefined) {
    if (survey.status === 'draft') {
      if (startsAt) {
        const startsAtTime = new Date(startsAt).getTime();
        if (!Number.isFinite(startsAtTime)) {
          return fail(res, 400, 'Data de início inválida.');
        }
        survey.startsAt = new Date(startsAtTime).toISOString();
      } else {
        survey.startsAt = null;
      }
    }
  }

  if (survey.startsAt && survey.endsAt && new Date(survey.endsAt).getTime() <= new Date(survey.startsAt).getTime()) {
    return fail(res, 400, 'A data de encerramento deve ser posterior à data de início.');
  }

  write('surveys', surveys);

  // Se agendada para início agora ou no passado, abre a pesquisa imediatamente
  if (survey.status === 'draft' && survey.startsAt && new Date(survey.startsAt).getTime() <= Date.now()) {
    const opened = openSurvey({ surveyId: survey.id, accountId: req.account.id, baseUrl: `${req.protocol}://${req.get('host')}` });
    if (opened && opened.ok) {
      return res.json(surveySummary(opened.survey, req.account.id));
    }
  }

  res.json(surveySummary(survey, req.account.id));
});
router.delete('/surveys/:id', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem excluir pesquisas.');
  const surveys = read('surveys'), survey = surveys.find((item) => item.id === req.params.id && item.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');

  // Remove a pesquisa da lista
  const nextSurveys = surveys.filter((item) => item.id !== survey.id);

  // Limpa convites e respostas individuais associados
  const invitations = read('invitations').filter((item) => item.surveyId !== survey.id);
  const responses = read('responses').filter((item) => item.surveyId !== survey.id);

  const changes = {
    surveys: nextSurveys,
    invitations,
    responses
  };

  // Se explicitamente solicitado a exclusão de laudos consolidados
  if (req.query.includeReports === 'true') {
    changes.reports = read('reports').filter((item) => item.surveyId !== survey.id);
  }

  writeMany(changes);
  res.status(204).end();
});

// Bulk delete surveys
router.delete('/surveys', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Sem permissão para excluir pesquisas.');
  const ids = req.body && req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) return fail(res, 400, 'Informe os IDs das pesquisas a excluir.');

  const surveys = read('surveys');
  const toDelete = surveys.filter(s => ids.includes(s.id) && s.accountId === req.account.id);
  if (toDelete.length === 0) return fail(res, 404, 'Nenhuma pesquisa encontrada para exclusão.');

  const deletedIds = toDelete.map(s => s.id);
  const nextSurveys = surveys.filter(s => !(deletedIds.includes(s.id) && s.accountId === req.account.id));
  const invitations = read('invitations').filter(i => !deletedIds.includes(i.surveyId));
  const responses = read('responses').filter(r => !deletedIds.includes(r.surveyId));

  const changes = {
    surveys: nextSurveys,
    invitations,
    responses
  };

  if (req.query.includeReports === 'true') {
    changes.reports = read('reports').filter(rp => !deletedIds.includes(rp.surveyId));
  }

  writeMany(changes);
  res.json({ ok: true, deleted: deletedIds.length });
});

router.get('/surveys/preflight', protectedRoute, (req, res) => {
  const groupIds = (req.query.groupIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const accountGroups = scoped('groups', req.account.id);
  const closedSurveys = scoped('surveys', req.account.id).filter(s => s.status === 'closed');
  const result = preflightSurveyAudience({
    groupIds,
    accountGroups,
    closedSurveys,
    minResults: MIN_RESULTS
  });
  res.json(result);
});

router.get('/whatsapp/status', protectedRoute, async (req, res) => {
  try {
    const { healthCheck } = require('../services/whatsappGateway');
    const status = await healthCheck(req.account.id);
    res.json(status);
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

router.get('/whatsapp/qr', protectedRoute, async (req, res) => {
  try {
    let client = null;
    try { client = require('../services/whatsappLocalClient'); } catch {}
    const accountId = req.account.id;

    if (client) {
      const current = client.getStatus(accountId);
      // Inicia a sessão sob demanda se o operador ainda não estiver conectado nem conectando
      if (!current.connected && !current.connecting) {
        client.initWhatsAppClient(accountId).catch((err) => {
          console.error(`[WA-QR] Falha iniciando cliente para conta ${accountId}:`, err.message);
        });
      }
    }

    const status = client ? client.getStatus(accountId) : { connected: false };
    let qrDataUrl = null;
    if (status.lastQr) {
      try {
        const QRCode = require('qrcode');
        qrDataUrl = await QRCode.toDataURL(status.lastQr, { width: 280, margin: 2 });
      } catch (qrErr) {
        console.error('[WA-QR] Erro gerando DataURL:', qrErr.message);
      }
    }
    res.json({
      connected: Boolean(status.connected),
      connecting: Boolean(status.connecting),
      phone: status.user?.id ? status.user.id.split(':')[0] : null,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whatsapp/reset', protectedRoute, async (req, res) => {
  try {
    let client = null;
    try { client = require('../services/whatsappLocalClient'); } catch {}
    if (client && client.resetAuth) {
      await client.resetAuth(req.account.id);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/surveys/:id/dispatch-whatsapp', protectedRoute, async (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem disparar pesquisas.');
  const surveys = read('surveys');
  const survey = surveys.find((s) => s.id === req.params.id && s.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'open') return fail(res, 409, 'Apenas pesquisas abertas podem ter mensagens enviadas.');

  const { healthCheck } = require('../services/whatsappGateway');
  const waStatus = await healthCheck(req.account.id);
  if (!waStatus.connected) {
    return fail(res, 400, 'WhatsApp não está conectado. Conecte o aparelho via QR Code antes de disparar convites.');
  }

  const customMessage = req.body && req.body.customMessage;
  if (customMessage) {
    if (typeof customMessage !== 'string' || !customMessage.includes('{link}')) {
      return fail(res, 400, 'A mensagem personalizada deve conter obrigatoriamente a marcação {link}.');
    }
  }

  const invitations = scoped('invitations', req.account.id).filter((inv) => inv.surveyId === survey.id && !inv.used);
  if (invitations.length === 0) return fail(res, 400, 'Não há convites pendentes para envio.');

  const members = scoped('members', req.account.id);
  const { dispatchSurveyViaWhatsApp } = require('../services/whatsappSurveyService');
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const allInvitations = read('invitations');
  const links = [];
  for (const inv of invitations) {
    const member = members.find((m) => m.id === inv.memberId);
    if (member) {
      // Gera token seguro e atualiza o hash do convite pendente para permitir a submissão correta
      const token = crypto.randomBytes(24).toString('hex');
      const invInStore = allInvitations.find((item) => item.id === inv.id);
      if (invInStore) {
        invInStore.tokenHash = hash(token);
      }
      links.push({
        memberId: member.id,
        name: member.name,
        phone: member.phone || '',
        segmentId: inv.segmentId,
        token,
        link: `${baseUrl}/responder/${token}`
      });
    }
  }

  write('invitations', allInvitations);
  survey.collectionChannel = 'whatsapp';
  if (customMessage) {
    survey.whatsappMessageTemplate = customMessage;
  }
  write('surveys', surveys);

  const result = await dispatchSurveyViaWhatsApp(survey, links, customMessage);
  const userMessage = (result.dispatched === 0 && result.errors > 0)
    ? `Falha no envio: WhatsApp não está conectado ou houve erro nos números. Verifique o status do aparelho.`
    : `Disparo concluído: ${result.dispatched} mensagens enviadas, ${result.skipped} ignoradas (sem telefone), ${result.errors} erros.`;

  res.json({
    ok: result.dispatched > 0,
    message: userMessage,
    ...result
  });
});

router.post('/surveys/:id/dispatch-email', protectedRoute, async (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem disparar e-mails.');
  const surveys = read('surveys');
  const survey = surveys.find((s) => s.id === req.params.id && s.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  if (survey.status !== 'open') return fail(res, 409, 'Apenas pesquisas abertas permitem envio de convites.');

  const invitations = scoped('invitations', req.account.id).filter((inv) => inv.surveyId === survey.id && !inv.used);
  if (invitations.length === 0) return fail(res, 400, 'Não há convites pendentes para envio.');

  const members = scoped('members', req.account.id);
  const { dispatchSurveyViaEmail } = require('../services/emailService');
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const allInvitations = read('invitations');
  const links = [];
  for (const inv of invitations) {
    const member = members.find((m) => m.id === inv.memberId);
    if (member) {
      const token = crypto.randomBytes(24).toString('hex');
      const invInStore = allInvitations.find((item) => item.id === inv.id);
      if (invInStore) {
        invInStore.tokenHash = hash(token);
      }
      links.push({
        memberId: member.id,
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        segmentId: inv.segmentId,
        token,
        link: `${baseUrl}/responder/${token}`
      });
    }
  }

  write('invitations', allInvitations);

  const result = await dispatchSurveyViaEmail(survey, links);
  let userMessage;
  if (result.dispatched === 0 && result.skipped > 0 && result.errors === 0) {
    userMessage = `Nenhum e-mail enviado: ${result.skipped} colaboradores selecionados não possuem e-mail cadastrado. Atualize o cadastro em Pessoas.`;
  } else if (result.dispatched === 0 && result.errors > 0) {
    userMessage = `Falha no envio de e-mails: ${result.error || 'Erro desconhecido'}.`;
  } else {
    userMessage = `Envio concluído: ${result.dispatched} convites enviados por e-mail, ${result.skipped} ignorados (sem e-mail cadastrado), ${result.errors} falhas.`;
  }

  res.json({
    ok: result.dispatched > 0,
    message: userMessage,
    ...result
  });
});

router.post('/surveys/:id/open', protectedRoute, async (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem abrir pesquisas.');

  const surveys = read('surveys');
  const targetSurvey = surveys.find((s) => s.id === req.params.id && s.accountId === req.account.id);
  if (!targetSurvey) return fail(res, 404, 'Pesquisa não encontrada.');

  const channel = req.body?.collectionChannel || targetSurvey.collectionChannel || 'web';
  if (channel === 'whatsapp') {
    const { healthCheck } = require('../services/whatsappGateway');
    const waStatus = await healthCheck(req.account.id);
    if (!waStatus.connected) {
      return fail(res, 400, 'WhatsApp não está conectado. Conecte o aparelho via QR Code antes de abrir a pesquisa por este canal.');
    }
  }

  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const result = openSurvey({
    surveyId: req.params.id,
    accountId: req.account.id,
    baseUrl,
    channel: req.body?.collectionChannel || null
  });
  if (result.error) return fail(res, result.status, result.message);

  let dispatchResult = null;
  if (result.dispatchPromise) {
    try {
      dispatchResult = await result.dispatchPromise;
    } catch (err) {
      console.error('[OPEN-SURVEY-DISPATCH-ERR]', err.message);
    }
  }

  res.json({
    survey: surveySummary(result.survey, req.account.id),
    link: result.link,
    links: result.links,
    dispatchResult
  });
});

router.post('/surveys/:id/reissue', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem reemitir links.');
  const result = reissueLinks({
    surveyId: req.params.id,
    accountId: req.account.id,
    baseUrl: `${req.protocol}://${req.get('host')}`
  });
  if (result.error) return fail(res, result.status, result.message);
  res.json(result);
});

router.get('/surveys/:id/invitation-links/export', protectedRoute, (req, res) => {
  const survey = read('surveys').find(s => s.id === req.params.id && s.accountId === req.account.id);
  if (!survey) return fail(res, 404, 'Pesquisa não encontrada.');
  const invitations = scoped('invitations', req.account.id).filter(inv => inv.surveyId === survey.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const lines = ['Segmento;Link de Acesso Individual;Status'];
  for (const inv of invitations) {
    const status = inv.used ? 'Respondido' : 'Pendente';
    const link = `${baseUrl}/responder/${inv.token}`;
    lines.push(`"${inv.segmentName || 'Geral'}";"${link}";"${status}"`);
  }
  const csv = '\uFEFF' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="convites-${survey.id}.csv"`);
  res.send(csv);
});

router.get('/surveys/:id/participation', protectedRoute, (req, res) => {
  const result = getParticipation({
    surveyId: req.params.id,
    accountId: req.account.id
  });
  if (result.error) return fail(res, result.status, result.message);
  res.json(result);
});

router.post('/surveys/:id/extend', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem prorrogar prazos.');
  const result = extendSurvey({
    surveyId: req.params.id,
    accountId: req.account.id,
    newEndsAt: req.body.newEndsAt || req.body.endsAt,
    reason: req.body.reason
  });
  if (result.error) return fail(res, result.status, result.message);
  res.json(surveySummary(result.survey, req.account.id));
});

router.post('/surveys/:id/close', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem encerrar pesquisas.');
  const result = closeSurvey({
    surveyId: req.params.id,
    accountId: req.account.id,
    confirmEarlyClose: Boolean(req.body.confirmEarlyClose),
    reason: req.body.reason
  });
  if (result.error) {
    return res.status(result.status || 409).json(result);
  }
  const responses = scoped('responses', req.account.id).filter((r) => r.surveyId === result.survey.id);
  const surveys = read('surveys');
  const targetSurvey = surveys.find((s) => s.id === result.survey.id);
  if (targetSurvey) {
    targetSurvey.result = publishableAggregate(targetSurvey, responses);
    write('surveys', surveys);
  }
  const reports = ensureReports(req.account.id);
  const report = reports.find((r) => r.surveyId === result.survey.id);
  const summary = surveySummary(targetSurvey || result.survey, req.account.id);
  res.json({ ...summary, reportId: report?.id });
});

router.get('/reports', protectedRoute, (req, res) => {
  closeExpired(req.account.id, req);
  res.json(ensureReports(req.account.id));
});

router.get('/reports/:id', protectedRoute, (req, res) => {
  ensureReports(req.account.id);
  const reports = scoped('reports', req.account.id);
  const report = reports.find(r => r.id === req.params.id || r.surveyId === req.params.id);
  if (!report) return fail(res, 404, 'Relatório não encontrado.');
  res.json(report);
});

router.get('/reports/history/export', protectedRoute, async (req, res) => {
  ensureReports(req.account.id);
  const reports = scoped('reports', req.account.id);
  const buffer = await exportService.generateHistoryXlsx(reports, req.account);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `equilibra-historico-ciclos-${dateStr}.xlsx`;
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': String(buffer.length)
  });
  return res.send(Buffer.from(buffer));
});

router.get('/reports/:id/export', protectedRoute, async (req, res) => {
  ensureReports(req.account.id);
  const reports = scoped('reports', req.account.id);
  const report = reports.find(r => r.id === req.params.id || r.surveyId === req.params.id);
  if (!report) return fail(res, 404, 'Relatório não encontrado.');

  const format = (req.query.format || 'json').toLowerCase();
  exportService.logExportAudit(req.account, report, format);

  if (format === 'csv') {
    const csv = exportService.generateCsv(report);
    const fileName = exportService.getExportFileName(report, 'csv');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    return res.send(csv);
  }

  if (format === 'xlsx') {
    const buffer = await exportService.generateXlsx(report);
    const fileName = exportService.getExportFileName(report, 'xlsx');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length)
    });
    return res.send(Buffer.from(buffer));
  }

  if (format === 'pdf') {
    const buffer = await exportService.generatePdf(report, req.account);
    const fileName = exportService.getExportFileName(report, 'pdf');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length)
    });
    return res.send(buffer);
  }

  if (format === 'json') {
    const json = exportService.generateJson(report);
    const fileName = exportService.getExportFileName(report, 'json');
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    return res.json(json);
  }

  return fail(res, 400, 'Formato de exportação inválido. Utilize pdf, xlsx, csv ou json.');
});

router.post('/reports/:id/accept', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem registrar o aceite do relatório.');
  const reports = read('reports');
  const report = reports.find(r => (r.id === req.params.id || r.surveyId === req.params.id) && r.accountId === req.account.id);
  if (!report) return fail(res, 404, 'Relatório não encontrado.');

  const acceptance = {
    userId: req.account.userId || req.account.id,
    userName: req.body?.acceptedBy || req.account.name || 'Responsável RH/SST',
    acceptedBy: req.body?.acceptedBy || req.account.name || 'Responsável RH/SST',
    notes: req.body?.notes || '',
    acceptedAt: new Date().toISOString(),
    instrumentVersion: report.instrument?.version || 1,
    reportVersion: report.schemaVersion || 2,
    statement: "Reconheço que o PGR e as medidas são de responsabilidade da empresa e que o Equilibra é uma ferramenta de apoio."
  };

  report.acceptance = acceptance;
  report.formalAcceptance = acceptance;
  write('reports', reports);

  try {
    managementRepo.transaction(req.account, 'report.accepted', () => ({
      id: report.id,
      surveyId: report.surveyId,
      acceptance
    }));
  } catch (err) {
    console.error('Erro na auditoria de aceite:', err.message);
  }

  res.json({ ok: true, report, acceptance, formalAcceptance: acceptance });
});

router.post('/reports/:id/reevaluate', protectedRoute, (req, res) => {
  if (req.account.role === 'viewer') return fail(res, 403, 'Apenas administradores podem reavaliar relatórios.');
  const reports = read('reports');
  const report = reports.find(r => (r.id === req.params.id || r.surveyId === req.params.id) && r.accountId === req.account.id);
  if (!report) return fail(res, 404, 'Relatório não encontrado.');

  const hasGenFailed = report.publication?.reasons?.some(r => r.code === 'generation_failed');
  if (!hasGenFailed && report.publication?.status !== 'pending') {
    return fail(res, 400, 'Apenas relatórios com falha técnica de processamento podem ser reavaliados. Relatórios protegidos por regras de privacidade e sigilo não podem ser alterados.');
  }

  const surveys = scoped('surveys', req.account.id);
  const survey = surveys.find(s => s.id === report.surveyId);
  if (!survey) return fail(res, 404, 'Pesquisa do relatório não encontrada.');

  const instrument = surveyInstrument(survey);
  const responses = scoped('responses', req.account.id).filter(item => item.surveyId === survey.id);
  const previousReports = reports.filter(item => item.accountId === req.account.id && item.surveyId !== survey.id);
  const previousSurveys = surveys.filter(item => item.id !== survey.id);

  const newReport = buildCycleReport({
    survey,
    instrument,
    responses,
    previousReports,
    previousSurveys,
    minResults: MIN_RESULTS
  });

  const idx = reports.findIndex(r => r.id === report.id);
  reports[idx] = newReport;
  write('reports', reports);

  res.json(newReport);
});

router.get('/dashboard', protectedRoute, (req, res) => {
  closeExpired(req.account.id, req);
  const surveys = scoped('surveys', req.account.id).map((item) => surveySummary(item, req.account.id));
  const published = surveys.filter((item) => item.result).sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  const responses = scoped('responses', req.account.id).filter((item) => published.some((survey) => survey.id === item.surveyId));
  const groups = scoped('groups', req.account.id);
  res.json({
    members: scoped('members', req.account.id).length,
    groups: groups.length,
    customGroups: groups.filter((item) => !item.isDefault).length,
    surveys: surveys.length,
    open: surveys.filter((item) => item.status === 'open').length,
    closed: surveys.filter((item) => item.status === 'closed').length,
    published: published.length,
    responseCount: responses.length,
    result: published[0]?.result || null,
    latestCycle: published[0]?.cycle || null,
    recent: published.slice(0, 3).map((item) => ({ id: item.id, title: item.title, cycle: item.cycle, groupName: item.groupName, responseCount: item.responseCount }))
  });
});

router.get('/today', protectedRoute, (req, res) => {
  closeExpired(req.account.id, req);
  ensureReports(req.account.id);

  const surveys = scoped('surveys', req.account.id).map(item => surveySummary(item, req.account.id));
  const reports = scoped('reports', req.account.id);
  const members = scoped('members', req.account.id);
  const groups = scoped('groups', req.account.id);

  let assessments = [];
  let actions = [];
  try {
    const mgmt = managementRepo.get(req.account.id);
    assessments = mgmt.assessments || [];
    actions = mgmt.actions || [];
  } catch (err) {
    console.error('Erro ao ler workspace de gestão para /today:', err.message);
  }

  const result = todayService.computeDecisionQueue(req.account, {
    surveys,
    reports,
    assessments,
    actions,
    members,
    groups
  });

  res.json(result);
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

router.get(['/respond/:token', '/responder/:token'], (req, res) => {
  const { survey, invitation } = findSurveyByParam(req.params.token);
  if (!survey) return fail(res, 404, 'Convite não encontrado.');
  if (survey.status !== 'open' || new Date(survey.endsAt).getTime() <= Date.now()) return fail(res, 410, 'Pesquisa encerrada.');
  const responses = read('responses').filter((item) => item.surveyId === survey.id);
  const maxResponses = survey.memberIds.length;
  if (responses.length >= maxResponses) return fail(res, 409, 'Limite máximo de respostas atingido para este grupo.');
  if (invitation && (invitation.used || invitation.usedAt)) return fail(res, 409, 'Resposta já enviada.');
  if (!invitation && hasAnsweredCookie(req, survey.id)) return fail(res, 409, 'Resposta já enviada neste navegador.');
  const instrument = surveyInstrument(survey);
  res.json({
    title: survey.title,
    model: survey.model,
    instrument: { id: instrument.id, version: instrument.version, name: instrument.name, validated: instrument.validated },
    instructions: instrument.instructions,
    limitation: instrument.limitation,
    attribution: instrument.attribution,
    sources: instrument.sources,
    options: instrument.options,
    collectionChannel: 'web',
    factors: instrument.factors.map(([key, label, question]) => ({ key, label, question })),
    endsAt: survey.endsAt,
    maxResponses,
    responseCount: responses.length,
    isInvite: Boolean(invitation),
    groupName: survey.groupNamesSnapshot?.join(', ') || 'Geral'
  });
});

router.post(['/respond/:token', '/responder/:token'], (req, res) => {
  const { survey, invitation } = findSurveyByParam(req.params.token);
  if (!survey) return fail(res, 404, 'Convite não encontrado.');
  if (survey.status !== 'open' || new Date(survey.endsAt).getTime() <= Date.now()) return fail(res, 410, 'Pesquisa encerrada.');
  const responses = read('responses');
  const currentResponses = responses.filter((item) => item.surveyId === survey.id);
  const maxResponses = survey.memberIds.length;
  if (currentResponses.length >= maxResponses) return fail(res, 409, 'Esta pesquisa já atingiu a quantidade limite de respostas para este grupo.');
  if (invitation && (invitation.used || invitation.usedAt)) return fail(res, 409, 'Resposta já enviada.');
  if (!invitation && hasAnsweredCookie(req, survey.id)) return fail(res, 409, 'Resposta já enviada neste navegador.');
  const answers = req.body.answers;
  const factors = surveyInstrument(survey).factors;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || factors.some(([key]) => !Number.isInteger(answers[key]) || answers[key] < 1 || answers[key] > 5)) {
    return fail(res, 400, 'Responda todas as questões de 1 a 5.');
  }

  const segmentId = invitation ? invitation.segmentId : (req.body.segmentId || null);
  const submittedDay = new Date().toISOString().slice(0, 10);
  const newResponse = {
    id: id(),
    accountId: survey.accountId,
    surveyId: survey.id,
    segmentId,
    submittedDay,
    answers: Object.fromEntries(factors.map(([key]) => [key, answers[key]]))
  };

  // Embaralha posição no array para impedir correlação por ordem
  const insertIndex = Math.floor(Math.random() * (responses.length + 1));
  responses.splice(insertIndex, 0, newResponse);

  if (invitation) {
    const invitations = read('invitations');
    const inv = invitations.find((item) => item.id === invitation.id);
    if (inv) {
      inv.used = true;
      inv.usedDay = submittedDay;
      delete inv.usedAt;
    }
    writeMany({ responses, invitations });
  } else {
    write('responses', responses);
  }
  res.cookie(`answered_${survey.id}`, '1', { maxAge: 90 * 86400000, httpOnly: true, sameSite: 'lax', path: '/' });
  res.status(201).json({ ok: true });
});
router.protectedRoute = protectedRoute;
module.exports = router;
