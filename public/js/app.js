const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const state = {
  account: null, members: [], groups: [], surveys: [], reports: [],
  dashboard: null, meta: null, management: null, tab: 'geral', authMode: 'login',
  editing: null, invitationLinks: null, importFile: null,
  filterGroupId: null, surveyWizard: null, activeSurveyDashboardId: null
};

// ── Palette of 12 distinct accessible hues ──
const GROUP_COLORS = [
  '#2E7D52', '#1A5F9E', '#A0522D', '#7B3F9E',
  '#C0392B', '#D4850A', '#1A7A72', '#5B5EA6',
  '#B5451B', '#2874A6', '#6B6B00', '#7D3C6B'
];

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = (v) => v ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(v)) : '—';
const fmt = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);
const attr = (v) => esc(v);
const statusLabel = { draft: 'Rascunho', open: 'Em coleta', closed: 'Encerrada' };

let toastTimer;
function message(text, error = false) {
  toast.textContent = text; toast.className = `toast show ${error ? 'error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.className = 'toast', 5000);
}
async function api(url, opts = {}) {
  const res = await fetch(`/api${url}`, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    if (res.status === 401 && state.account && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      state.account = null;
      location.hash = 'login';
      render();
      message('Sua sessão expirou. Faça login novamente.', true);
    }
    throw new Error(b.error || 'Não foi possível concluir.');
  }
  return res.status === 204 ? null : res.json();
}
const post = (url, body = {}) => api(url, { method: 'POST', body: JSON.stringify(body) });
const put  = (url, body)      => api(url, { method: 'PUT',  body: JSON.stringify(body) });
const del  = (url)            => api(url, { method: 'DELETE' });
function formData(form) { return Object.fromEntries(new FormData(form)); }

async function load() {
  state.loading = true;
  try {
  const [members, groups, surveys, reports, dashboard, meta, management] = await Promise.all([
    api('/members'), api('/groups'), api('/surveys'), api('/reports'), api('/dashboard'), api('/meta'), api('/management/workspace')
  ]);
  Object.assign(state, { members, groups, surveys, reports, dashboard, meta, management });
  } finally { state.loading = false; }
  render();
}

// ── Color helpers ──
function groupColor(group) { return group?.color || '#6B7280'; }
function groupBg(group)    { return group?.color ? group.color + '18' : '#F3F4F6'; }
function groupTagStyle(group) {
  if (!group?.color) return '';
  const c = group.color;
  return `style="background:${c}1a;color:${c};border-color:${c}33;"`;
}

// ── Group tag rendering ──
function groupTag(group) {
  const c = group?.color;
  const dot = c ? `<span class="tag-group-dot" style="background:${c};"></span>` : '';
  return `<span class="tag-group" ${groupTagStyle(group)}>${dot}${esc(group.name)}</span>`;
}

// ── Group filter dropdown ──
function groupFilterBar(activeGroupId) {
  if (state.groups.length <= 1) return ''; // só Geral, sem filtro
  const activeGroup = state.groups.find(g => g.id === activeGroupId);
  const activeColor = activeGroup?.color || '';
  const activeLabel = activeGroup ? activeGroup.name : 'Todos os grupos';
  const totalCount = state.members.length;

  return `
    <div class="group-filter-bar">
      <label class="filter-select-label" for="filter-dropdown-trigger">Filtrar por grupo:</label>
      <div class="filter-control-wrap">
        <div class="custom-dropdown" id="group-filter-dropdown">
          <button type="button"
                  class="custom-dropdown-trigger"
                  id="filter-dropdown-trigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  aria-label="Filtrar colaboradores por grupo">
            <span class="dropdown-trigger-dot"
                  id="filter-trigger-dot"
                  style="background:${attr(activeColor)}; display:${activeColor ? 'inline-block' : 'none'};"></span>
            <span class="dropdown-trigger-text" id="filter-dropdown-label">${esc(activeLabel)}</span>
            <svg class="dropdown-chevron" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div class="custom-dropdown-menu" id="filter-dropdown-menu" role="listbox" tabindex="-1">
            <div class="custom-dropdown-item ${!activeGroupId ? 'selected' : ''}"
                 data-value=""
                 data-color=""
                 data-name="Todos os grupos"
                 role="option"
                 aria-selected="${!activeGroupId}">
              <span class="dropdown-item-name">Todos os grupos</span>
              <span class="dropdown-item-badge">${totalCount}</span>
              <span class="dropdown-item-check">${!activeGroupId ? '✓' : ''}</span>
            </div>
            <div class="custom-dropdown-divider"></div>
            ${state.groups.map(g => {
              const isSelected = activeGroupId === g.id;
              const gColor = g.color || '#6B7280';
              const count = g.memberIds.length;
              return `
                <div class="custom-dropdown-item ${isSelected ? 'selected' : ''}"
                     data-value="${attr(g.id)}"
                     data-color="${attr(gColor)}"
                     data-name="${attr(g.name)}"
                     data-count="${count}"
                     role="option"
                     aria-selected="${isSelected}">
                  <span class="dropdown-item-dot" style="background:${gColor};"></span>
                  <span class="dropdown-item-name">${esc(g.name)}</span>
                  <span class="dropdown-item-badge">${count}</span>
                  <span class="dropdown-item-check">${isSelected ? '✓' : ''}</span>
                </div>`;
            }).join('')}
          </div>

          <!-- Hidden select for accessibility and programmatic fallback -->
          <select id="group-filter-select" class="visually-hidden-filter-select" tabindex="-1" aria-hidden="true">
            <option value="">Todos os grupos</option>
            ${state.groups.map(g => {
              const selected = activeGroupId === g.id ? 'selected' : '';
              return `<option value="${attr(g.id)}" ${selected}>${esc(g.name)}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    </div>`;
}

function auth() {
  if (state.account) {
    state.tab = 'geral';
    location.hash = 'geral';
    return render();
  }
  const registering = state.authMode === 'register';
  app.innerHTML = `<main class="auth-page"><section class="auth-brand"><a class="logo light" href="#geral">e<span>·</span>equilibra</a><div class="auth-brand-copy"><p class="eyebrow light-text">ESCUTA E AÇÕES</p><h1>Entenda o trabalho.<br><em>Cuide do coletivo.</em></h1><p>Organize pessoas, grupos e ciclos. Acompanhe sinais coletivos com clareza.</p></div><div class="brand-foot">Escuta, decisões e ações acompanháveis.</div></section><section class="auth-panel"><div class="auth-box"><div class="auth-mobile-logo logo">e<span>·</span>equilibra</div><p class="eyebrow">ÁREA ADMINISTRATIVA</p><h2>${registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2><p class="muted">${registering ? 'Comece cadastrando sua empresa.' : 'Entre para acompanhar suas pesquisas.'}</p><form id="auth-form" class="stack top-gap">${registering ? '<label>Seu nome<input name="name" autocomplete="name" required maxlength="120" placeholder="Nome completo"></label><label>Empresa<input name="company" autocomplete="organization" required maxlength="120" placeholder="Nome da empresa"></label><label>Código de convite (opcional)<input name="invitationToken" autocomplete="off" maxlength="100" placeholder="Somente para entrar numa equipe existente"></label>' : ''}<label>E-mail<input name="email" type="email" autocomplete="email" required placeholder="voce@empresa.com.br"></label><label>Senha<input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" required minlength="${registering ? 10 : 1}" placeholder="${registering ? 'Mínimo de 10 caracteres' : 'Sua senha'}"></label><button class="btn primary full" type="submit">${registering ? 'Criar conta' : 'Entrar'} <span aria-hidden="true">↗</span></button></form><button type="button" class="text-button" data-management="recover-password">Recuperar acesso com código</button><p class="auth-switch">${registering ? 'Já tem conta?' : 'Ainda não tem conta?'} <button type="button" class="text-button" data-action="toggle-auth">${registering ? 'Entrar' : 'Criar conta'}</button></p></div></section></main>`;
}

function shell(content) {
  const nav = [
    ['geral','Visão geral'],
    ...(state.account.role === 'owner' ? [['pessoas','Organização']] : []),
    ...(state.account.role !== 'viewer' ? [['pesquisas','Pesquisas']] : []),
    ['resultados','Resultados'],
    ['acoes','Planos de ação']
  ];
  const navActive = key => state.tab === key || key === 'pessoas' && state.tab === 'grupos';
  const tabTitles = {
    geral: 'Visão geral',
    pessoas: 'Pessoas',
    grupos: 'Grupos',
    pesquisas: 'Pesquisas',
    relatorios: 'Relatórios', resultados: 'Resultados', acoes: 'Planos de ação', assinatura: 'Assinatura',
    configuracoes: 'Configurações'
  };
  app.innerHTML = `<div class="layout"><div class="sidebar-backdrop" data-action="close-sidebar" aria-hidden="true"></div><aside class="sidebar"><div><div class="sidebar-top-row"><a class="logo" href="#geral">e<span>·</span>equilibra</a><button type="button" class="sidebar-close-btn" data-action="close-sidebar" aria-label="Fechar menu">${Experience.icon("fechar")}</button></div><p class="sidebar-caption">ESPAÇO DA EMPRESA</p><nav aria-label="Navegação principal">${nav.map(([k,l]) => `<button data-tab="${k}" class="nav-item ${navActive(k)?'active':''}" ${navActive(k)?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${Experience.icon(k)}</span>${l}</button>`).join('')}</nav></div><div class="sidebar-bottom"><div class="org" title="${esc(state.account.company)}"><div class="org-avatar">${esc(state.account.company.slice(0,1).toUpperCase())}</div><div><strong>${esc(state.account.company)}</strong><small>${esc(state.account.name)}</small></div></div><div class="sidebar-actions"><button type="button" class="sidebar-action-btn ${state.tab==='configuracoes'?'active':''}" data-tab="configuracoes"><span class="sidebar-action-icon" aria-hidden="true">${Experience.icon("configuracoes")}</span> Configurações</button><button type="button" class="sidebar-action-btn danger" data-action="logout"><span class="sidebar-action-icon" aria-hidden="true">${Experience.icon("sair")}</span> Sair da conta</button></div></div></aside><div class="mobile-nav"><a class="logo" href="#geral">e<span>·</span>equilibra</a><div class="mobile-nav-right"><button type="button" class="mobile-account-btn ${state.tab==='configuracoes'?'active':''}" data-tab="configuracoes" title="Abrir configurações">${Experience.icon("configuracoes")}</button><button class="menu-toggle" data-action="menu" aria-label="Abrir menu" aria-expanded="false"><span class="menu-toggle-icon">${Experience.icon("menu")}</span></button></div></div><div class="workspace"><header class="topbar"><span>Visão da empresa <span class="slash">/</span> <strong>${esc(tabTitles[state.tab] || 'Geral')}</strong></span><button type="button" class="account-pill-btn" data-tab="configuracoes" title="Abrir configurações da conta">${esc(state.account.name)} <span class="account-pill-badge">${Experience.icon("configuracoes")}</span></button></header><main class="main-content">${content}</main></div></div>`;
  Experience.afterRender();
}

function heading(kicker, title, desc, action = '') {
  return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div>`;
}
function actionButton(label, action) {
  return `<button class="btn primary" data-action="${action}"><span class="plus">+</span>${label}</button>`;
}
function step(number, title, body, action, label, done) {
  return `<article class="step ${done?'done':''}"><div class="step-number">${done?'✓':number}</div><div><h3>${title}</h3><p>${body}</p></div><button class="text-button" data-tab="${action}">${label} <span aria-hidden="true">↗</span></button></article>`;
}

function dashboard() {
  const d = state.dashboard;
  if (!d) { app.innerHTML = `<div class="layout"><div class="workspace"><main class="main-content" style="display:flex;align-items:center;justify-content:center;min-height:60vh;"><p class="muted">Carregando...</p></main></div></div>`; return; }
  let body = heading('VISÃO GERAL', `Olá, ${esc(state.account.name.split(' ')[0])}.`, 'Acompanhe decisões, medidas e resultados da sua empresa.') + Experience.overview();
  if (!d.surveys) {
    const hasCustomGroups = (d.customGroups ?? state.groups.filter(g => !g.isDefault).length) > 0;
    body += `<section class="welcome"><div class="welcome-copy"><p class="eyebrow">PRIMEIROS PASSOS</p><h2>Comece pela sua equipe.</h2><p>Cadastre pessoas, organize um grupo e configure a primeira pesquisa.</p></div><div class="welcome-art" aria-hidden="true"><div class="orbit one"></div><div class="orbit two"></div><div class="orbit three"></div><span>e·</span></div></section><div class="section-title"><h2>Seu caminho</h2><span>3 etapas</span></div><div class="steps">${step('01','Cadastre pessoas','Nome ou e-mail de cada participante.','pessoas','Ir para pessoas',d.members>0)}${step('02','Organize grupos','Selecione as pessoas de cada grupo.','grupos','Ir para grupos',hasCustomGroups)}${step('03','Crie uma pesquisa','Defina modelo, ciclo, grupo e encerramento.','pesquisas','Ir para pesquisas',false)}</div>`;
  } else {
    body += `<p class="muted">${d.members} pessoas · ${d.customGroups} grupos personalizados · ${d.open} pesquisa(s) em coleta · ${d.published} ciclo(s) publicado(s)</p>`;
    if (d.result) body += `<div class="section-title"><h2>Percepção geral</h2><span>Último ciclo: ${esc(d.latestCycle || '—')}</span></div><section class="result-panel"><div class="result-intro"><h3>O que as respostas mostram</h3><p>Resultado do ciclo publicado mais recente. Escala de 1 a 5. Consulte Resultados para comparar períodos.</p></div>${DashboardCharts.markup(d.result)}<div class="factor-list">${d.result.map(item => `<div class="factor"><div><strong>${esc(item.label)}</strong><span>${fmt(item.average)} / 5</span></div><div class="track"><div style="width:${item.average*20}%"></div></div></div>`).join('')}</div></section><p class="fine-print">Levantamento exploratório. Não é diagnóstico individual.</p>`;
    else body += `<section class="notice"><div class="notice-icon">◌</div><div><h2>Resultados aguardando publicação</h2><p>Feche um ciclo com pelo menos 5 respostas para ver dados coletivos.</p></div><button class="btn secondary" data-tab="pesquisas">Ver pesquisas</button></section>`;
    if (d.recent.length) body += `<div class="section-title"><h2>Ciclos recentes</h2><a class="text-button" href="#resultados">Ver resultados ↗</a></div><div class="recent-list">${d.recent.map(item => { const report = state.reports.find(row => row.surveyId === item.id); return `<a class="ux-recent-link" href="#resultados${report ? '/ciclo/' + attr(report.id) : ''}"><strong>${esc(item.title)}</strong><span>${esc(item.groupName)} · ${esc(item.cycle)}</span><small>${item.responseCount} respostas · Abrir ciclo ↗</small></a>`; }).join('')}</div>`;
  }
  shell(body);
}

function memberAvatar(member) {
  const initial = (member.name || member.email || '?').trim().charAt(0).toUpperCase();
  const emailAddr = (member.email || '').trim().toLowerCase();

  if (emailAddr) {
    const avatarUrl = `https://unavatar.io/${encodeURIComponent(emailAddr)}?fallback=false`;
    return `
      <div class="member-avatar" title="${esc(member.name || member.email)}">
        <img class="member-avatar-img"
             src="${attr(avatarUrl)}"
             alt="${attr(member.name || member.email)}"
             loading="lazy"
             referrerpolicy="no-referrer"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span class="member-avatar-initial" style="display:none;">${esc(initial)}</span>
      </div>`;
  }

  return `
    <div class="member-avatar" title="${esc(member.name || member.email)}">
      <span class="member-avatar-initial">${esc(initial)}</span>
    </div>`;
}

// ── Builds member rows for the table; filters by group if filterGroupId is set ──
function buildMemberRows(members, filterGroupId) {
  return members
    .filter(member => !filterGroupId || state.groups.find(g => g.id === filterGroupId)?.memberIds.includes(member.id))
    .map(member => {
      const memberGroups = state.groups.filter(g => g.memberIds.includes(member.id));
      const groupNames = memberGroups.map(g => g.name).join(' ');
      const groupIds = memberGroups.map(g => g.id).join(' ');
      return `
        <tr class="member-table-row"
            data-search="${attr(`${member.name||''} ${member.email||''} ${member.phone||''} ${groupNames}`)}"
            data-groups="${attr(groupIds)}">
          <td>
            <div class="member-name-cell">
              ${memberAvatar(member)}
              <div>
                <strong>${esc(member.name || 'Sem nome informado')}</strong>
                ${!member.name ? '<small class="fine-print" style="display:block;margin:0;">Identificado por e-mail</small>' : ''}
              </div>
            </div>
          </td>
          <td>${member.email ? esc(member.email) : '<span class="muted-dash">—</span>'}</td>
          <td>${member.phone ? esc(member.phone) : '<span class="muted-dash">—</span>'}</td>
          <td>${memberGroups.map(g => groupTag(g)).join('')}</td>
          <td style="text-align:right;">
            <div class="row-actions">
              <button class="table-action" data-action="edit-member" data-id="${attr(member.id)}">Editar</button>
              <button class="table-action danger" data-action="delete-member" data-id="${attr(member.id)}" data-name="${attr(member.name||member.email)}">Excluir</button>
            </div>
          </td>
        </tr>`;
    }).join('');
}

function people() {
  const filterGroupId = state.filterGroupId;
  const filteredCount = filterGroupId
    ? state.members.filter(m => state.groups.find(g => g.id === filterGroupId)?.memberIds.includes(m.id)).length
    : state.members.length;

  let body = heading(
    'BASE DE PESSOAS', 'Pessoas',
    'Cadastre colaboradores individualmente ou importe via planilha Excel.',
    `<div class="head-actions"><button class="btn secondary" data-action="import-members">Importar Excel</button>${actionButton('Cadastrar pessoa','new-member')}</div>`
  );

  body += Experience.organizationNav();
  if (state.members.length) {
    body += groupFilterBar(filterGroupId);
    body += `
      <div class="table-toolbar">
        <div class="search-box">
          <span class="search-icon">${Experience.icon("busca")}</span>
          <input type="search" id="member-search" placeholder="Buscar por nome, e-mail ou grupo..." autocomplete="off">
        </div>
        <div class="toolbar-stats">
          <span id="member-search-count">${filteredCount} ${filteredCount === 1 ? 'pessoa' : 'pessoas'}${filterGroupId ? ' neste grupo' : ' cadastradas'}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Grupos</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="members-table-body">
            ${buildMemberRows(state.members, filterGroupId)}
          </tbody>
        </table>
      </div>`;
  } else {
    body += `<div class="empty">
      <div class="empty-mark">♙</div>
      <h2>Nenhuma pessoa cadastrada</h2>
      <p>Cadastre pessoas individualmente ou importe o template Excel. Todas entram automaticamente no grupo Geral.</p>
      <div class="head-actions">
        <button class="btn secondary" data-action="import-members">Importar Excel</button>
        <button class="btn primary" data-action="new-member">Cadastrar pessoa</button>
      </div>
    </div>`;
  }
  shell(body);
}

function groups() {
  let body = heading(
    'ORGANIZAÇÃO', 'Grupos',
    'Geral reúne todas as pessoas. Crie grupos por setor, equipe ou filial.',
    actionButton('Criar grupo','new-group')
  );
  body += Experience.organizationNav();
  body += `<div class="group-grid">${state.groups.map(group => {
    const c = group.color;
    const cardStyle = c ? `style="border-top:3px solid ${c};"` : '';
    const iconStyle = c ? `style="background:${c}1a;color:${c};"` : '';
    return `
      <article class="group-card" ${cardStyle}>
        <div class="card-top">
          <span class="mini-icon" ${iconStyle}>▤</span>
          <div class="card-actions">
            ${group.isDefault ? '<span class="badge open">Geral (Automático)</span>' : `
              <button class="table-action" data-action="edit-group" data-id="${attr(group.id)}">Editar</button>
              <button class="table-action danger" data-action="delete-group" data-id="${attr(group.id)}" data-name="${attr(group.name)}">Excluir</button>
            `}
          </div>
        </div>
        <h2>${c ? `<span class="group-color-dot" style="background:${c}"></span>` : ''}${esc(group.name)}</h2>
        <p>${group.memberIds.length} ${group.memberIds.length===1?'pessoa':'pessoas'}</p>
        <div class="card-foot">
          ${group.isDefault ? 'Reúne toda a base da empresa' : group.memberIds.length < 5 ? '⚠️ Mínimo de 5 para pesquisa' : '✓ Pronto para pesquisa'}
        </div>
      </article>`;
  }).join('')}</div>`;
  shell(body);
}

function timeRemaining(endsAt) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Encerramento pendente';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 1) return `${days} dias restantes`;
  if (days === 1) return `1 dia e ${hours}h restantes`;
  if (hours > 0) return `${hours}h e ${mins}min restantes`;
  if (mins > 0) return `${mins} min restantes`;
  return 'Encerrando em breve';
}

function surveys() {
  if (location.hash.split('?')[0] === '#pesquisas/agendamentos') return Experience.schedulesView();
  const surveyRoute = location.hash.split('?')[0].split('/');
  state.activeSurveyDashboardId = surveyRoute[1] === 'ciclo' ? surveyRoute[2] : null;
  if (state.activeSurveyDashboardId) {
    const survey = state.surveys.find(s => s.id === state.activeSurveyDashboardId);
    if (survey) {
      if (survey.status === 'closed') { openSurveyDashboard(survey.id); return; }
      surveyDashboardView(survey);
      return;
    } else {
      state.activeSurveyDashboardId = null;
    }
  }
  if (state.surveyWizard) {
    surveyWizardView();
    return;
  }
  let body = heading('COLETA WEB','Pesquisas','Escolha um modelo, publique o formulário web e acompanhe o ciclo.',`<div class="ux-inline-actions"><button class="btn secondary" data-action="survey-catalog">Modelos e metodologia</button><a class="btn secondary" href="#pesquisas/agendamentos">Recorrência</a>${actionButton('Nova pesquisa','new-survey')}</div>`);
  body += state.surveys.length ? `<div class="survey-grid">${state.surveys.map(survey => {
    const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
    const surveyGroupObjects = surveyGroupIds.map(gid => state.groups.find(g => g.id === gid)).filter(Boolean);
    const groupTagsHtml = surveyGroupObjects.map(g => {
      const c = g?.color;
      const dot = c ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;"></span>` : '';
      return `<span class="survey-group-tag">${dot}${esc(g.name)}</span>`;
    }).join('');
    // Progress bar for open surveys (70% threshold for collection)
    const pct = survey.groupSize > 0 ? Math.round((survey.responseCount / survey.groupSize) * 100) : 0;
    const pct70 = survey.pct70 || Math.ceil((survey.groupSize || 0) * 0.7);
    const progressHtml = survey.status === 'open' ? `
      <div class="survey-progress-wrap">
        <div class="survey-progress-bar">
          <div class="survey-progress-fill ${survey.canClose ? 'ready' : ''}" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="survey-progress-label">${survey.responseCount} de ${survey.groupSize} respostas (${pct}%)</div>
      </div>` : '';

    // Meta: standard font and appearance (no decoration)
    let metaHtml = '';
    if (survey.status === 'open') {
      metaHtml = `
        <div class="survey-meta">
          <span>Tempo restante<strong>${timeRemaining(survey.endsAt)}</strong></span>
          <span>Encerramento<strong>${date(survey.endsAt)}</strong></span>
        </div>`;
    } else if (survey.status === 'closed') {
      metaHtml = `
        <div class="survey-meta">
          <span>Encerrada em<strong>${date(survey.closedAt || survey.endsAt)}</strong></span>
        </div>`;
    } else {
      metaHtml = `
        <div class="survey-meta">
          <span>Encerramento previsto<strong>${date(survey.endsAt)}</strong></span>
        </div>`;
    }

    let actionBtn = '';
    if (survey.status === 'draft') {
      actionBtn = `<button class="btn small primary" data-action="start-survey-confirm" data-id="${attr(survey.id)}">Iniciar coleta ▶</button>`;
    } else if (survey.status === 'open') {
      actionBtn = `<button class="btn small ${survey.canClose ? 'primary' : 'btn-disabled-threshold'}"
        data-action="close-survey" data-id="${attr(survey.id)}"
        ${survey.canClose ? '' : `disabled title="A pesquisa ainda não atingiu uma quantidade de respostas definida pela regra operacional para que seja possível concluí-la!"`}>
        Encerrar coleta
      </button>`;
    }

    const viewBtnText = 'Visualizar detalhes ↗';
    const bottomLabel = survey.status === 'draft'
      ? `${survey.groupSize} ${survey.groupSize===1?'pessoa':'pessoas'} (${surveyGroupObjects.length} grupo${surveyGroupObjects.length!==1?'s':''})`
      : survey.status === 'open' ? `${survey.responseCount}/${survey.groupSize} respostas`
      : survey.result ? `${survey.responseCount} respostas consolidadas` : 'Resultado indisponível';

    return `
      <article class="survey-card">
        <div class="card-top">
          <span class="badge ${survey.status}"><span class="dot"></span>${statusLabel[survey.status]}</span>
          <div class="card-top-right">
            <span class="cycle">${esc(survey.cycle)}</span>
            <button class="card-trash-btn" data-action="delete-survey-confirm" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}" title="${survey.status === 'closed' ? 'Arquivar ciclo' : 'Excluir rascunho'}" aria-label="${survey.status === 'closed' ? 'Arquivar ciclo' : 'Excluir rascunho'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
        <h2 style="cursor:pointer;" data-action="open-survey-dashboard" data-id="${attr(survey.id)}">${esc(survey.title)}</h2>
        <p class="model">${esc(survey.model)}</p>
        <div class="survey-group-tags">${groupTagsHtml}</div>
        ${progressHtml}
        ${metaHtml}
        <div class="survey-bottom">
          <span>${bottomLabel}</span>
          <div class="survey-bottom-actions">
            ${actionBtn}
            <button class="text-button" data-action="open-survey-dashboard" data-id="${attr(survey.id)}">${viewBtnText}</button>
          </div>
        </div>
      </article>`;
  }).join('')}</div>` : `<div class="empty"><div class="empty-mark">◫</div><h2>Nenhuma pesquisa criada</h2><p>${state.groups.length?'Escolha grupos, modelo e ciclo para começar.':'Crie um grupo antes de configurar a primeira pesquisa.'}</p><button class="btn primary" data-action="${state.groups.length?'new-survey':'go-groups'}">${state.groups.length?'Nova pesquisa':'Criar grupo'}</button></div>`;
  shell(body);
}

function settings() { return Experience.settingsView(); }

function routeTab() {
  const hash = location.hash.slice(1);
  if (hash === 'assinatura') { location.replace('#configuracoes/plano'); return 'configuracoes'; }
  if (hash === 'relatorios') { location.replace('#resultados/documentos'); return 'resultados'; }
  const base = hash.split(/[/?]/)[0];
  return ['geral','pessoas','grupos','pesquisas','configuracoes','resultados','acoes'].includes(base) ? base : 'geral';
}

function render() {
  if (location.pathname.startsWith('/responder/')) return respondent();
  if (!state.account) {
    if (location.hash && location.hash !== '#login') location.hash = 'login';
    return auth();
  }
  if (location.hash === '#login' || state.tab === 'login') {
    state.tab = 'geral';
    location.hash = 'geral';
  }
  if (state.account.role !== 'owner' && ['pessoas', 'grupos', 'assinatura'].includes(state.tab) || state.account.role === 'viewer' && state.tab === 'pesquisas') { state.tab = 'resultados'; location.hash = 'resultados'; }
  const views = { resultados: Experience.resultsView, acoes: Experience.actionsView, geral: dashboard, pessoas: people, grupos: groups, pesquisas: surveys, configuracoes: settings };
  (views[state.tab] || dashboard)();
}

function modal(title, content) {
  document.querySelector('#modal')?.remove();
  const wrap = document.createElement('div'); wrap.id = 'modal'; wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Fechar">×</button></div>${content}</div>`;
  document.body.append(wrap);
  wrap.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...wrap.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  wrap.querySelector('input:not([type=hidden]), select, button')?.focus();
}

