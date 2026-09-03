/**
 * EQUILIBRA SST — DASHBOARD EXECUTIVO
 * Lógica limpa e modular para o painel simplificado
 */

const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') && window.location.port === '3000'
  ? '' : 'http://localhost:3000';

const DIMENSIONS_META = {
  demandas_psicologicas: { name: 'Demandas & Prazos', icon: 'fa-brain' },
  trabalho_ativo_competencias: { name: 'Pausas & Autonomia', icon: 'fa-hourglass-half' },
  apoio_social_lideranca: { name: 'Liderança & Suporte', icon: 'fa-user-group' },
  compensacao_reconhecimento: { name: 'Reconhecimento', icon: 'fa-award' },
  dupla_presenca_familia: { name: 'Vida Familiar & Trabalho', icon: 'fa-house-user' },
  organizacao_gestao: { name: 'Organização & Turnos', icon: 'fa-calendar-days' },
  assedio_moral_sexual: { name: 'Prevenção de Assédio', icon: 'fa-shield-halved' }
};

const state = {
  sessions: [],
  reports: [],
  auditLogs: [],
  surveyLinks: [],
  selectedSector: 'all',
  selectedLinkId: 'all',
  selectedSessionId: null,
  searchQuery: ''
};

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', async () => {
  setupSidebarNav();
  setupEventListeners();
  await checkHealth();
  await loadData();

  const params = new URLSearchParams(window.location.search);
  if (params.get('report')) {
    clickTab('individual');
    window.selectWorkerById(params.get('report'));
  }
});

/* ── SIDEBAR NAVIGATION ── */
function setupSidebarNav() {
  const tabs = [
    { btn: 'tab-overview',    view: 'view-overview',    title: 'Visão Geral' },
    { btn: 'tab-links',       view: 'view-links',       title: 'Links de Pesquisa' },
    { btn: 'tab-individual',  view: 'view-individual',  title: 'Diagnósticos Individuais' },
    { btn: 'tab-plans',       view: 'view-plans',       title: 'Plano de Ação 5W2H' },
    { btn: 'tab-governance',  view: 'view-governance',  title: 'Auditoria' }
  ];

  tabs.forEach(({ btn, view, title }) => {
    document.getElementById(btn)?.addEventListener('click', () => {
      tabs.forEach(t => {
        document.getElementById(t.btn)?.classList.remove('active');
        const v = document.getElementById(t.view);
        if (v) { v.style.display = 'none'; v.classList.remove('active'); }
      });
      document.getElementById(btn)?.classList.add('active');
      const viewEl = document.getElementById(view);
      if (viewEl) { viewEl.style.display = 'flex'; viewEl.classList.add('active'); }
      const pt = document.getElementById('page-title');
      if (pt) pt.textContent = title;
    });
  });
}

function clickTab(key) {
  document.getElementById(`tab-${key}`)?.click();
}