function memberForm(member) {
  const customGroups = state.groups.filter(g => !g.isDefault);
  modal(
    member ? 'Editar pessoa' : 'Cadastrar pessoa',
    `<form id="member-form" class="modal-body stack" data-id="${attr(member?.id||'')}">
      <div class="form-banner">
        <strong>Regra de validação:</strong> É necessário informar ao menos o <strong>Nome</strong> ou o <strong>E-mail</strong>. O telefone é opcional.
      </div>
      <label>Nome completo <span class="tag-optional">(opcional se tiver e-mail)</span>
        <input name="name" maxlength="120" value="${attr(member?.name||'')}" placeholder="Ex.: Mariana Souza">
      </label>
      <div class="form-grid">
        <label>E-mail corporativo <span class="tag-optional">(opcional se tiver nome)</span>
          <input name="email" type="email" value="${attr(member?.email||'')}" placeholder="mariana@empresa.com.br">
        </label>
        <label>Telefone <span class="tag-optional">(opcional)</span>
          <input name="phone" type="tel" maxlength="22" value="${attr(member?.phone||'')}" placeholder="(11) 99999-9999">
        </label>
      </div>
      <fieldset class="select-people">
        <legend>Grupos vinculados</legend>
        <div style="margin-bottom:10px;">
          <span class="tag-group default-group">✓ Geral</span>
          <span class="fine-print" style="margin-left:6px;">Pertence automaticamente</span>
        </div>
        ${customGroups.length ? `
          <p class="fine-print" style="margin:0 0 8px;">Selecione os grupos adicionais desta pessoa:</p>
          <div class="check-list" style="max-height:160px;">
            ${customGroups.map(group => `
              <label class="check-row">
                <input type="checkbox" name="groupIds" value="${attr(group.id)}" ${member&&group.memberIds.includes(member.id)?'checked':''}>
                <span>
                  <strong style="display:inline-flex;align-items:center;gap:6px;">
                    ${group.color ? `<span class="group-select-dot" style="background:${group.color};"></span>` : ''}
                    ${esc(group.name)}
                  </strong>
                  <small>${group.memberIds.length} ${group.memberIds.length===1?'membro':'membros'}</small>
                </span>
              </label>
            `).join('')}
          </div>
        ` : `<p class="helper">Nenhum grupo customizado criado. Crie grupos na aba Grupos.</p>`}
      </fieldset>
      <div class="modal-actions" style="justify-content:space-between;">
        ${member ? `<button type="button" class="btn danger-outline" data-action="delete-member" data-id="${attr(member.id)}" data-name="${attr(member.name||member.email)}">Excluir pessoa</button>` : '<div></div>'}
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn secondary" data-action="close-modal">Cancelar</button>
          <button class="btn primary" type="submit">Salvar pessoa</button>
        </div>
      </div>
    </form>`
  );
}

function importModal() {
  state.importFile = null;
  modal('Importar pessoas', `<div class="modal-body"><p class="muted">Baixe a planilha de exemplo, preencha as pessoas da sua equipe e envie o arquivo .xlsx. Grupos novos são criados automaticamente.</p><a class="btn secondary" href="/api/members/template" download="equilibra-pessoas.xlsx">Baixar planilha de exemplo (.xlsx)</a><label class="upload-field">Arquivo Excel (.xlsx)<input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p class="helper">Regra: Informe ao menos Nome ou E-mail em cada linha. Telefone e grupo são opcionais. Até 1 MB e 1.000 pessoas por arquivo.</p><div id="import-preview" aria-live="polite"></div><div class="modal-actions"><button class="btn secondary" data-action="close-modal">Cancelar</button><button id="import-confirm" class="btn primary" data-action="confirm-import" disabled>Importar pessoas</button></div></div>`);
}

async function previewImport(file) {
  const preview = document.querySelector('#import-preview');
  const confirm = document.querySelector('#import-confirm');
  confirm.disabled = true; state.importFile = null;
  if (!file) { preview.replaceChildren(); return; }
  if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 1024*1024) { preview.innerHTML = '<p class="import-error">Envie um arquivo .xlsx de até 1 MB.</p>'; return; }
  preview.innerHTML = '<p class="muted">Lendo planilha...</p>';
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
  const payload = { fileName: file.name, base64 };
  const result = await post('/members/import/preview', payload);
  state.importFile = payload;
  const shown = result.invalid ? result.rows.filter(r => r.errors.length).slice(0,100) : result.rows.slice(0,8);
  preview.innerHTML = `<div class="import-summary"><strong>${result.valid} prontas para importar</strong><span>${result.invalid?`${result.invalid} com erro. Corrija a planilha e envie novamente.`:'Nenhum erro encontrado.'}</span></div><div class="import-list">${shown.map(row=>`<div class="import-row"><span>Linha ${row.line}</span><strong>${esc(row.name||'Sem nome')}</strong><small>${esc(row.email||row.phone||'')} · ${esc(row.group)}</small>${row.errors.length?`<em>${esc(row.errors.join(' · '))}</em>`:''}</div>`).join('')}</div>${result.invalid>shown.length||(!result.invalid&&result.rows.length>shown.length)?`<p class="fine-print">Mostrando ${shown.length} de ${result.invalid||result.rows.length} linhas.</p>`:''}`;
  confirm.disabled = result.invalid > 0 || result.valid === 0;
}

function groupForm(group) {
  if (!state.members.length) { state.tab = 'pessoas'; render(); message('Cadastre pessoas antes de criar grupos.'); return; }
  const currentColor = group?.color || GROUP_COLORS[0];
  modal(
    group ? 'Editar grupo' : 'Criar grupo',
    `<form id="group-form" class="modal-body stack" data-id="${attr(group?.id||'')}">
      <label>Nome do grupo
        <input name="name" required maxlength="120" value="${attr(group?.name||'')}" placeholder="Ex.: Engenharia, Comercial, Filial SP">
      </label>

      <div class="color-picker-section">
        <label class="color-picker-label">Cor de identificação</label>
        <div class="color-swatches" id="color-swatches">
          ${GROUP_COLORS.map(c => `
            <button type="button"
              class="color-swatch ${currentColor===c?'selected':''}"
              data-action="pick-color"
              data-color="${attr(c)}"
              style="background:${c};"
              title="${c}"
              aria-label="Cor ${c}"
            ></button>
          `).join('')}
          <div class="color-custom-wrap">
            <input type="color" id="color-custom-input" value="${attr(currentColor)}" title="Cor personalizada">
            <label for="color-custom-input" class="color-custom-label">✏️</label>
          </div>
        </div>
        <input type="hidden" name="color" id="group-color-value" value="${attr(currentColor)}">
        <div class="color-preview-bar" id="color-preview-bar" style="background:${currentColor}"></div>
      </div>

      <fieldset class="select-people">
        <legend style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <span>Pessoas no grupo <span id="selected-count"></span></span>
          <div class="group-select-helpers">
            <button type="button" class="text-button" data-action="select-all-members">Todas</button>
            <span>·</span>
            <button type="button" class="text-button" data-action="clear-all-members">Limpar</button>
          </div>
        </legend>
        <div style="margin:8px 0;">
          <input type="search" id="group-member-search" placeholder="Filtrar por nome ou e-mail...">
        </div>
        <div class="check-list" style="max-height:200px;">
          ${state.members.map(member => `
            <label class="check-row" data-text="${attr(`${member.name||''} ${member.email||''}`.toLowerCase())}">
              <input type="checkbox" name="memberIds" value="${attr(member.id)}" ${group?.memberIds.includes(member.id)?'checked':''}>
              <span>
                <strong>${esc(member.name||'Sem nome informado')}</strong>
                <small>${esc(member.email||member.phone||'Sem contato')}</small>
              </span>
            </label>
          `).join('')}
        </div>
      </fieldset>
      <p class="helper">O grupo deve ter no mínimo 5 pessoas para publicar resultados de pesquisas.</p>
      <div class="modal-actions" style="justify-content:space-between;">
        ${group && !group.isDefault ? `<button type="button" class="btn danger-outline" data-action="delete-group" data-id="${attr(group.id)}" data-name="${attr(group.name)}">Excluir grupo</button>` : '<div></div>'}
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn secondary" data-action="close-modal">Cancelar</button>
          <button class="btn primary" type="submit">Salvar grupo</button>
        </div>
      </div>
    </form>`
  );
  selectedCount();
}

function selectedCount() {
  const form = document.querySelector('#group-form');
  if (form) form.querySelector('#selected-count').textContent = `(${form.querySelectorAll('input[name="memberIds"]:checked').length} selecionadas)`;
}