/* ── EVENT LISTENERS ── */
function setupEventListeners() {
  // Filtro de setor
  document.getElementById('global-sector-filter')?.addEventListener('change', (e) => {
    state.selectedSector = e.target.value;
    updateFilterPill();
    renderAll();
  });

  // Limpar filtro
  document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
    state.selectedSector = 'all';
    state.selectedLinkId = 'all';
    const sel = document.getElementById('global-sector-filter');
    if (sel) sel.value = 'all';
    updateFilterPill();
    renderAll();
  });

  // Refresh
  document.getElementById('btn-refresh-data')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-data');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    await loadData();
    if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
  });

  // Refresh audit
  document.getElementById('btn-refresh-audit-logs')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-audit-logs');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    try {
      const res = await fetch(`${API_BASE}/api/lgpd/audit-logs`);
      state.auditLogs = await res.json();
      renderAuditTab();
    } catch(e) { console.error(e); }
    if (btn) btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Atualizar';
  });

  // Print
  document.getElementById('btn-print-action-plan')?.addEventListener('click', () => window.print());

  // Search
  document.getElementById('input-search-worker')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderWorkerList();
  });

  // Modal: abrir
  const openModal = () => {
    const m = document.getElementById('modal-create-link');
    if (m) m.style.display = 'flex';
  };
  document.getElementById('btn-top-open-modal-link')?.addEventListener('click', openModal);
  document.getElementById('btn-open-create-link-modal')?.addEventListener('click', openModal);

  // Modal: fechar
  const closeModal = () => {
    const m = document.getElementById('modal-create-link');
    if (m) m.style.display = 'none';
  };
  document.getElementById('btn-close-create-link-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-create-link')?.addEventListener('click', closeModal);

  // Modal: criar link
  document.getElementById('form-create-link')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('input-link-title').value;
    const sector = document.getElementById('select-link-sector').value;
    const adminName = document.getElementById('input-link-admin-name').value;
    const adminEmail = document.getElementById('input-link-admin-email').value;

    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';

    try {
      const res = await fetch(`${API_BASE}/api/survey-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sector, adminName, adminEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        e.target.reset();
        closeModal();
        await loadData();
        clickTab('links');
      } else {
        alert(data.error || 'Erro ao criar link.');
      }
    } catch(err) {
      alert('Erro: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Gerar Link';
    }
  });
}

function updateFilterPill() {
  const pill = document.getElementById('active-filter-pill');
  const text = document.getElementById('active-filter-text');
  if (!pill || !text) return;

  const parts = [];
  if (state.selectedSector !== 'all') parts.push(state.selectedSector);
  if (state.selectedLinkId !== 'all') {
    const l = state.surveyLinks.find(l => l.id === state.selectedLinkId);
    if (l) parts.push(l.title);
  }

  if (parts.length) {
    pill.style.display = 'inline-flex';
    text.textContent = parts.join(' • ');
  } else {
    pill.style.display = 'none';
  }
}

/* ── LOAD DATA ── */
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const dot = document.getElementById('ai-status-dot');
    const label = document.querySelector('.sidebar-footer-label');
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = data.model ? `IA: ${data.model.split('/').pop()}` : 'IA Conectada';
  } catch {
    const dot = document.getElementById('ai-status-dot');
    if (dot) dot.className = 'status-dot offline';
  }
}

async function loadData() {
  try {
    const [sessRes, repRes, auditRes, linksRes] = await Promise.all([
      fetch(`${API_BASE}/api/sessions`),
      fetch(`${API_BASE}/api/reports`),
      fetch(`${API_BASE}/api/lgpd/audit-logs`),
      fetch(`${API_BASE}/api/survey-links`)
    ]);

    state.sessions = await sessRes.json();
    state.reports = await repRes.json();
    state.auditLogs = await auditRes.json();
    state.surveyLinks = await linksRes.json();

    // Atualiza badges
    const bl = document.getElementById('badge-total-links');
    if (bl) bl.textContent = state.surveyLinks.length;
    const bd = document.getElementById('badge-total-diagnostics');
    if (bd) bd.textContent = state.sessions.length;

    renderAll();
  } catch(err) {
    console.error('Erro ao carregar dados:', err);
  }
}

function getFiltered() {
  let sessions = state.sessions;
  let reports = state.reports;

  if (state.selectedSector !== 'all') {
    sessions = sessions.filter(s => s.profile?.sector === state.selectedSector);
  }
  if (state.selectedLinkId !== 'all') {
    sessions = sessions.filter(s => s.profile?.linkId === state.selectedLinkId);
  }

  const ids = new Set(sessions.map(s => s.id));
  reports = reports.filter(r => ids.has(r.sessionId) || ids.has(r.id));

  return { sessions, reports };
}

function renderAll() {
  renderKPIs();
  renderDimensionsChart();
  renderFocusAndSectors();
  renderLinksTab();
  renderWorkerList();
  render5W2H();
  renderAuditTab();
}

/* ── KPIs ── */
function renderKPIs() {
  const { sessions, reports } = getFiltered();

  document.getElementById('kpi-total-sessions').textContent = sessions.length;

  // Risco médio
  let totalScore = 0, count = 0;
  reports.forEach(r => {
    if (r.dimensions) Object.values(r.dimensions).forEach(d => { totalScore += (d.score || 4); count++; });
  });
  const avg = count > 0 ? (totalScore / count) : 0;
  const scoreEl = document.getElementById('kpi-risk-score');
  const iconEl = document.getElementById('kpi-risk-icon');

  if (sessions.length === 0) {
    if (scoreEl) scoreEl.textContent = '—';
  } else {
    if (scoreEl) scoreEl.textContent = avg > 0 ? avg.toFixed(1) : '—';
    if (iconEl) {
      iconEl.className = avg >= 12 ? 'kpi-icon rose' : (avg >= 8 ? 'kpi-icon amber' : 'kpi-icon emerald');
    }
  }

  // Maior foco
  const dimScores = {};
  reports.forEach(r => {
    if (r.dimensions) Object.entries(r.dimensions).forEach(([k, d]) => {
      dimScores[k] = dimScores[k] || { name: d.name || k, total: 0, n: 0 };
      dimScores[k].total += (d.score || 4);
      dimScores[k].n++;
    });
  });
  const sorted = Object.values(dimScores).sort((a, b) => (b.total/b.n) - (a.total/a.n));
  const topDim = sorted[0];
  const critEl = document.getElementById('kpi-critical-dim');
  if (critEl) critEl.textContent = topDim ? topDim.name : '—';

  // Links ativos
  const active = state.surveyLinks.filter(l => l.active !== false && !l.used).length;
  const linkEl = document.getElementById('kpi-active-links');
  if (linkEl) linkEl.textContent = active;
}

/* ── DIMENSÕES ── */
function renderDimensionsChart() {
  const container = document.getElementById('dimensions-chart-grid');
  if (!container) return;

  const { reports } = getFiltered();
  const dimMap = { ...DIMENSIONS_META };

  const html = Object.entries(dimMap).map(([key, meta]) => {
    let total = 0, count = 0, evidence = 'Nenhuma anomalia identificada.';

    reports.forEach(r => {
      const d = r.dimensions?.[key];
      if (d) {
        total += (d.score || 4);
        count++;
        if (d.findings && d.findings.length > 10 && evidence.startsWith('Nenhuma')) {
          evidence = d.findings;
        }
      }
    });

    const avg = count > 0 ? (total / count) : 4;
    const pct = Math.min(100, Math.round((avg / 25) * 100));
    const color = avg >= 12 ? 'rose' : (avg >= 8 ? 'amber' : 'green');
    const label = avg >= 12 ? 'Crítico' : (avg >= 8 ? 'Atenção' : 'Controlado');

    return `
      <div class="dim-card">
        <div class="dim-head">
          <span class="dim-name">
            <i class="fa-solid ${meta.icon}" style="color: var(--blue); font-size: 0.82rem;"></i>
            ${meta.name}
          </span>
          <span class="dim-badge ${color}">${label} (${avg.toFixed(1)})</span>
        </div>
        <div class="dim-bar-track">
          <div class="dim-bar-fill ${color}" style="width:${pct}%"></div>
        </div>
        <div class="dim-evidence">${evidence}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/* ── FOCOS & SETORES ── */
function renderFocusAndSectors() {
  const { reports, sessions } = getFiltered();

  // Focos
  const focusList = document.getElementById('overview-focus-alerts-list');
  if (focusList) {
    const items = [];
    reports.forEach(r => {
      if (r.dimensions) Object.entries(r.dimensions).forEach(([k, d]) => {
        if ((d.score || 0) >= 8) items.push({ name: d.name || k, score: d.score, findings: d.findings || '' });
      });
    });

    if (items.length === 0) {
      focusList.innerHTML = `<div class="focus-item green">
        <i class="fa-solid fa-circle-check focus-item-icon green"></i>
        <div><div class="focus-item-title">Ambiente Controlado</div>
        <div class="focus-item-desc">Nenhuma não-conformidade identificada.</div></div>
      </div>`;
    } else {
      focusList.innerHTML = items.slice(0, 3).map(item => `
        <div class="focus-item ${item.score >= 12 ? 'rose' : 'amber'}">
          <i class="fa-solid fa-triangle-exclamation focus-item-icon ${item.score >= 12 ? 'rose' : 'amber'}"></i>
          <div>
            <div class="focus-item-title">${item.name} — Score ${item.score}</div>
            <div class="focus-item-desc">${item.findings.substring(0, 120)}${item.findings.length > 120 ? '...' : ''}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Setores
  const sectorList = document.getElementById('overview-sector-breakdown');
  if (sectorList) {
    if (sessions.length === 0) {
      sectorList.innerHTML = `<div style="color:var(--text-dim);font-size:0.8rem;padding:1rem 0;">Nenhuma amostragem disponível.</div>`;
    } else {
      const map = {};
      sessions.forEach(s => { const sec = s.profile?.sector || 'Geral'; map[sec] = (map[sec] || 0) + 1; });
      sectorList.innerHTML = Object.entries(map).map(([name, n]) => `
        <div class="sector-row">
          <span class="sector-name">${name}</span>
          <span class="sector-count">${n} coleta${n > 1 ? 's' : ''}</span>
        </div>
      `).join('');
    }
  }
}

/* ── LINKS ── */
function renderLinksTab() {
  const container = document.getElementById('survey-links-container');
  if (!container) return;

  if (!state.surveyLinks.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem 2rem;background:var(--surface);border:1px dashed var(--border-strong);border-radius:var(--radius);">
        <i class="fa-solid fa-link-slash" style="font-size:2rem;color:var(--text-dim);display:block;margin-bottom:0.65rem;"></i>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">Nenhum link criado. Crie o primeiro link de pesquisa.</p>
        <button id="btn-empty-create-link" class="btn-primary-sm"><i class="fa-solid fa-plus"></i> Criar Link</button>
      </div>`;
    document.getElementById('btn-empty-create-link')?.addEventListener('click', () => {
      document.getElementById('modal-create-link').style.display = 'flex';
    });
    return;
  }

  const origin = window.location.origin || 'http://localhost:3000';
  container.innerHTML = state.surveyLinks.map(link => {
    const fullUrl = `${origin}/?link=${link.id}`;
    const isUsed = link.used === true;
    const isActive = link.active !== false && !isUsed;
    const badgeCls = isActive ? 'active' : (isUsed ? 'used' : 'paused');
    const badgeText = isActive ? 'Disponível' : (isUsed ? 'Concluído' : 'Pausado');
    const sessions = state.sessions.filter(s => s.profile?.linkId === link.id);

    return `<div class="link-card ${isUsed ? 'used' : ''}">
      <div class="link-card-top">
        <div>
          <div class="link-title">${link.title}</div>
          <div class="link-sector"><i class="fa-solid fa-industry" style="color:var(--cyan);margin-right:0.3rem;"></i>${link.sector === 'all' ? 'Todos os Setores' : link.sector}</div>
        </div>
        <span class="link-status-badge ${badgeCls}">${badgeText}</span>
      </div>

      <div class="link-url-row">
        <span class="link-url-text">${fullUrl}</span>
        <button class="btn-copy" onclick="copyUrl('${fullUrl}', this)">
          <i class="fa-solid fa-copy"></i> Copiar
        </button>
      </div>

      <div class="link-meta">
        <span>${sessions.length} resposta${sessions.length !== 1 ? 's' : ''}</span>
        <span>Resp.: ${link.adminName || 'Gestor'}</span>
      </div>

      <div class="link-actions">
        ${!isUsed ? `
          <a href="${fullUrl}" target="_blank" class="link-action-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> Testar</a>
          <button class="link-action-btn" onclick="toggleLink('${link.id}')">
            <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'}"></i> ${isActive ? 'Pausar' : 'Reativar'}
          </button>
        ` : `<span style="font-size:0.72rem;color:var(--blue);"><i class="fa-solid fa-lock"></i> Fechado</span>`}
        <button class="link-action-btn ${state.selectedLinkId === link.id ? 'filter-on' : ''}" onclick="filterByLink('${link.id}')">
          <i class="fa-solid fa-filter"></i>
        </button>
        <button class="link-action-btn danger" onclick="deleteLink('${link.id}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

window.copyUrl = (url, btn) => {
  navigator.clipboard?.writeText(url).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--emerald)"></i> Copiado!';
    setTimeout(() => btn.innerHTML = orig, 2000);
  }).catch(() => prompt('Copie o link:', url));
};

window.filterByLink = (linkId) => {
  state.selectedLinkId = state.selectedLinkId === linkId ? 'all' : linkId;
  updateFilterPill();
  renderAll();
  clickTab('overview');
};

window.toggleLink = async (linkId) => {
  try {
    await fetch(`${API_BASE}/api/survey-links/${linkId}/toggle`, { method: 'PATCH' });
    await loadData();
  } catch(e) { alert('Erro: ' + e.message); }
};

window.deleteLink = async (linkId) => {
  if (!confirm('Remover este link? Respostas já coletadas não serão perdidas.')) return;
  try {
    await fetch(`${API_BASE}/api/survey-links/${linkId}`, { method: 'DELETE' });
    if (state.selectedLinkId === linkId) state.selectedLinkId = 'all';
    await loadData();
  } catch(e) { alert('Erro: ' + e.message); }
};

/* ── DIAGNÓSTICOS ── */
function renderWorkerList() {
  const container = document.getElementById('individual-cards-container');
  const countEl = document.getElementById('individual-list-count');
  if (!container) return;

  const { sessions, reports } = getFiltered();
  let shown = sessions;

  if (state.searchQuery) {
    shown = shown.filter(s =>
      s.id?.toLowerCase().includes(state.searchQuery) ||
      s.profile?.sector?.toLowerCase().includes(state.searchQuery) ||
      s.profile?.workerRole?.toLowerCase().includes(state.searchQuery)
    );
  }

  if (countEl) countEl.textContent = `${shown.length} registro${shown.length !== 1 ? 's' : ''}`;

  if (!shown.length) {
    container.innerHTML = `<div style="color:var(--text-dim);font-size:0.8rem;padding:1rem;text-align:center;">Nenhum diagnóstico encontrado.</div>`;
    return;
  }

  const repMap = new Map(reports.map(r => [r.sessionId || r.id, r]));

  container.innerHTML = shown.map(s => {
    const rep = repMap.get(s.id);
    const score = rep?.overallRiskScore || 4;
    const cat = rep?.overallRiskCategory || 'low';
    const color = cat === 'critical' || cat === 'high' ? 'rose' : (cat === 'medium' ? 'amber' : 'green');
    const label = cat === 'critical' || cat === 'high' ? 'Alto' : (cat === 'medium' ? 'Médio' : 'Baixo');
    const code = `Colaborador #${s.id.substring(4, 9).toUpperCase()}`;

    return `<div class="worker-card ${s.id === state.selectedSessionId ? 'active' : ''}" onclick="selectWorkerById('${s.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
        <span class="worker-card-name">${code}</span>
        <span class="risk-pill ${color}">${label} (${score})</span>
      </div>
      <div class="worker-card-meta">${s.profile?.sector || 'Setor'} • ${new Date(s.createdAt).toLocaleDateString('pt-BR')}</div>
    </div>`;
  }).join('');
}

window.selectWorkerById = async (sessionId) => {
  state.selectedSessionId = sessionId;
  renderWorkerList();

  const detail = document.getElementById('individual-detail-container');
  if (!detail) return;
  detail.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--blue);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>`;

  try {
    const [sRes] = await Promise.all([fetch(`${API_BASE}/api/sessions/${sessionId}`)]);
    const session = await sRes.json();
    let report = null;
    if (session.reportId) {
      const rRes = await fetch(`${API_BASE}/api/reports/${session.reportId}`);
      if (rRes.ok) report = await rRes.json();
    }
    renderDetail(session, report, detail);
  } catch(e) {
    detail.innerHTML = `<div style="color:var(--rose);padding:1.5rem;">Erro ao carregar diagnóstico.</div>`;
  }
};

function renderDetail(session, report, container) {
  const code = `Colaborador #${session.id.substring(4, 9).toUpperCase()}`;

  const history = (session.history || []).map((h, i) => `
    <div class="transcript-step">
      <span class="transcript-tag">Etapa ${i+1}</span>
      <div class="transcript-q">${h.question}</div>
      <div class="transcript-a">"${h.userAnswer}"</div>
      ${h.aiObservation ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:4px;"><i class="fa-solid fa-robot" style="color:var(--blue)"></i> ${h.aiObservation}</div>` : ''}
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1rem;padding-bottom:0.85rem;border-bottom:1px solid var(--border);">
      <div>
        <h2 style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:4px;"><i class="fa-solid fa-user-shield" style="color:var(--blue)"></i> ${code}</h2>
        <div style="font-size:0.78rem;color:var(--text-muted);">${session.profile?.sector} • Turno ${session.profile?.shift} • Cargo: ${session.profile?.workerRole || '—'}</div>
      </div>
      <span class="privacy-tag"><i class="fa-solid fa-lock"></i> Sigilo ativo</span>
    </div>

    ${report?.executiveSummary ? `<div style="background:var(--blue-dim);border-left:3px solid var(--blue);padding:0.7rem 0.85rem;border-radius:4px;font-size:0.8rem;color:#cbd5e1;line-height:1.45;margin-bottom:1rem;">
      <strong style="color:#fff;">Sumário:</strong> ${report.executiveSummary}
    </div>` : ''}

    <h3 style="font-size:0.88rem;font-weight:700;color:#fff;margin-bottom:0.6rem;"><i class="fa-solid fa-comments" style="color:var(--emerald)"></i> Transcrição da Entrevista</h3>
    <div class="transcript-list">${history || '<div style="color:var(--text-dim);font-size:0.8rem;">Nenhuma interação registrada.</div>'}</div>
  `;
}

/* ── 5W2H ── */
function render5W2H() {
  const tbody = document.getElementById('collective-5w2h-tbody');
  if (!tbody) return;

  const { reports } = getFiltered();
  const actions = [];
  reports.forEach(r => { if (Array.isArray(r.actionPlan5W2H)) actions.push(...r.actionPlan5W2H); });

  if (!actions.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-dim);">Nenhuma medida pendente.</td></tr>`;
    return;
  }

  tbody.innerHTML = actions.map(a => `
    <tr>
      <td><strong>${a.what || '—'}</strong></td>
      <td style="color:var(--text-muted)">${a.why || '—'}</td>
      <td>${a.where || '—'}</td>
      <td><strong>${a.who || 'SESMT'}</strong></td>
      <td style="color:var(--amber)">${a.when || 'A definir'}</td>
      <td style="color:var(--text-muted);font-size:0.76rem">${a.how || '—'}</td>
    </tr>
  `).join('');
}

/* ── AUDITORIA ── */
function renderAuditTab() {
  const tbody = document.getElementById('audit-logs-tbody');
  if (!tbody) return;

  if (!state.auditLogs?.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2.5rem;color:var(--text-dim);">Nenhum evento registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.auditLogs.map(log => {
    const date = new Date(log.timestamp).toLocaleString('pt-BR');
    let actionStyle = 'color:var(--blue)';
    if (log.action?.includes('DELETION') || log.action?.includes('REVOCATION')) actionStyle = 'color:var(--rose)';
    else if (log.action?.includes('CREATED') || log.action?.includes('COMPILED')) actionStyle = 'color:var(--emerald)';

    return `<tr>
      <td style="font-family:monospace;font-size:0.74rem;color:var(--text-muted)">${date}</td>
      <td style="${actionStyle};font-weight:700">${log.action || '—'}</td>
      <td><code style="font-size:0.76rem">${log.performedBy || 'SISTEMA'}</code></td>
      <td style="font-size:0.76rem;color:var(--text-muted)">${log.details || '—'}</td>
    </tr>`;
  }).join('');
}