const MODEL_DETAILS = {
  'Diagnóstico inicial': {
    icon: '🧭',
    tag: 'Recomendado para início',
    desc: 'Primeiro ciclo exploratório de percepção do trabalho. Usa as mesmas oito perguntas dos demais formatos.'
  },
  'Pulso mensal': {
    icon: '📈',
    tag: 'Frequente e ágil',
    desc: 'Acompanhamento contínuo da temperatura e do clima organizacional para monitorar variações rápidas de demanda e satisfação.'
  },
  'Escuta focada': {
    icon: '🎯',
    tag: 'Direcionado',
    desc: 'Ciclo direcionado a um público prioritário. Usa o mesmo instrumento exploratório de oito perguntas.'
  },
  'Remedição de ação': {
    icon: '🔄',
    tag: 'Pós-intervenção',
    desc: 'Novo ciclo para apoiar revisão das medidas. A comparação não comprova causalidade nem eficácia isoladamente.'
  },
  'Evento: mudança': {
    icon: '⚡',
    tag: 'Momento de transição',
    desc: 'Escuta preventiva diante de reestruturações, incorporações, mudanças de liderança ou novas ferramentas de trabalho.'
  },
  'Evento: pico ou pressão': {
    icon: '⏳',
    tag: 'Alta demanda',
    desc: 'Monitoramento do suporte, carga e segurança psicológica durante fechamentos de metas, entregas sazonais ou crises.'
  }
};

function openSurveyWizard() {
  if (!state.groups.length) {
    state.tab = 'grupos';
    render();
    message('Crie ao menos um grupo antes de configurar uma pesquisa.');
    return;
  }
  const nextMonthDate = new Date(Date.now() + 30 * 86400000);
  const nextMonth = new Date(nextMonthDate.getTime() - nextMonthDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const defaultCycle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

  const selectedGroupIds = state.groups.length ? [state.groups[0].id] : [];

  state.surveyWizard = {
    step: 1,
    id: null,
    title: 'Pesquisa de Percepção do Trabalho',
    cycle: defaultCycle,
    model: state.meta?.models?.[0] || 'Diagnóstico inicial',
    groupIds: selectedGroupIds,
    endsAt: nextMonth,
    submitting: false
  };
  state.tab = 'pesquisas';
  render();
}

function closeSurveyWizard() {
  state.surveyWizard = null;
  render();
}

window.closeSurveyWizard = closeSurveyWizard;

window.updateWizardField = function(field, value) {
  if (state.surveyWizard) {
    state.surveyWizard[field] = value;
  }
};

window.toggleWizardGroup = function(groupId) {
  if (!state.surveyWizard) return;
  const list = state.surveyWizard.groupIds || [];
  if (list.includes(groupId)) {
    state.surveyWizard.groupIds = list.filter(id => id !== groupId);
  } else {
    state.surveyWizard.groupIds = [...list, groupId];
  }
  render();
};

window.wizardSelectAllGroups = function(all) {
  if (!state.surveyWizard) return;
  state.surveyWizard.groupIds = all ? state.groups.map(g => g.id) : [];
  render();
};

window.wizardSelectModel = function(model) {
  if (!state.surveyWizard) return;
  state.surveyWizard.model = model;
  render();
};

window.wizardSetStep = function(step) {
  if (!state.surveyWizard) return;
  if (step > 1 && state.surveyWizard.step === 1) {
    const titleInp = document.querySelector('#wizard-title');
    if (titleInp) state.surveyWizard.title = titleInp.value;
    const cycleInp = document.querySelector('#wizard-cycle');
    if (cycleInp) state.surveyWizard.cycle = cycleInp.value;

    const title = (state.surveyWizard.title || '').trim();
    const cycle = (state.surveyWizard.cycle || '').trim();
    const groups = state.surveyWizard.groupIds || [];
    if (!title) { message('Informe o nome ou título da pesquisa.', true); return; }
    if (!cycle) { message('Informe o ciclo ou período da pesquisa (ex.: Outubro 2026).', true); return; }
    if (groups.length === 0) { message('Selecione ao menos um grupo participante.', true); return; }
    const uniqueCount = [...new Set(state.groups.filter(g => groups.includes(g.id)).flatMap(g => g.memberIds))].length;
    if (uniqueCount < 5) {
      message(`Os grupos selecionados têm ${uniqueCount} pessoa${uniqueCount !== 1 ? 's' : ''} única${uniqueCount !== 1 ? 's' : ''}. O mínimo exigido é 5 para publicação de resultados coletivos.`, true);
      return;
    }
  }
  if (step > 2 && state.surveyWizard.step === 2) {
    if (!state.surveyWizard.model) {
      message('Selecione um modelo de questionário.', true);
      return;
    }
  }
  state.surveyWizard.step = step;
  render();
};

window.wizardSetDays = function(days) {
  if (!state.surveyWizard) return;
  const target = new Date(Date.now() + days * 86400000);
  const val = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  state.surveyWizard.endsAt = val;
  render();
};

window.wizardSave = async function(shouldOpen = false) {
  const wz = state.surveyWizard;
  if (!wz || wz.submitting) return;

  const endsAtInp = document.querySelector('#wizard-endsat');
  if (endsAtInp) wz.endsAt = endsAtInp.value;

  const title = (wz.title || '').trim();
  const cycle = (wz.cycle || '').trim();
  const model = wz.model;
  const groupIds = wz.groupIds || [];
  const endsAt = wz.endsAt;

  if (!title) { message('Informe o título da pesquisa.', true); wz.step = 1; render(); return; }
  if (!cycle) { message('Informe o ciclo da pesquisa.', true); wz.step = 1; render(); return; }
  if (groupIds.length === 0) { message('Selecione ao menos um grupo participante.', true); wz.step = 1; render(); return; }

  const totalMembers = [...new Set(state.groups.filter(g => groupIds.includes(g.id)).flatMap(g => g.memberIds))].length;
  if (totalMembers < 5) {
    message('A pesquisa exige mínimo de 5 pessoas únicas para publicação de resultados coletivos.', true);
    wz.step = 1; render(); return;
  }

  const endsAtDate = new Date(endsAt);
  if (!endsAt || isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= Date.now()) {
    message('Defina uma data e hora futura para o encerramento da pesquisa.', true);
    wz.step = 3; render(); return;
  }

  wz.submitting = true;
  render();

  try {
    const payload = {
      title,
      cycle,
      model,
      groupIds,
      endsAt: endsAtDate.toISOString()
    };

    await post('/surveys', payload);
    state.surveyWizard = null;
    await load();
    message('Pesquisa criada com sucesso! Clique em "Iniciar coleta" para liberar o link web.');
  } catch (error) {
    message(error.message, true);
    if (state.surveyWizard) {
      state.surveyWizard.submitting = false;
      render();
    }
  }
};

function surveyWizardView() {
  const wz = state.surveyWizard;
  const step = wz.step || 1;
  const selectedTemplate = state.meta?.templates?.find(row => row.name === wz.model);
  const factors = selectedTemplate?.factors || state.meta?.factors || [];
  const models = state.meta?.models ? [...new Set([...state.meta.models, ...(!state.meta.models.includes(wz.model) ? [wz.model] : [])])] : ['Diagnóstico inicial', 'Pulso mensal', 'Escuta focada', 'Remedição de ação', 'Evento: mudança', 'Evento: pico ou pressão'];

  const selectedGroupObjects = state.groups.filter(g => wz.groupIds.includes(g.id));
  const uniqueMemberIds = [...new Set(selectedGroupObjects.flatMap(g => g.memberIds))];
  const uniqueCount = uniqueMemberIds.length;
  const hasQuorum = uniqueCount >= 5;

  let body = `
    <div class="wizard-shell">
      <button type="button" class="wizard-back-btn" onclick="closeSurveyWizard()">
        ← Voltar para a lista de pesquisas
      </button>

      <div class="wizard-card">
        <header class="wizard-stepper">
          <div class="wizard-step-item ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}">
            <div class="wizard-step-num">${step > 1 ? '✓' : '1'}</div>
            <div class="wizard-step-text">
              <span class="wizard-step-label">Etapa 1</span>
              <div class="wizard-step-title">Informações & Públicos</div>
            </div>
          </div>
          <div class="wizard-step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}">
            <div class="wizard-step-num">${step > 2 ? '✓' : '2'}</div>
            <div class="wizard-step-text">
              <span class="wizard-step-label">Etapa 2</span>
              <div class="wizard-step-title">Opções de Pesquisa</div>
            </div>
          </div>
          <div class="wizard-step-item ${step === 3 ? 'active' : ''}">
            <div class="wizard-step-num">3</div>
            <div class="wizard-step-text">
              <span class="wizard-step-label">Etapa 3</span>
              <div class="wizard-step-title">Prazos & Lançamento</div>
            </div>
          </div>
        </header>

        <div class="wizard-body">
  `;

  if (step === 1) {
    body += `
      <div class="wizard-pane-head">
        <h2>Etapa 1: Identificação do Ciclo e Públicos</h2>
        <p>Defina o nome da pesquisa, o ciclo de referência e escolha os grupos de participantes que serão convidados.</p>
      </div>

      <div class="stack" style="gap:24px;">
        <label>Nome / Título da pesquisa <span style="color:#d9534f;">*</span>
          <input id="wizard-title" value="${attr(wz.title)}" oninput="updateWizardField('title', this.value)" placeholder="Ex.: Escuta Semestral de Clima e Bem-Estar" required maxlength="120">
          <span class="fine-print" style="margin:2px 0 0;">Este título será exibido na página de resposta e nos relatórios consolidados.</span>
        </label>

        <label>Ciclo / Período <span style="color:#d9534f;">*</span>
          <input id="wizard-cycle" value="${attr(wz.cycle)}" oninput="updateWizardField('cycle', this.value)" placeholder="Ex.: Outubro 2026" required maxlength="80">
          <span class="fine-print" style="margin:2px 0 0;">Identifica a rodada de coleta no histórico da empresa.</span>
        </label>

        <div>
          <div class="wizard-group-bar">
            <div>
              <strong style="font-size:13px;color:#243e31;">Grupos participantes <span style="color:#d9534f;">*</span></strong>
              <div class="fine-print" style="margin:2px 0 0;">Selecione um ou mais grupos. Pessoas em múltiplos grupos respondem <strong>uma única vez</strong>.</div>
            </div>
            <div class="wizard-group-actions">
              <button type="button" class="btn secondary small" onclick="wizardSelectAllGroups(true)">Marcar todos</button>
              <button type="button" class="btn secondary small" onclick="wizardSelectAllGroups(false)">Limpar seleção</button>
            </div>
          </div>

          <div class="wizard-group-grid">
            ${state.groups.map(g => {
              const isChecked = wz.groupIds.includes(g.id);
              const dot = g.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${g.color};"></span>` : '';
              return `
                <div class="wizard-group-card ${isChecked ? 'selected' : ''}" onclick="toggleWizardGroup('${g.id}')">
                  <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleWizardGroup('${g.id}');">
                  <div class="wizard-group-info">
                    <div class="wizard-group-name">${dot} ${esc(g.name)}</div>
                    <div class="wizard-group-size">${g.memberIds.length} ${g.memberIds.length === 1 ? 'pessoa' : 'pessoas'} vinculadas</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="quorum-card ${hasQuorum ? 'ok' : 'warning'}">
            <div>
              <div class="quorum-badge">
                ${hasQuorum ? '✓ Quórum estatístico suficiente' : '⚠️ Atenção: Quórum insuficiente'}
              </div>
              <div class="quorum-note">
                ${wz.groupIds.length === 0
                  ? 'Selecione ao menos um grupo participante para prosseguir.'
                  : hasQuorum
                    ? `Total de <strong>${uniqueCount} pessoas únicas</strong> aptas a participar entre os grupos selecionados.`
                    : `Atualmente com <strong>${uniqueCount} pessoas únicas</strong>. É necessário no mínimo 5 pessoas para reduzir a exposição de respostas individuais.`
                }
              </div>
            </div>
            <div style="font-size:18px;font-weight:800;white-space:nowrap;">
              ${uniqueCount} ${uniqueCount === 1 ? 'pessoa única' : 'pessoas únicas'}
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (step === 2) {
    body += `
      <div class="wizard-pane-head">
        <h2>Etapa 2: Opções de Pesquisa e Modelo</h2>
        <p>Escolha o modelo de questionário que melhor se alinha com o momento e o objetivo estratégico deste ciclo.</p>
      </div>

      <div class="model-grid">
        ${models.map(m => {
          const definition = state.meta?.templates?.find(row => row.name === m);
          const info = definition ? { icon: '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>', tag: `${definition.factors.length} afirmações · ${definition.category}`, desc: definition.description } : MODEL_DETAILS[m] || { icon: '', tag: 'Legado', desc: 'Questionário exploratório legado.' };
          const isSelected = wz.model === m;
          return `
            <button type="button" class="model-card ${isSelected ? 'active' : ''}" aria-pressed="${isSelected}" data-model-name="${attr(m)}">
              <div class="model-icon">${info.icon}</div>
              <div class="model-card-body">
                <h3>
                  <span>${esc(m)}</span>
                  <span class="model-card-check">✓</span>
                </h3>
                <span class="badge ${isSelected ? 'open' : ''}" style="margin-bottom:6px;font-size:9px;">${info.tag}</span>
                <p>${info.desc}</p>
              </div>
            </button>
          `;
        }).join('')}
      </div>
      <p class="privacy-note">${esc(selectedTemplate?.limitation || 'Modelo legado exploratório.')}</p>
      ${selectedTemplate?.sources ? `<p class="fine-print">Fontes: ${selectedTemplate.sources.map(source => `<a href="${attr(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>`).join(' · ')}</p>` : ''}
      ${selectedTemplate?.attribution ? `<p class="fine-print">${esc(selectedTemplate.attribution)}</p>` : ''}
      <details class="wizard-questions-box">
        <summary>Visualizar afirmações do questionário (${factors.length} afirmações)</summary>
        <p class="fine-print" style="margin:8px 0 0;">${esc(selectedTemplate?.instructions || "Responda de 1 (Discordo totalmente) a 5 (Concordo totalmente).")}</p>
        <ol class="wizard-questions-list">
          ${factors.map(f => {
            const label = Array.isArray(f) ? f[1] : (f.label || f.id || '');
            const question = Array.isArray(f) ? f[2] : (f.question || '');
            return `<li><strong>${esc(label)}:</strong> "${esc(question)}"</li>`;
          }).join('')}
        </ol>
      </details>
    `;
  } else if (step === 3) {
    body += `
      <div class="wizard-pane-head">
        <h2>Etapa 3: Prazos, Privacidade e Lançamento</h2>
        <p>Defina o encerramento da coleta, confirme as regras de proteção de dados e conclua a criação do ciclo.</p>
      </div>

      <div class="stack" style="gap:24px;">
        <label>Data e horário limite de encerramento <span style="color:#d9534f;">*</span>
          <input id="wizard-endsat" type="datetime-local" value="${attr(wz.endsAt)}" onchange="updateWizardField('endsAt', this.value)" required>
          <div class="date-presets" style="margin-top:8px;">
            <span class="preset-label">Atalhos rápidos:</span>
            <button type="button" class="chip-button" onclick="wizardSetDays(7)">+7 dias</button>
            <button type="button" class="chip-button" onclick="wizardSetDays(15)">+15 dias</button>
            <button type="button" class="chip-button" onclick="wizardSetDays(30)">+30 dias (1 mês)</button>
          </div>
          <span class="fine-print" style="margin:4px 0 0;">A coleta será automaticamente finalizada nesta data, consolidando os relatórios.</span>
        </label>

        <div class="notice" style="background:#f4f9f4;border:1px solid #c7e5cb;">
          <div style="font-size:32px;">🛡️</div>
          <div>
            <h2 style="font-size:15px;margin-bottom:4px;color:#1a4d34;">Privacidade e regras da coleta web</h2>
            <p style="color:#496d58;font-size:12px;line-height:1.6;">
              • <strong>Resultados coletivos:</strong> O painel não exibe respostas individuais. A publicação exige pelo menos cinco respostas e aplica proteção para públicos sobrepostos. Isso não garante anonimato absoluto.<br>
              • <strong>Pessoas em múltiplos grupos:</strong> Se um participante estiver em mais de um grupo selecionado, ele responde uma única vez e sua resposta integra apenas o resultado coletivo deste ciclo, sem separação por grupo.<br>
              • <strong>Recolhimento dos resultados:</strong> Os dados podem ser recolhidos a partir de 70% de respostas ou automaticamente na data limite de encerramento.
            </p>
          </div>
        </div>

        <div>
          <strong style="font-size:13px;color:#243e31;">Resumo do Ciclo de Pesquisa</strong>
          <div class="wizard-review-grid">
            <div class="wizard-review-item">
              <span>Título da Pesquisa</span>
              <strong>${esc(wz.title)}</strong>
            </div>
            <div class="wizard-review-item">
              <span>Ciclo / Período</span>
              <strong>${esc(wz.cycle)}</strong>
            </div>
            <div class="wizard-review-item">
              <span>Modelo de Questionário</span>
              <strong>${esc(wz.model)}</strong>
            </div>
            <div class="wizard-review-item">
              <span>Público do ciclo</span>
              <strong>${uniqueCount} pessoas únicas (${selectedGroupObjects.length} grupo${selectedGroupObjects.length !== 1 ? 's' : ''})</strong>
            </div>
            <div class="wizard-review-item" style="grid-column:1 / -1;">
              <span>Grupos Participantes</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
                ${selectedGroupObjects.map(g => {
                  const dot = g.color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${g.color};margin-right:4px;vertical-align:middle;"></span>` : '';
                  return `<span class="survey-group-tag">${dot}${esc(g.name)}</span>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  body += `
        </div>

        <footer class="wizard-footer">
          <div>
            ${step === 1 ? `
              <button type="button" class="btn secondary" onclick="closeSurveyWizard()">Cancelar</button>
            ` : `
              <button type="button" class="btn secondary" onclick="wizardSetStep(${step - 1})">← Voltar</button>
            `}
          </div>
          <div class="wizard-footer-right">
            ${step === 1 ? `
              <button type="button" class="btn primary" onclick="wizardSetStep(2)">Continuar: Opções de Pesquisa →</button>
            ` : step === 2 ? `
              <button type="button" class="btn primary" onclick="wizardSetStep(3)">Continuar: Prazos e Lançamento →</button>
            ` : `
              <button type="button" class="btn primary" onclick="wizardSave()" ${wz.submitting ? 'disabled' : ''}>
                ${wz.submitting ? 'Criando ciclo...' : 'Concluir e Criar Pesquisa ✓'}
              </button>
            `}
          </div>
        </footer>
      </div>
    </div>
  `;

  shell(body);
}

// Keep backward compatibility if anything references surveyForm
function surveyForm(survey) {
  openSurveyWizard(survey);
}

function openSurveyDashboard(id) {
  const current = state.surveys.find(row => row.id === id);
  if (current?.status === 'closed') { const report = state.reports.find(row => row.surveyId === id && row.published); location.hash = report ? `resultados/ciclo/${report.id}` : 'resultados/documentos'; return; }
  document.querySelector('#modal')?.remove();
  state.activeSurveyDashboardId = id;
  state.tab = 'pesquisas';
  const target = `pesquisas/ciclo/${id}`;
  if (location.hash.slice(1) === target) render(); else location.hash = target;
}

function closeSurveyDashboard() {
  state.activeSurveyDashboardId = null;
  location.hash = 'pesquisas';
}

window.openSurveyDashboard = openSurveyDashboard;
window.closeSurveyDashboard = closeSurveyDashboard;

function surveyDeleteConfirm(id, title) {
  const closed = state.surveys.find(row => row.id === id)?.status === 'closed';
  const label = closed ? 'Arquivar ciclo' : 'Excluir rascunho';
  modal(label, `<div class="modal-body stack"><h3>${esc(title)}</h3><p>${closed ? 'O ciclo sairá da lista de pesquisas. Relatórios, respostas e decisões serão preservados.' : 'O rascunho será removido. Esta operação não pode ser desfeita.'}</p><div class="modal-actions"><button class="btn secondary" data-action="close-modal">Cancelar</button><button class="btn primary" data-action="do-delete-survey" data-id="${attr(id)}">${label}</button></div></div>`);
}

function surveyStartConfirm(id) {
  const survey = state.surveys.find(s => s.id === id);
  if (!survey) return;
  const safeTitle = esc(survey.title);
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const surveyGroups = surveyGroupIds.map(gid => state.groups.find(g => g.id === gid)).filter(Boolean);
  const groupTagsHtml = surveyGroups.map(g => {
    const dot = g.color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};margin-right:6px;vertical-align:middle;"></span>` : '';
    return `<span class="survey-group-tag" style="font-size:12px;padding:3px 9px;">${dot}<strong>${esc(g.name)}</strong> (${g.memberIds.length} ${g.memberIds.length === 1 ? 'pessoa' : 'pessoas'})</span>`;
  }).join(' ');

  modal('Iniciar coleta da pesquisa', `
    <div class="modal-body" style="padding:24px 28px;">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;">
        <div style="font-size:28px;line-height:1;">🚀</div>
        <div>
          <h3 style="margin:0 0 4px;font-size:17px;color:#173d2d;">Iniciar coleta: &ldquo;${safeTitle}&rdquo;</h3>
          <p style="margin:0;color:#596d61;font-size:13px;line-height:1.5;">
            Uma vez iniciada, a pesquisa será aberta e disponibilizada para todas as pessoas dos grupos selecionados:
          </p>
        </div>
      </div>

      <div style="background:#f4f8f5;border:1px solid #d4e7d8;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <span style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#496d58;margin-bottom:8px;">
          Grupos participantes selecionados (${surveyGroups.length}):
        </span>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${groupTagsHtml || '<span style="color:#778e80;font-size:12px;">Nenhum grupo específico</span>'}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#355a46;">
          Total estimado de <strong>${survey.groupSize} participantes únicos</strong>.
        </div>
      </div>

      <div style="background:#f9fbf9;border:1px solid #dce8dd;border-radius:8px;padding:12px 14px;color:#355241;font-size:12px;line-height:1.5;margin-bottom:18px;">
        📌 <strong>Importante:</strong> Após a criação e início da coleta, a pesquisa <strong>não poderá ser reconfigurada</strong>. As respostas começarão a ser computadas imediatamente.
      </div>

      <p style="font-size:14px;font-weight:600;color:#1f3b2d;margin:0 0 16px;">
        Tem certeza de que deseja prosseguir e iniciar a coleta agora?
      </p>

      <div class="modal-actions" style="justify-content:flex-end;gap:10px;margin-top:20px;">
        <button type="button" class="btn secondary" data-action="close-modal">Cancelar ação</button>
        <button type="button" class="btn primary" data-action="do-start-survey" data-id="${attr(survey.id)}">Sim, iniciar coleta ▶</button>
      </div>
    </div>
  `);
}

function surveyDashboardView(survey) {
  const fullUrl = `${location.origin}/responder/${survey.id}`;
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const surveyGroups = surveyGroupIds.map(gid => state.groups.find(g => g.id === gid)).filter(Boolean);

  const pct = survey.groupSize > 0 ? Math.round((survey.responseCount / survey.groupSize) * 100) : 0;
  const pct70 = survey.pct70 || Math.ceil((survey.groupSize || 0) * 0.7);
  const canClose = Boolean(survey.canClose);
  const isExpired = Boolean(survey.isExpired);

  const results = survey.status === 'closed' ? survey.result : null;
  let overallAvg = null;
  let bestFactor = null;
  let worstFactor = null;

  if (results && results.length) {
    overallAvg = survey.instrument?.scoring ? null : results.reduce((s, r) => s + r.average, 0) / results.length;
    const sorted = [...results].sort((a, b) => b.average - a.average);
    bestFactor = sorted[0];
    worstFactor = sorted[sorted.length - 1];
  }

  const climateLabel = 'Percepção média do ciclo';
  const climateColor = '#1d684a';

  let body = `
    <div class="survey-dash-shell">
      <div class="survey-dash-nav">
        <button type="button" class="survey-dash-back" onclick="closeSurveyDashboard()">
          ← Voltar para a lista de pesquisas
        </button>
        <span class="fine-print">Acompanhamento da pesquisa</span>
      </div>

      <header class="survey-dash-header">
        <div class="survey-dash-titles">
          <p class="eyebrow" style="margin-bottom:4px;">DASHBOARD DO CICLO</p>
          <h1>${esc(survey.title)}</h1>
          <div class="survey-dash-meta">
            <span class="badge ${survey.status}"><span class="dot"></span>${statusLabel[survey.status]}</span>
            <span><strong>Ciclo:</strong> ${esc(survey.cycle)}</span>
            <span>&middot;</span>
            <span><strong>Modelo:</strong> ${esc(survey.model)}</span>
            ${survey.status === 'closed' ? `<span>&middot;</span> <span style="color:#2a6547;font-weight:600;">✓ Encerrada e dados consolidados</span>` : ''}
          </div>
        </div>

        <div class="survey-dash-actions">
          ${survey.status === 'draft' ? `
            <button class="btn primary" data-action="start-survey-confirm" data-id="${attr(survey.id)}">Iniciar coleta ▶</button>
          ` : survey.status === 'open' ? `
            <button class="btn secondary" data-action="copy-survey-link" data-url="${attr(fullUrl)}">Copiar link</button>
            <button class="btn primary ${canClose ? '' : 'btn-disabled-threshold'}" data-action="close-survey" data-id="${attr(survey.id)}" ${canClose ? '' : `disabled title="A pesquisa ainda não atingiu uma quantidade de respostas definida pela regra operacional para que seja possível concluí-la!"`}>
              Encerrar coleta
            </button>
          ` : `
            <button class="btn primary" data-action="print-survey-dash">Imprimir ou salvar PDF</button>
          `}
        </div>
      </header>

      <!-- 4 KPI Cards -->
      <section class="survey-kpi-grid">
        <article class="survey-kpi-card">
          <div class="survey-kpi-header">
            <span>Taxa de Resposta</span>
            <span class="survey-kpi-icon">📊</span>
          </div>
          <div class="survey-kpi-num">${pct}%</div>
          <div class="dash-progress-wrap">
            <div class="dash-progress-track">
              <div class="dash-progress-bar ${canClose ? 'ready' : ''}" style="width:${Math.min(pct, 100)}%"></div>
            </div>
            <div class="dash-progress-hint">
              <span>${survey.responseCount} de ${survey.groupSize} respostas</span>
            </div>
          </div>
          <div class="survey-kpi-note">
            ${canClose
              ? `<span style="color:#1d684a;font-weight:700;">✓ Pronto para recolhimento</span>`
              : `Faltam ${Math.max(0, pct70 - survey.responseCount)} respostas para liberar o encerramento manual antecipado.`}
          </div>
        </article>

        <article class="survey-kpi-card">
          <div class="survey-kpi-header">
            <span>Público do ciclo</span>
            <span class="survey-kpi-icon">👥</span>
          </div>
          <div class="survey-kpi-num">${survey.groupSize}</div>
          <div style="font-size:12px;color:#5a6e60;margin-top:2px;">pessoas previstas no ciclo</div>
          <div class="survey-kpi-note">
            <strong>${surveyGroups.length} grupo${surveyGroups.length !== 1 ? 's' : ''}:</strong>
            <div class="survey-group-tags" style="margin-top:6px;">
              ${surveyGroups.map(g => {
                const dot = g.color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${g.color};margin-right:4px;vertical-align:middle;"></span>` : '';
                return `<span class="survey-group-tag">${dot}${esc(g.name)}</span>`;
              }).join('')}
            </div>
          </div>
        </article>

        <article class="survey-kpi-card">
          <div class="survey-kpi-header">
            <span>Encerramento</span>
            <span class="survey-kpi-icon">📅</span>
          </div>
          <div class="survey-kpi-num" style="font-size:20px;margin-top:4px;">${date(survey.endsAt)}</div>
          <div style="font-size:12px;color:#5a6e60;margin-top:2px;">
            ${survey.status === 'closed' ? `Encerrada em ${date(survey.closedAt)}` : isExpired ? 'Data limite atingida' : 'Coleta em andamento'}
          </div>
          <div class="survey-kpi-note">
            ${survey.status === 'closed'
              ? 'Resultados finais consolidados e gravados nesta pesquisa.'
              : 'Ao atingir a data limite, o ciclo encerra automaticamente.'}
          </div>
        </article>

        <article class="survey-kpi-card">
          <div class="survey-kpi-header">
            <span>Percepção Geral</span>
            <span class="survey-kpi-icon">⭐</span>
          </div>
          <div class="survey-kpi-num" style="color:${climateColor};">
            ${overallAvg !== null ? `${fmt(overallAvg)} <span style="font-size:16px;color:#88998d;">/ 5</span>` : '—'}
          </div>
          <div style="font-size:12px;color:#5a6e60;margin-top:2px;">
            ${overallAvg !== null ? climateLabel : (survey.responseCount < 5 ? 'Aguardando 5 respostas' : 'Sem dados')}
          </div>
          <div class="survey-kpi-note">
            ${overallAvg !== null
              ? `Calculado com base em ${survey.responseCount} respostas confidenciais.`
              : 'Privacidade: médias só são exibidas com no mínimo 5 respostas.'}
          </div>
        </article>
      </section>

      <!-- Content Grid: Factors & Details -->
      <div class="survey-dash-content-grid">
        <!-- Factors breakdown -->
        <article class="survey-dash-card">
          <div class="survey-dash-card-head">
            <h2>Resultados por Tema de Percepção</h2>
            <span>${results ? `${results.length} fatores avaliados` : '8 temas psicossociais'}</span>
          </div>

          ${results && results.length ? `
            ${DashboardCharts.markup(results)}<div class="dash-factor-list">
              ${results.map(item => `
                <div class="dash-factor-row">
                  <div class="dash-factor-info">
                    <span class="dash-factor-title">${esc(item.label)}</span>
                    <span class="dash-factor-score">${fmt(item.average)} / 5</span>
                  </div>
                  <div class="dash-factor-bar">
                    <div class="dash-factor-fill" style="width:${Math.min(item.average * 20, 100)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>

            ${bestFactor && worstFactor ? `
              <div class="dash-highlights">
                <div class="dash-highlight-item positive">
                  <span class="dash-highlight-label">🌟 Ponto Forte</span>
                  <div class="dash-highlight-val">${esc(bestFactor.label)} (${fmt(bestFactor.average)}/5)</div>
                </div>
                <div class="dash-highlight-item attention">
                  <span class="dash-highlight-label">⚠️ Ponto de Atenção</span>
                  <div class="dash-highlight-val">${esc(worstFactor.label)} (${fmt(worstFactor.average)}/5)</div>
                </div>
              </div>
            ` : ''}
          ` : `
            <div style="padding:30px 20px;text-align:center;">
              <div style="font-size:36px;margin-bottom:12px;">🔒</div>
              <h3 style="font-size:16px;color:#243e30;margin-bottom:6px;">Resultados em consolidação</h3>
              <p class="muted" style="max-width:440px;margin:auto;font-size:13px;">
                ${survey.status === 'draft'
                  ? 'Inicie a coleta para liberar o formulário web aos participantes.'
                  : survey.responseCount < 5
                    ? `Foram recebidas ${survey.responseCount} respostas até o momento. Resultados são publicados somente após o encerramento, com pelo menos 5 respostas.`
                    : 'Os resultados finais serão consolidados ao recolher o ciclo.'}
              </p>
            </div>
          `}
        </article>

        <!-- Right Side: Groups breakdown and Link Share -->
        <div style="display:grid;gap:20px;">
          ${survey.status === 'open' ? `
            <div class="survey-dash-card">
              <div class="survey-dash-card-head">
                <h2>Link de Resposta da Pesquisa</h2>
                <span>Ativo para coleta</span>
              </div>
              <div class="dash-share-box">
                <strong>Compartilhe este link com os membros dos grupos participantes:</strong>
                <div class="dash-share-row">
                  <input type="text" readonly value="${attr(fullUrl)}" id="dash-survey-link-input">
                  <button class="btn primary" data-action="copy-survey-link" data-url="${attr(fullUrl)}">Copiar link</button>
                </div>
                <div style="display:flex;gap:8px;margin-top:4px;">
                  <a class="btn secondary small" href="${attr(fullUrl)}" target="_blank" rel="noopener">Abrir formulário web</a>
                </div>
                <p class="fine-print" style="margin:4px 0 0;">
                  🔒 O resultado representa o conjunto de participantes. Esta versão não apresenta resultados separados por grupo.
                </p>
              </div>
            </div>
          ` : ''}

          <div class="survey-dash-card">
            <div class="survey-dash-card-head">
              <h2>Grupos cadastrados atualmente</h2>
              <span>${surveyGroups.length} grupo${surveyGroups.length !== 1 ? 's' : ''}</span>
            </div>
            <div style="display:grid;gap:12px;">
              ${surveyGroups.map(g => {
                const dot = g.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${g.color};"></span>` : '';
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #edf1ed;border-radius:9px;background:#fafbfa;">
                    <span style="font-weight:700;display:flex;align-items:center;gap:8px;color:#20382b;">
                      ${dot} ${esc(g.name)}
                    </span>
                    <span style="font-size:12px;color:#788b7e;">
                      ${g.memberIds.length} ${g.memberIds.length === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  shell(body);
}

function surveyDetail(survey) {
  const fullUrl = `${location.origin}/responder/${survey.id}`;
  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const surveyGroups = surveyGroupIds.map(gid => state.groups.find(g => g.id === gid)).filter(Boolean);
  const groupTagsHtml = surveyGroups.map(g => {
    const c = g?.color;
    return `<span class="survey-group-tag">${c?`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;"></span>`:''}${esc(g.name)}</span>`;
  }).join('');
  const pct70 = survey.pct70 || Math.ceil((survey.groupSize||0) * 0.7);
  const pct = survey.groupSize > 0 ? Math.round((survey.responseCount/survey.groupSize)*100) : 0;
  const canClose = Boolean(survey.canClose);
  modal('Detalhes da pesquisa', `<div class="modal-body">
    <div class="detail-head">
      <span class="badge ${survey.status}"><span class="dot"></span>${statusLabel[survey.status]}</span>
      <h3>${esc(survey.title)}</h3>
      <p>${esc(survey.model)} · ${esc(survey.cycle)}</p>
    </div>
    <div class="detail-grid">
      <div><span>Grupos</span><strong>${groupTagsHtml || esc(survey.groupName)}</strong></div>
      <div><span>Participantes únicos</span><strong>${survey.groupSize}</strong></div>
      <div><span>Encerramento</span><strong>${date(survey.endsAt)}</strong></div>
      <div><span>Respostas</span><strong>${survey.status==='draft'?'Aguardando início':`${survey.responseCount} de ${survey.groupSize} enviadas (${pct}%)`}</strong></div>
    </div>
    ${survey.status==='open' ? `
      <div class="survey-close-progress">
        <div class="survey-close-progress-head">
          <span>Progresso de adesão</span>
          <strong>${pct}% <span style="color:${canClose?'#1d684a':'#8a9890'};">${canClose?'✓ Quórum atingido':'em coleta...'}</span></strong>
        </div>
        <div class="survey-progress-bar" style="margin:8px 0;">
          <div class="survey-progress-fill ${canClose?'ready':''}" style="width:${Math.min(pct,100)}%"></div>
        </div>
        <p class="fine-print" style="margin:4px 0 0;">${canClose ? 'Ciclo pronto para recolher resultados.' : `Faltam ${Math.max(0,pct70-survey.responseCount)} resposta${pct70-survey.responseCount!==1?'s':''} para liberar o recolhimento.`}</p>
      </div>` : ''}
    ${survey.status==='draft'?`
      <p class="helper">Inicie quando o(s) grupo(s) tiverem ao menos 5 pessoas únicas.</p>
      <div class="modal-actions" style="justify-content:space-between;">
        <button class="btn danger-outline" data-action="delete-survey-confirm" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}">${survey.status === 'closed' ? 'Arquivar ciclo' : 'Excluir rascunho'}</button>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" data-action="start-survey-confirm" data-id="${attr(survey.id)}">Iniciar coleta ▶</button>
        </div>
      </div>
    `:survey.status==='open'?`
      <label>Link único da pesquisa
        <input type="text" readonly value="${attr(fullUrl)}">
      </label>
      <div class="modal-actions" style="justify-content:space-between;">
        <button class="btn secondary" data-action="open-survey-dashboard" data-id="${attr(survey.id)}">Abrir acompanhamento ↗</button>
        <div style="display:flex;gap:8px;">
          <button class="btn secondary" data-action="copy-survey-link" data-url="${attr(fullUrl)}">Copiar link</button>
          <button class="btn primary ${canClose?'':'btn-disabled-threshold'}" data-action="close-survey" data-id="${attr(survey.id)}" ${canClose?'':'disabled title="Aguardando 70% de respostas ou data limite para encerramento"'}>Recolher resultados${canClose?' ✓':` (${pct}%/70%)`}</button>
        </div>
      </div>
    `:`
      ${survey.result?`
        <h4 class="detail-subtitle">Percepção consolidada do grupo</h4>
        ${DashboardCharts.markup(survey.result)}<div class="factor-list">${survey.result.map(item=>`<div class="factor"><div><strong>${esc(item.label)}</strong><span>${fmt(item.average)} / 5</span></div><div class="track"><div style="width:${item.average*20}%"></div></div></div>`).join('')}</div>
        <p class="fine-print">Levantamento exploratório com base em ${survey.responseCount} respostas.</p>
        <div class="modal-actions" style="justify-content:space-between;margin-top:20px;">
          <button class="btn danger-outline" data-action="delete-survey-confirm" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}">${survey.status === 'closed' ? 'Arquivar ciclo' : 'Excluir rascunho'}</button>
          <div style="display:flex;gap:8px;">
            <button class="btn secondary" data-action="close-modal">Fechar</button>
            <button class="btn primary" data-action="open-survey-dashboard" data-id="${attr(survey.id)}">Ver acompanhamento ↗</button>
          </div>
        </div>
      `:`
        <p class="helper">Ciclo encerrado sem volume mínimo para publicação (mínimo de 5 respostas necessárias).</p>
        <div class="modal-actions" style="justify-content:space-between;">
          <button class="btn danger-outline" data-action="delete-survey-confirm" data-id="${attr(survey.id)}" data-title="${attr(survey.title)}">${survey.status === 'closed' ? 'Arquivar ciclo' : 'Excluir rascunho'}</button>
          <button class="btn secondary" data-action="close-modal">Fechar</button>
        </div>
      `}
    `}
  </div>`);
}

function reportDetail(report) {

  modal('Relatório do ciclo', `<div class="modal-body report-detail"><div class="report-print-head"><span class="logo">e<span>·</span>equilibra</span><p>RELATÓRIO DE PERCEPÇÃO DO TRABALHO</p></div><div class="detail-head"><span class="badge ${report.published?'closed':'draft'}"><span class="dot"></span>${report.published?'Resultado coletivo':'Resultado não publicado'}</span><h3>${esc(report.title)}</h3><p>${esc(report.cycle)} · ${esc(report.model)}</p></div><div class="detail-grid"><div><span>Grupo</span><strong>${esc(report.groupName)}</strong></div><div><span>Encerrado em</span><strong>${date(report.closedAt)}</strong></div>${report.published?`<div><span>Respostas incluídas</span><strong>${report.responseCount}</strong></div>`:''}</div>${report.published?`<h4 class="detail-subtitle">Percepção por tema</h4>${DashboardCharts.markup(report.result)}<div class="factor-list">${report.result.map(item=>`<div class="factor"><div><strong>${esc(item.label)}</strong><span>${fmt(item.average)} / 5</span></div><div class="track"><div style="width:${item.average*20}%"></div></div></div>`).join('')}</div><p class="report-explain">Escala de 1 a 5. Valores maiores indicam percepção mais favorável.</p>`:`<div class="notice compact">${esc(report.suppressionReason || 'Resultado protegido ou volume insuficiente para publicação.')}</div>`}<p class="fine-print">${esc(report.methodology)}. Não é diagnóstico individual.</p>${report.instrument?.sources ? `<p class="fine-print">${report.instrument.sources.map(source => `<a href="${attr(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>`).join(" · ")}</p>` : ""}${report.instrument?.attribution ? `<p class="fine-print">${esc(report.instrument.attribution)}</p>` : ""}<div class="modal-actions report-actions"><button class="btn secondary" data-action="close-modal">Fechar</button>${report.published?'<button class="btn primary" data-action="print-report">Imprimir ou salvar PDF</button>':''}</div></div>`);
}

function surveyLinkModal(survey, link) {
  const fullUrl = `${location.origin}${link}`;
  const groupSize = survey.groupSize || survey.memberIds?.length || 0;
  modal('Pesquisa iniciada', `<div class="modal-body stack"><p class="muted">A pesquisa agora possui <strong>um link único</strong>. Compartilhe com todos os participantes do grupo.</p><div class="notice compact"><strong>Regras ativas:</strong> Limite de <strong>${groupSize} respostas</strong>. Reenvio bloqueado neste navegador por cookie. O link compartilhado não verifica a identidade e pode ser usado em outro navegador.</div><label>Link da pesquisa<div style="display:flex;gap:8px;margin-top:6px;"><input type="text" readonly value="${attr(fullUrl)}" id="single-survey-url" style="flex:1;font-weight:600;"><button class="btn primary" data-action="copy-survey-link" data-url="${attr(fullUrl)}">Copiar link</button></div></label><div class="modal-actions" style="margin-top:16px;"><a class="btn secondary" href="${attr(fullUrl)}" target="_blank" rel="noopener">Abrir formulário web</a><button class="btn primary" data-action="close-modal">Concluir</button></div></div>`);
}

async function respondent() {
  const token = location.pathname.split('/').pop();
  if (localStorage.getItem(`answered_survey_${token}`)) {
    app.innerHTML = `<main class="respond-page"><div class="respond-shell"><a class="logo" href="/">e<span>·</span>equilibra</a><div class="empty" style="margin-top:40px;"><h1>Resposta já enviada</h1><p>Você já participou desta pesquisa neste navegador.</p></div></div></main>`;
    return;
  }
  try {
    const survey = await api(`/respond/${encodeURIComponent(token)}`);
    app.innerHTML = `<main class="respond-page"><div class="respond-shell"><a class="logo" href="/">e<span>·</span>equilibra</a><p class="eyebrow top-gap">PESQUISA DE PERCEPÇÃO</p><h1>${esc(survey.title)}</h1><p class="muted">${esc(survey.instructions || "Escolha uma opção por afirmação.")}</p><p class="fine-print">Modelo: ${esc(survey.model)}</p><div class="privacy-note">O painel apresenta resultados coletivos com pelo menos 5 respostas. Participar é voluntário. Não informe nomes ou detalhes que identifiquem outras pessoas. Este formulário não é canal de denúncia ou atendimento de urgência.</div><form id="response-form" class="questions">${survey.factors.map((f,i)=>`<fieldset class="question"><legend><span>${String(i+1).padStart(2,'0')}</span>${esc(f.question)}</legend><div class="scale">${[1,2,3,4,5].map(value=>`<label><input type="radio" name="${attr(f.key)}" value="${value}" required><span>${value}<small>${esc(survey.options?.[i]?.[value-1] || ["Discordo totalmente","Discordo","Nem concordo nem discordo","Concordo","Concordo totalmente"][value-1])}</small></span></label>`).join('')}</div></fieldset>`).join('')}<button class="btn primary full" type="submit">Enviar resposta</button></form><p class="fine-print">${esc(survey.limitation || "Este questionário não constitui diagnóstico de saúde.")}</p>${survey.attribution ? `<p class="fine-print">${esc(survey.attribution)}</p>` : ""}</div></main>`;
  } catch(error) { app.innerHTML = `<main class="respond-page"><div class="respond-shell"><a class="logo" href="/">e<span>·</span>equilibra</a><div class="empty"><h1>Convite indisponível</h1><p>${esc(error.message)}</p></div></div></main>`; }
}

// ── Apply combined text + group filter to the table ──
function applyMemberFilters() {
  const q = (document.querySelector('#member-search')?.value||'').toLowerCase().trim();
  const rows = document.querySelectorAll('.member-table-row');
  let visible = 0;
  rows.forEach(row => {
    const textMatch  = !q || (row.dataset.search||'').toLowerCase().includes(q);
    const groupMatch = !state.filterGroupId || (row.dataset.groups||'').split(' ').includes(state.filterGroupId);
    const show = textMatch && groupMatch;
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const countEl = document.querySelector('#member-search-count');
  if (countEl) countEl.textContent = `${visible} ${visible===1?'pessoa':'pessoas'}${state.filterGroupId?' neste grupo':q?' encontradas':' cadastradas'}`;
}

document.addEventListener('click', async (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    const changed = location.hash.slice(1) !== state.tab;
    if (changed) location.hash = state.tab;
    document.querySelector('#modal')?.remove();
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('show');
    if (!changed) render();
    return;
  }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action, id = button.dataset.id;
  try {
    if (action === 'toggle-auth') { state.authMode = state.authMode==='login'?'register':'login'; render(); }
    if (action === 'logout') {
      try { await post('/auth/logout'); } catch (_) {}
      state.account = null;
      state.members = [];
      state.groups = [];
      state.surveys = [];
      state.reports = [];
      state.dashboard = null;
      state.tab = 'geral';
      location.hash = 'login';
      document.querySelector('#modal')?.remove();
      render();
      message('Você saiu da conta.');
      return;
    }
    if (action === 'menu') {
      const sidebar = document.querySelector('.sidebar');
      const backdrop = document.querySelector('.sidebar-backdrop');
      const open = sidebar?.classList.toggle('mobile-open');
      backdrop?.classList.toggle('show', Boolean(open));
      button.setAttribute('aria-expanded', String(open));
      const icon = button.querySelector('.menu-toggle-icon') || button;
      icon.innerHTML = Experience.icon(open ? 'fechar' : 'menu');
    }
    if (action === 'close-sidebar') {
      document.querySelector('.sidebar')?.classList.remove('mobile-open');
      document.querySelector('.sidebar-backdrop')?.classList.remove('show');
      const toggle = document.querySelector('.menu-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        const icon = toggle.querySelector('.menu-toggle-icon') || toggle;
        icon.innerHTML = Experience.icon('menu');
      }
    }
    if (action === 'close-modal') document.querySelector('#modal')?.remove();

    // (group filter is handled via the change event on #group-filter-select)

    // ── Color picker swatch ──
    if (action === 'pick-color') {
      const color = button.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      button.classList.add('selected');
      const hiddenInput = document.querySelector('#group-color-value');
      if (hiddenInput) hiddenInput.value = color;
      const preview = document.querySelector('#color-preview-bar');
      if (preview) preview.style.background = color;
      const customInput = document.querySelector('#color-custom-input');
      if (customInput) customInput.value = color;
    }

    if (action === 'new-member')    memberForm();
    if (action === 'edit-member')   memberForm(state.members.find(m=>m.id===id));
    if (action === 'delete-member') {
      const name = button.dataset.name || 'esta pessoa';
      if (!confirm(`Deseja realmente excluir ${name}? Essa pessoa será removida de todos os grupos.`)) return;
      await del(`/members/${id}`);
      document.querySelector('#modal')?.remove();
      await load();
      message('Pessoa excluída com sucesso.');
    }
    if (action === 'import-members') importModal();
    if (action === 'confirm-import') {
      if (!state.importFile) return; button.disabled = true;
      const result = await post('/members/import', state.importFile);
      document.querySelector('#modal')?.remove(); state.importFile = null;
      await load(); message(`${result.imported} pessoas cadastradas. ${result.groupsCreated} grupos criados.`);
    }
    if (action === 'new-group')    groupForm();
    if (action === 'edit-group')   groupForm(state.groups.find(g=>g.id===id));
    if (action === 'delete-group') {
      const name = button.dataset.name || 'este grupo';
      if (!confirm(`Deseja realmente excluir o grupo "${name}"? As pessoas continuarão salvas.`)) return;
      if (state.filterGroupId === id) state.filterGroupId = null;
      await del(`/groups/${id}`);
      document.querySelector('#modal')?.remove();
      await load(); message('Grupo excluído com sucesso.');
    }
    if (action === 'select-all-members') {
      document.querySelectorAll('#group-form input[name="memberIds"]').forEach(inp => {
        const row = inp.closest('.check-row');
        if (!row || row.style.display !== 'none') inp.checked = true;
      }); selectedCount();
    }
    if (action === 'clear-all-members') {
      document.querySelectorAll('#group-form input[name="memberIds"]').forEach(inp => inp.checked = false);
      selectedCount();
    }
    if (action === 'new-survey')    { openSurveyWizard(); }
    if (action === 'start-survey-confirm' || action === 'open-survey') {
      surveyStartConfirm(id);
    }
    if (action === 'do-start-survey') {
      button.disabled = true;
      const result = await post(`/surveys/${id}/open`);
      document.querySelector('#modal')?.remove();
      await load();
      surveyLinkModal(result.survey, result.link || `/responder/${id}`);
      message('Coleta iniciada com sucesso! Link pronto para envio.');
    }
    if (action === 'delete-survey-confirm') {
      surveyDeleteConfirm(id, button.dataset.title || 'esta pesquisa');
    }
    if (action === 'do-delete-survey') {
      button.disabled = true;
      await del(`/surveys/${id}`);
      document.querySelector('#modal')?.remove();
      state.activeSurveyDashboardId = null;
      await load(); message('Pesquisa removida da lista. Histórico de ciclos encerrados preservado.');
    }
    if (action === 'set-survey-days') {
      const days = Number(button.dataset.days);
      const target = new Date(Date.now() + days*86400000);
      const val = new Date(target.getTime() - target.getTimezoneOffset()*60000).toISOString().slice(0,16);
      const input = document.querySelector('input[name="endsAt"]');
      if (input) input.value = val;
    }
    if (action === 'view-survey') surveyDetail(state.surveys.find(s=>s.id===id));
    if (action === 'open-survey-dashboard') openSurveyDashboard(id);
    if (action === 'close-survey-dashboard') closeSurveyDashboard();
    if (action === 'print-survey-dash') window.print();
    if (action === 'view-report') reportDetail(state.reports.find(r=>r.id===id));
    if (action === 'print-report') { document.body.classList.add('printing-report'); window.print(); }
    if (action === 'go-people')  { state.tab = 'pessoas'; render(); }
    if (action === 'go-groups')  { state.tab = 'grupos'; render(); }
    if (action === 'close-survey') {
      button.disabled = true;
      await post(`/surveys/${id}/close`);
      await load();
      document.querySelector('#modal')?.remove();
      state.activeSurveyDashboardId = null;
      const report = state.reports.find(row => row.surveyId === id && row.published);
      location.hash = report ? `resultados/ciclo/${report.id}` : 'resultados/documentos';
      message('Ciclo encerrado. Consulte o resultado e os próximos passos.');
    }
    if (action === 'view-survey-report') {
      document.querySelector('#modal')?.remove();
      const report = state.reports.find(r => r.surveyId === id);
      if (report) {
        reportDetail(report);
      } else {
        const survey = state.surveys.find(s => s.id === id);
        if (survey) surveyDetail(survey);
      }
    }

    if (action === 'copy-survey-link') { await navigator.clipboard.writeText(button.dataset.url); message('Link único da pesquisa copiado!'); }
    if (action === 'copy-link') { await navigator.clipboard.writeText(`${location.origin}/responder/${button.dataset.token}`); message('Link copiado.'); }
  } catch(error) { message(error.message, true); }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'member-search') applyMemberFilters();
  if (event.target.id === 'group-member-search') {
    const q = event.target.value.toLowerCase().trim();
    document.querySelectorAll('#group-form .check-row').forEach(row => {
      const text = (row.dataset.text||row.textContent).toLowerCase();
      row.style.display = !q || text.includes(q) ? '' : 'none';
    });
  }
  // Custom color picker
  if (event.target.id === 'color-custom-input') {
    const color = event.target.value;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    const hidden = document.querySelector('#group-color-value');
    if (hidden) hidden.value = color;
    const preview = document.querySelector('#color-preview-bar');
    if (preview) preview.style.background = color;
  }
});

// ── Helper to synchronize custom dropdown UI ──
function syncFilterDropdownUI(groupId) {
  const dropdown = document.querySelector('#group-filter-dropdown');
  if (!dropdown) return;
  const activeGroup = state.groups.find(g => g.id === groupId);
  const activeColor = activeGroup?.color || '';
  const activeLabel = activeGroup ? activeGroup.name : 'Todos os grupos';

  const dot = document.querySelector('#filter-trigger-dot');
  if (dot) {
    if (activeColor) {
      dot.style.background = activeColor;
      dot.style.display = 'inline-block';
    } else {
      dot.style.display = 'none';
    }
  }

  const labelEl = document.querySelector('#filter-dropdown-label');
  if (labelEl) labelEl.textContent = activeLabel;

  dropdown.querySelectorAll('.custom-dropdown-item').forEach(item => {
    const isCur = (item.dataset.value || null) === (groupId || null);
    item.classList.toggle('selected', isCur);
    item.setAttribute('aria-selected', String(isCur));
    const check = item.querySelector('.dropdown-item-check');
    if (check) check.textContent = isCur ? '✓' : '';
  });
}

// ── Custom filter dropdown click handler ──
document.addEventListener('click', (event) => {
  const dropdown = document.querySelector('#group-filter-dropdown');
  if (!dropdown) return;

  const trigger = event.target.closest('#filter-dropdown-trigger');
  const optionItem = event.target.closest('.custom-dropdown-item');

  if (trigger) {
    const willOpen = !dropdown.classList.contains('open');
    dropdown.classList.toggle('open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    return;
  }

  if (optionItem && dropdown.contains(optionItem)) {
    const value = optionItem.dataset.value || '';
    state.filterGroupId = value || null;

    syncFilterDropdownUI(state.filterGroupId);

    // Sync hidden select if exists
    const select = document.querySelector('#group-filter-select');
    if (select && select.value !== value) select.value = value;

    // Close menu
    dropdown.classList.remove('open');
    dropdown.querySelector('#filter-dropdown-trigger')?.setAttribute('aria-expanded', 'false');

    applyMemberFilters();
    return;
  }

  // Click outside closes menu
  if (!dropdown.contains(event.target)) {
    dropdown.classList.remove('open');
    dropdown.querySelector('#filter-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
  }
});

// Close dropdown on Escape
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const dropdown = document.querySelector('#group-filter-dropdown');
    if (dropdown && dropdown.classList.contains('open')) {
      dropdown.classList.remove('open');
      const trigger = dropdown.querySelector('#filter-dropdown-trigger');
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.focus();
    }
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.name === 'memberIds') selectedCount();
  if (event.target.id === 'group-filter-select') {
    state.filterGroupId = event.target.value || null;
    syncFilterDropdownUI(state.filterGroupId);
    applyMemberFilters();
  }
  if (event.target.id === 'import-file') {
    try { await previewImport(event.target.files[0]); }
    catch(error) { state.importFile = null; document.querySelector('#import-confirm').disabled = true; document.querySelector('#import-preview').innerHTML = `<p class="import-error">${esc(error.message)}</p>`; }
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.matches('[data-management-form], [data-experience-form]')) return;
  const form = event.target; event.preventDefault();
  const button = form.querySelector('[type="submit"]'); if (button) button.disabled = true;
  try {
    if (form.id === 'auth-form') {
      const data = formData(form);
      state.account = await post(`/auth/${state.authMode==='register'?'register':'login'}`, data);
      state.tab = 'geral';
      location.hash = 'geral';
      await load(); message('Acesso liberado.');
    }
    if (form.id === 'settings-form') {
      const data = formData(form);
      const updated = await put('/auth/me', data);
      state.account = updated;
      render();
      message('Configurações salvas com sucesso.');
      if (button) button.disabled = false;
    }
    if (form.id === 'member-form') {
      const name  = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const phone = form.elements.phone.value.trim();
      if (!name && !email) { message('Informe ao menos o nome ou e-mail da pessoa.', true); if (button) button.disabled = false; return; }
      const groupIds = [...form.querySelectorAll('input[name="groupIds"]:checked')].map(el => el.value);
      await (form.dataset.id ? put(`/members/${form.dataset.id}`,{name,email,phone,groupIds}) : post('/members',{name,email,phone,groupIds}));
      document.querySelector('#modal')?.remove();
      await load(); message(form.dataset.id ? 'Pessoa atualizada com sucesso.' : 'Pessoa cadastrada com sucesso.');
    }
    if (form.id === 'group-form') {
      const name      = form.elements.name.value.trim();
      const color     = form.querySelector('#group-color-value')?.value || null;
      const memberIds = [...form.querySelectorAll('input[name="memberIds"]:checked')].map(i => i.value);
      await (form.dataset.id ? put(`/groups/${form.dataset.id}`,{name,color,memberIds}) : post('/groups',{name,color,memberIds}));
      document.querySelector('#modal')?.remove();
      await load(); message('Grupo salvo com sucesso.');
    }
    if (form.id === 'survey-form') {
      const data = formData(form);
      data.endsAt = new Date(data.endsAt).toISOString();
      // Collect all selected groupIds as array
      const checkedGroupIds = [...form.querySelectorAll('input[name="groupIds"]:checked')].map(el => el.value);
      if (checkedGroupIds.length === 0) { message('Selecione ao menos um grupo para a pesquisa.', true); if (button) button.disabled = false; return; }
      const payload = { title: data.title, cycle: data.cycle, model: data.model, endsAt: data.endsAt, groupIds: checkedGroupIds };
      await (form.dataset.id ? put(`/surveys/${form.dataset.id}`, payload) : post('/surveys', payload));
      document.querySelector('#modal')?.remove();
      await load(); message('Pesquisa salva como rascunho.');
    }
    if (form.id === 'response-form') {
      const answers = Object.fromEntries(new FormData(form));
      for (const key in answers) answers[key] = Number(answers[key]);
      await post(`/respond/${encodeURIComponent(location.pathname.split('/').pop())}`,{answers});
      try { localStorage.setItem(`answered_survey_${location.pathname.split('/').pop()}`, '1'); } catch { /* Server-side protection still applies when browser storage is unavailable. */ }
      app.innerHTML = `<main class="respond-page"><div class="respond-shell"><a class="logo" href="/">e<span>·</span>equilibra</a><div class="success"><div>✓</div><h1>Resposta enviada</h1><p>Obrigado por participar. Sua resposta será considerada apenas em resultados coletivos.</p></div></div></main>`;
    }
  } catch(error) { message(error.message, true); if (button) button.disabled = false; }
});

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#modal')?.remove(); });
window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'));
window.addEventListener('hashchange', () => {
  if (state.loading) return;
  if (location.pathname.startsWith('/responder/')) return;
  const h = location.hash.slice(1);
  if (!state.account) {
    if (h !== 'login') location.hash = 'login';
    render();
    return;
  }
  if (h === 'login') {
    location.hash = state.tab || 'geral';
    return;
  }
  state.tab = routeTab();
  document.querySelector('#modal')?.remove();
  window.scrollTo(0, 0);
  render();
});

(async () => {
  if (location.pathname.startsWith('/responder/')) return respondent();
  const hash = location.hash.slice(1);
  state.tab = routeTab();
  try {
    state.account = await api('/auth/me');
    if (state.account) {
      if (hash === 'login' || !hash) location.hash = state.tab;
      await load();
    } else {
      location.hash = 'login';
      render();
    }
  } catch(error) {
    state.account = null;
    location.hash = 'login';
    render();
  }
})();

 document.addEventListener('click', event => {
  const model = event.target.closest('[data-model-name]');
  if (model) window.wizardSelectModel(model.dataset.modelName);
  if (event.target.closest('[data-action="survey-catalog"]')) surveyCatalogModal();
 });
 function surveyCatalogModal() {
  const references = state.meta?.references || [];
  modal('Modelos e metodologia', `<div class="modal-body stack"><p>Não existe lista obrigatória ou exaustiva de questionários para a NR-1. A escolha depende das condições reais de trabalho e da avaliação técnica.</p><p>Disponíveis para aplicação web: ${(state.meta?.templates || []).length} modelos. Confira perguntas, fonte e limitações na criação da pesquisa.</p><h3>Instrumentos de referência</h3><p>As opções abaixo estão pesquisadas, mas ainda não podem ser aplicadas nesta plataforma. Não foram substituídas por perguntas próprias.</p>${references.map(row => `<details class="ux-details"><summary>${esc(row.name)}</summary><p>${esc(row.description)}</p><p><strong>Para habilitar:</strong> ${esc(row.limitation)}</p>${row.sources.map(source=>`<a target="_blank" rel="noopener" href="${attr(source.url)}">${esc(source.title)}</a>`).join(' · ')}</details>`).join('')}<h3>Métodos que complementam pesquisas</h3><p>Entrevistas e grupos focais; observação e análise da atividade; avaliação ergonômica preliminar e AET quando cabível; análise de jornadas, afastamentos, rotatividade e incidentes. São fontes complementares, não questionários substituíveis por uma média.</p><p>Clima, satisfação e engajamento podem apoiar a escuta, mas não demonstram sozinhos controle de riscos. Escalas de saúde e burnout exigem finalidade e tratamento adequados.</p><p><a target="_blank" rel="noopener" href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file">Orientações oficiais do MTE — GRO/PGR</a></p><button class="btn secondary" data-action="close-modal">Fechar catálogo</button></div>`);
 }
