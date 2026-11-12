/* Survey creation wizard with models catalog, cycle & periodicity setup, and N >= 5 quorum checks */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { router } from '../../core/router.js';
import { store } from '../../core/store.js';
import { get, post } from '../../core/api.js';

const MODEL_ICONS = {
  'equilibra-organizacao': 'fa-solid fa-briefcase',
  'equilibra-demandas': 'fa-solid fa-gauge-high',
  'equilibra-autonomia': 'fa-solid fa-compass',
  'equilibra-lideranca': 'fa-solid fa-handshake-angle',
  'equilibra-respeito': 'fa-solid fa-shield-halved',
  'equilibra-jornada': 'fa-solid fa-clock-rotate-left',
  'equilibra-mudancas': 'fa-solid fa-arrows-spin',
  'equilibra-pulso': 'fa-solid fa-heart-pulse',
  'equilibra-medidas': 'fa-solid fa-clipboard-check',
  'hse-indicator-pt': 'fa-solid fa-scale-balanced'
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatInputDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function renderSurveyCreate({ state }) {
  const meta = state.meta || {};
  const templates = meta.templates || [];
  const groups = state.groups || [];
  const members = state.members || [];

  // Default dates: start = now, end = now + 30 days
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startStr = formatInputDateTime(now);
  const endStr = formatInputDateTime(defaultEnd);

  const defaultMonth = MONTH_NAMES[now.getMonth()];
  const defaultYear = now.getFullYear();
  const defaultCycle = `Ciclo Mensal - ${defaultMonth}/${defaultYear}`;

  // Default model is the first template
  const defaultTemplate = templates[0] || null;
  const defaultModelName = defaultTemplate ? defaultTemplate.name : 'Organização e condições de trabalho';
  const defaultTitle = `Pesquisa de Condições de Trabalho - ${defaultMonth} ${defaultYear}`;

  // Default to selecting all groups
  const initialSelectedGroupIds = groups.map(g => g.id);
  const selectedGroups = groups.filter(g => initialSelectedGroupIds.includes(g.id));
  const distinctMemberIds = new Set(selectedGroups.flatMap(g => g.memberIds || []));
  const initialMembersCount = distinctMemberIds.size || members.length;

  const content = `
    <div class="survey-wizard-container">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 class="view-title">Novo Ciclo de Pesquisa & Diagnóstico</h1>
          <p class="view-subtitle">
            Configure o instrumento psicossocial, a periodicidade de escuta e os grupos participantes
          </p>
        </div>
        <div>
          <a href="#pesquisas" class="btn btn-secondary">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar para Pesquisas
          </a>
        </div>
      </div>

      <!-- Stepper Nav Superior -->
      <nav class="wizard-stepper" aria-label="Etapas de criação da pesquisa">
        <button type="button" class="wizard-stepper-item active" data-action="wizard-goto-step" data-step="1">
          <span class="wizard-stepper-num">1</span>
          <span class="wizard-stepper-label">Instrumento & Modelo</span>
        </button>
        <div class="wizard-stepper-divider"></div>
        <button type="button" class="wizard-stepper-item" data-action="wizard-goto-step" data-step="2">
          <span class="wizard-stepper-num">2</span>
          <span class="wizard-stepper-label">Periodicidade & Ciclo</span>
        </button>
        <div class="wizard-stepper-divider"></div>
        <button type="button" class="wizard-stepper-item" data-action="wizard-goto-step" data-step="3">
          <span class="wizard-stepper-num">3</span>
          <span class="wizard-stepper-label">Público</span>
        </button>
        <div class="wizard-stepper-divider"></div>
        <button type="button" class="wizard-stepper-item" data-action="wizard-goto-step" data-step="4">
          <span class="wizard-stepper-num">4</span>
          <span class="wizard-stepper-label">Título & Lançamento</span>
        </button>
      </nav>

      <form id="create-survey-form" data-action="submit-create-survey">
        <input type="hidden" id="selected-model-input" name="model" value="${attr(defaultModelName)}" />

        <div class="wizard-slider-viewport">
          <div class="wizard-slider-track" id="survey-wizard-track" data-current-step="1">
            <!-- SLIDE / ETAPA 1: ESCOLHA DO INSTRUMENTO / MODELO -->
            <div class="wizard-slide active" data-slide-step="1">
              <section class="wizard-section">
                <div class="wizard-section-header">
                  <h2 class="wizard-section-title">
                    <span class="wizard-step-badge">1</span>
                    Modelos de Pesquisa & Instrumentos Psicossociais
                  </h2>
                  <p class="wizard-section-subtitle">
                    Selecione o instrumento adequado à finalidade do ciclo. Você pode pré-visualizar todas as afirmações antes de decidir.
                  </p>
                </div>

                <div class="models-grid" id="survey-models-grid">
                  ${templates.map((tpl, idx) => {
                    const isSelected = tpl.name === defaultModelName || idx === 0;
                    const iconClass = MODEL_ICONS[tpl.id] || 'fa-solid fa-clipboard-question';
                    const itemCount = tpl.factors ? tpl.factors.length : (tpl.questions ? tpl.questions.length : 8);
                    const estMinutes = Math.max(1, Math.round(itemCount * 0.35));

                    return `
                      <div class="model-card ${isSelected ? 'active' : ''}" data-action="select-model-card" data-model="${attr(tpl.name)}" tabindex="0" role="button" aria-pressed="${isSelected}">
                        <input type="radio" name="model" value="${attr(tpl.name)}" ${isSelected ? 'checked' : ''} class="sr-only model-radio-input" />
                        <div>
                          <div class="model-card-header">
                            <div class="model-card-icon">
                              <i class="${iconClass}" aria-hidden="true"></i>
                            </div>
                            <div class="model-card-info">
                              <div class="model-card-category">${esc(tpl.category || 'Catálogo')}</div>
                              <h3 class="model-card-title">${esc(tpl.name)}</h3>
                            </div>
                          </div>

                          <div class="model-card-badges">
                            <span class="badge badge-neutral">
                              <i class="fa-solid fa-list-check" aria-hidden="true"></i> ${itemCount} afirmações
                            </span>
                            <span class="badge badge-subtle">
                              <i class="fa-regular fa-clock" aria-hidden="true"></i> ~${estMinutes} min
                            </span>
                          </div>

                          <p class="model-card-desc">${esc(tpl.description || '')}</p>
                        </div>

                        <div class="model-card-actions">
                          <button type="button" class="btn btn-ghost btn-sm" data-action="preview-model-questions" data-model="${attr(tpl.name)}">
                            <i class="fa-regular fa-eye" aria-hidden="true"></i> Ver Afirmações
                          </button>
                          
                          <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm model-select-btn" tabindex="-1">
                            ${isSelected ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Selecionado' : 'Selecionar'}
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>
            </div>

            <!-- SLIDE / ETAPA 2: PERIODICIDADE & CICLO -->
            <div class="wizard-slide" data-slide-step="2">
              <section class="wizard-section">
                <div class="wizard-section-header">
                  <h2 class="wizard-section-title">
                    <span class="wizard-step-badge">2</span>
                    Periodicidade & Ciclo de Escuta
                  </h2>
                  <p class="wizard-section-subtitle">
                    Defina a cadência temporal do acompanhamento e a janela de coleta das respostas.
                  </p>
                </div>

                <div class="mb-4">
                  <label class="form-label font-semibold mb-2">Cadência do Ciclo:</label>
                  <div class="periodicity-pills" id="periodicity-selector">
                    <button type="button" class="periodicity-btn active" data-action="set-periodicity" data-period="mensal" data-days="30">
                      <i class="fa-regular fa-calendar-check" aria-hidden="true"></i> Mensal (30 dias)
                    </button>
                    <button type="button" class="periodicity-btn" data-action="set-periodicity" data-period="trimestral" data-days="90">
                      <i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Trimestral (90 dias)
                    </button>
                    <button type="button" class="periodicity-btn" data-action="set-periodicity" data-period="semestral" data-days="180">
                      <i class="fa-solid fa-business-time" aria-hidden="true"></i> Semestral (6 meses)
                    </button>
                    <button type="button" class="periodicity-btn" data-action="set-periodicity" data-period="anual" data-days="365">
                      <i class="fa-solid fa-calendar-days" aria-hidden="true"></i> Anual (12 meses)
                    </button>
                    <button type="button" class="periodicity-btn" data-action="set-periodicity" data-period="personalizado" data-days="0">
                      <i class="fa-solid fa-sliders" aria-hidden="true"></i> Personalizado / Evento
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-4">
                  <div class="form-group">
                    <label for="survey-cycle-input" class="form-label">Identificador do Ciclo <span class="form-required">*</span></label>
                    <input type="text" id="survey-cycle-input" name="cycle" class="input" value="${attr(defaultCycle)}" required />
                    <span class="form-help">Nome de referência para relatórios comparativos.</span>
                  </div>

                  <div class="form-group">
                    <label for="survey-start-input" class="form-label">Data de Início da Coleta</label>
                    <input type="datetime-local" id="survey-start-input" name="startsAt" class="input" value="${attr(startStr)}" />
                    <span class="form-help">Início imediato ou agendamento futuro.</span>
                  </div>

                  <div class="form-group">
                    <label for="survey-end-input" class="form-label">Encerramento da Coleta <span class="form-required">*</span></label>
                    <input type="datetime-local" id="survey-end-input" name="endsAt" class="input" value="${attr(endStr)}" required />
                    <span class="form-help">Calculado pela cadência (ajustável).</span>
                  </div>
                </div>
              </section>
            </div>

            <!-- SLIDE / ETAPA 3: PÚBLICO-ALVO & CONFIDENCIALIDADE -->
            <div class="wizard-slide" data-slide-step="3">
              <section class="wizard-section">
                <div class="wizard-section-header">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 class="wizard-section-title">
                        <span class="wizard-step-badge">3</span>
                        Público Participante & Equipes
                      </h2>
                      <p class="wizard-section-subtitle">
                        Selecione os grupos que participarão deste ciclo de pesquisa.
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <button type="button" class="btn btn-secondary btn-sm" data-action="select-all-wizard-groups">
                        Selecionar Todos
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm" data-action="select-general-wizard-group">
                        Apenas Geral
                      </button>
                    </div>
                  </div>
                </div>

                <div class="group-picker-grid" id="wizard-groups-container">
                  ${groups.length === 0 ? `
                    <div class="empty-state p-4">
                      <p class="empty-text">Nenhum grupo cadastrado. O grupo Geral será utilizado automaticamente.</p>
                    </div>
                  ` : groups.map(g => {
                    const isChecked = initialSelectedGroupIds.includes(g.id);
                    const count = g.memberIds ? g.memberIds.length : 0;

                    return `
                      <label class="group-picker-card ${isChecked ? 'selected' : ''}" data-group-card-id="${attr(g.id)}">
                        <input type="checkbox" name="groupIds" value="${attr(g.id)}" class="group-picker-checkbox" ${isChecked ? 'checked' : ''} data-member-count="${count}" data-action="toggle-wizard-group" />
                        <div class="group-picker-info">
                          <div class="group-picker-name">${esc(g.name)}</div>
                          <div class="group-picker-count"><span class="num">${count}</span> pessoas vinculadas</div>
                        </div>
                      </label>
                    `;
                  }).join('')}
                </div>

                <div id="wizard-privacy-note">
                  ${initialMembersCount >= 5 ? `
                    <div class="privacy-note privacy-success">
                      <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                      <div>
                        <strong>Público selecionado:</strong> <span class="num font-semibold" id="wizard-total-members-count">${initialMembersCount}</span> colaboradores nos grupos selecionados.
                      </div>
                    </div>
                  ` : `
                    <div class="privacy-note privacy-warning">
                      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                      <div>
                        <strong>Atenção:</strong> Apenas <span class="num font-semibold" id="wizard-total-members-count">${initialMembersCount}</span> colaboradores selecionados. Adicione mais grupos para garantir uma amostra representativa.
                      </div>
                    </div>
                  `}
                </div>
              </section>
            </div>

            <!-- SLIDE / ETAPA 4: TÍTULO & LANÇAMENTO -->
            <div class="wizard-slide" data-slide-step="4">
              <section class="wizard-section">
                <div class="wizard-section-header">
                  <h2 class="wizard-section-title">
                    <span class="wizard-step-badge">4</span>
                    Título & Lançamento do Ciclo
                  </h2>
                  <p class="wizard-section-subtitle">
                    Revise o título que será exibido aos colaboradores no convite de participação.
                  </p>
                </div>

                <div class="form-group mb-6">
                  <label for="survey-title-input" class="form-label">Título da Pesquisa <span class="form-required">*</span></label>
                  <input type="text" id="survey-title-input" name="title" class="input input-lg" value="${attr(defaultTitle)}" required />
                  <span class="form-help">Ex: "Diagnóstico Psicossocial - Outubro 2026" ou "Pesquisa de Clima e Condições de Trabalho".</span>
                </div>
                <div class="form-group mb-4">
                  <label class="form-label font-bold text-base">Canal de Coleta e Envio <span class="form-required">*</span></label>
                  <div class="grid grid-cols-2 gap-4 mt-2">
                    <label class="channel-card cursor-pointer border-2 border-primary rounded-xl p-4 flex flex-col justify-between bg-surface" id="channel-card-web">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="collectionChannel" value="web" checked class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-solid fa-globe color-primary text-xl" aria-hidden="true"></i> Link Web Confidencial (Padrão)
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            Gera link único para resposta direta no navegador, sem necessidade de aplicativo.
                          </p>
                        </div>
                      </div>
                      <div class="mt-3 pt-3 border-t text-xs table-subtext">
                        Ideal para compartilhamento em e-mail corporativo, intranet ou cartazes/totens.
                      </div>
                    </label>

                    <label class="channel-card cursor-pointer border-2 rounded-xl p-4 flex flex-col justify-between bg-surface" id="channel-card-whatsapp">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="collectionChannel" value="whatsapp" class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-brands fa-whatsapp color-success text-xl" aria-hidden="true"></i> Convites via WhatsApp (Opcional)
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            Dispara mensagem de convite com o link individual diretamente para colaboradores cadastrados com telefone.
                          </p>
                        </div>
                      </div>
                      <div class="mt-3 pt-3 border-t text-xs flex items-center justify-between" id="wizard-wa-status-box">
                        <button type="button" class="btn btn-ghost btn-xs" data-action="open-wizard-wa-modal">
                          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Conexão Segura & Avisos
                        </button>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Opções de início da coleta -->
                <div class="form-group mb-2 mt-4">
                  <label class="form-label font-bold text-base">Início da Coleta <span class="form-required">*</span></label>
                  <p class="table-subtext mt-0 mb-3">Escolha se deseja abrir a coleta imediatamente ou deixá-la salva para iniciar manualmente mais tarde (ou na data agendada).</p>
                  <div class="grid grid-cols-2 gap-4">
                    <label class="survey-launch-option active" id="launch-option-manual">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="launchMode" value="manual" id="launch-mode-manual" checked class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-regular fa-calendar-check color-primary" aria-hidden="true"></i> Iniciar Coleta Manualmente Depois
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            A pesquisa será cadastrada e salva. A coleta <strong>não inicia sozinha</strong>; você poderá iniciá-la manualmente com um clique a qualquer momento ou aguardar o início automático na data configurada.
                          </p>
                        </div>
                      </div>
                    </label>

                    <label class="survey-launch-option" id="launch-option-immediate">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="launchMode" value="immediate" id="launch-mode-immediate" class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-solid fa-rocket color-success" aria-hidden="true"></i> Iniciar Coleta Instantaneamente
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            Abre a coleta imediatamente após a criação e já gera os links/disparos para os colaboradores começarem a responder agora.
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <!-- FOOTER FIXO COM PROGRESS BAR CENTRALIZADA E BOTÕES VOLTAR / CONTINUAR -->
        <footer class="wizard-fixed-footer" id="survey-wizard-footer" data-step="1">
          <div class="wizard-footer-inner">
            <div class="wizard-footer-left">
              <button type="button" class="btn btn-secondary" id="btn-wizard-back" data-action="wizard-prev-step">
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Cancelar
              </button>
            </div>

            <div class="wizard-footer-center">
              <div class="wizard-progress-info">
                <span class="wizard-step-title" id="wizard-step-title">Etapa 1 de 4: Instrumento & Modelo</span>
                <span class="wizard-step-pct" id="wizard-step-pct">25%</span>
              </div>
              <div class="wizard-progress-track" aria-hidden="true">
                <div class="wizard-progress-fill" id="wizard-progress-fill"></div>
              </div>
            </div>

            <div class="wizard-footer-right">
              <button type="button" class="btn btn-ghost btn-sm" data-action="submit-create-draft" title="Salvar rascunho sem abrir coleta">
                <i class="fa-regular fa-bookmark" aria-hidden="true"></i> Rascunho
              </button>
              <button type="button" class="btn btn-primary" id="btn-wizard-next" data-action="wizard-next-step">
                <span>Continuar</span> <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-lg wizard-launch-btn hidden" id="btn-wizard-launch" data-action="submit-create-survey-btn">
                <i class="fa-regular fa-bookmark" aria-hidden="true"></i> Salvar Pesquisa (Coleta Manual)
              </button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  `;

  return renderShell({
    activePath: 'pesquisas',
    breadcrumbs: [
      { label: 'Pesquisas', path: 'pesquisas' },
      { label: 'Nova Pesquisa' }
    ],
    content,
    state
  });
}

const STEP_TITLES = {
  1: 'Etapa 1 de 4: Instrumento & Modelo',
  2: 'Etapa 2 de 4: Periodicidade & Ciclo',
  3: 'Etapa 3 de 4: Público',
  4: 'Etapa 4 de 4: Título & Lançamento'
};

const STEP_PCTS = {
  1: '25%',
  2: '50%',
  3: '75%',
  4: '100%'
};

export function updateWizardValidation() {
  const track = document.getElementById('survey-wizard-track');
  const currentStep = parseInt(track?.dataset?.currentStep || '1', 10);
  const btnNext = document.getElementById('btn-wizard-next');
  const btnLaunch = document.getElementById('btn-wizard-launch');

  let isValid = false;

  if (currentStep === 1) {
    const hiddenModel = document.getElementById('selected-model-input')?.value;
    const checkedModel = document.querySelector('input[name="model"]:checked')?.value;
    isValid = Boolean(hiddenModel || checkedModel);
  } else if (currentStep === 2) {
    const cycle = document.getElementById('survey-cycle-input')?.value?.trim();
    const endsAt = document.getElementById('survey-end-input')?.value;
    const endsAtTime = endsAt ? new Date(endsAt).getTime() : 0;
    isValid = Boolean(cycle && endsAt && !isNaN(endsAtTime) && endsAtTime > Date.now());
  } else if (currentStep === 3) {
    const checked = document.querySelectorAll('#wizard-groups-container input[name="groupIds"]:checked');
    isValid = checked.length > 0;
  } else if (currentStep === 4) {
    const title = document.getElementById('survey-title-input')?.value?.trim();
    isValid = Boolean(title);
  }

  if (btnNext) {
    btnNext.disabled = !isValid;
    btnNext.classList.toggle('disabled', !isValid);
  }
  if (btnLaunch) {
    btnLaunch.disabled = !isValid;
    btnLaunch.classList.toggle('disabled', !isValid);
  }

  return isValid;
}

export function goToWizardStep(step) {
  const s = Math.max(1, Math.min(4, parseInt(step, 10) || 1));
  const track = document.getElementById('survey-wizard-track');
  const footer = document.getElementById('survey-wizard-footer');
  const stepTitle = document.getElementById('wizard-step-title');
  const stepPct = document.getElementById('wizard-step-pct');
  const btnBack = document.getElementById('btn-wizard-back');
  const btnNext = document.getElementById('btn-wizard-next');
  const btnLaunch = document.getElementById('btn-wizard-launch');

  if (track) track.dataset.currentStep = String(s);
  if (footer) footer.dataset.step = String(s);
  if (stepTitle) stepTitle.textContent = STEP_TITLES[s] || `Etapa ${s} de 4`;
  if (stepPct) stepPct.textContent = STEP_PCTS[s] || `${s * 25}%`;

  // ── Anime.js: Progress bar do wizard ──
  const progressFill = document.getElementById('wizard-progress-fill');
  if (progressFill && window.anime) {
    window.anime({
      targets: progressFill,
      width: `${s * 25}%`,
      duration: 650,
      easing: 'cubicBezier(0.16, 1, 0.3, 1)'
    });
  } else if (progressFill) {
    progressFill.style.width = `${s * 25}%`;
  }

  // Update slide classes
  document.querySelectorAll('.wizard-slide').forEach(slide => {
    const slideStep = parseInt(slide.dataset.slideStep, 10);
    slide.classList.toggle('active', slideStep === s);
  });

  // ── Anime.js: Animate active slide entrance ──
  setTimeout(() => {
    const activeSlide = document.querySelector('.wizard-slide.active');
    if (typeof window.__wizAnimateSlide === 'function') {
      window.__wizAnimateSlide(activeSlide);
    }
  }, 60);

  // Update stepper buttons
  document.querySelectorAll('.wizard-stepper-item').forEach(item => {
    const itemStep = parseInt(item.dataset.step, 10);
    item.classList.toggle('active', itemStep === s);
    item.classList.toggle('completed', itemStep < s);
  });

  // Toggle Next vs Launch button
  if (btnNext && btnLaunch) {
    if (s === 4) {
      btnNext.classList.add('hidden');
      btnLaunch.classList.remove('hidden');
      updateLaunchButtonLabel();
    } else {
      btnNext.classList.remove('hidden');
      btnLaunch.classList.add('hidden');
    }
  }

  // Toggle Back button text
  if (btnBack) {
    if (s === 1) {
      btnBack.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Cancelar';
    } else {
      btnBack.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar';
    }
  }

  updateWizardValidation();

  // Scroll smoothly to start of wizard container
  const container = document.querySelector('.survey-wizard-container');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function nextWizardStep() {
  const track = document.getElementById('survey-wizard-track');
  const currentStep = parseInt(track?.dataset?.currentStep || '1', 10);
  if (!updateWizardValidation()) {
    if (currentStep === 1) {
      showToast('Selecione um modelo psicossocial para prosseguir.', 'warning');
    } else if (currentStep === 2) {
      showToast('Preencha o identificador do ciclo e uma data válida futura para prosseguir.', 'warning');
    } else if (currentStep === 3) {
      showToast('Selecione ao menos um grupo participante.', 'warning');
    }
    return;
  }
  if (currentStep < 4) {
    goToWizardStep(currentStep + 1);
  }
}

export function prevWizardStep() {
  const track = document.getElementById('survey-wizard-track');
  const currentStep = parseInt(track?.dataset?.currentStep || '1', 10);
  if (currentStep > 1) {
    goToWizardStep(currentStep - 1);
  } else {
    router.navigate('pesquisas');
  }
}

export function mountedSurveyCreate() {
  goToWizardStep(1);

  const anm = window.anime || null;

  // ── Anime.js: Typewriter suave no view-title ──────────────────────────────
  (function startTypewriter() {
    const titleEl = document.querySelector('.survey-wizard-container .view-title');
    if (!titleEl) return;

    const fullText = titleEl.textContent.trim();
    titleEl.textContent = '';

    const cursor = document.createElement('span');
    cursor.className = 'wiz-typewriter-cursor';
    titleEl.appendChild(cursor);

    // Cursor piscante com Anime.js
    if (anm) {
      anm({
        targets: cursor,
        opacity: [1, 0],
        duration: 850,
        easing: 'steps(1)',
        loop: true
      });
    }

    let charIndex = 0;
    const BASE_DELAY = 70;
    const JITTER = 30;

    function typeNext() {
      if (charIndex >= fullText.length) {
        setTimeout(() => {
          if (anm) {
            anm({ targets: cursor, opacity: 0, duration: 500, easing: 'easeOutQuad',
              complete: () => cursor.remove() });
          } else {
            cursor.remove();
          }
        }, 2200);
        return;
      }
      const textNode = document.createTextNode(fullText[charIndex]);
      titleEl.insertBefore(textNode, cursor);
      charIndex++;

      let delay = BASE_DELAY + (Math.random() * JITTER) - (JITTER / 2);
      const ch = fullText[charIndex - 1];
      if (ch === ',' || ch === ';') delay += 100;
      else if (ch === '.' || ch === '!' || ch === '?') delay += 200;
      else if (ch === ' ') delay += 10;

      setTimeout(typeNext, Math.max(30, delay));
    }

    setTimeout(typeNext, 350);
  })();

  // ── Anime.js: Stagger de entrada dos elementos do slide ──────────────────
  function animateSlideElements(slideEl) {
    if (!slideEl || !anm) {
      // Fallback sem Anime.js: usa classes CSS simples
      if (slideEl) {
        const els = slideEl.querySelectorAll(
          '.wizard-section-header, .models-grid > .model-card, ' +
          '.periodicity-pills, .grid.grid-cols-3, .grid.grid-cols-2, ' +
          '.group-picker-grid > label, .form-group, .privacy-note, ' +
          '.channel-card, .survey-launch-option'
        );
        els.forEach((el, i) => {
          const d = Math.min(i, 9);
          el.classList.remove(...[...el.classList].filter(c => c.startsWith('wiz-')));
          el.classList.add('wiz-animate', `wiz-delay-${d}`);
          setTimeout(() => el.classList.remove('wiz-animate', `wiz-delay-${d}`), 55 + d * 60 + 550);
        });
      }
      return;
    }

    const targets = Array.from(slideEl.querySelectorAll(
      '.wizard-section-header, .models-grid > .model-card, ' +
      '.periodicity-pills, .grid.grid-cols-3, .grid.grid-cols-2, ' +
      '.group-picker-grid > label, .form-group, .privacy-note, ' +
      '.channel-card, .survey-launch-option'
    ));
    if (targets.length === 0) return;

    // Reset estado inicial (evita artefacto de flash)
    targets.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
    });

    anm({
      targets,
      opacity: [0, 1],
      translateY: [28, 0],
      duration: 580,
      delay: anm.stagger(55, { start: 60 }),
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      complete: () => {
        // Limpa inline styles após animação
        targets.forEach(el => {
          el.style.opacity = '';
          el.style.transform = '';
        });
      }
    });
  }

  // ── Anime.js: Ripple satisfatório no clique dos botões primários ──────────
  function setupButtonRipple() {
    if (!anm) return;

    const container = document.querySelector('.survey-wizard-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary, .btn-secondary, .periodicity-btn, .model-card');
      if (!btn) return;

      // Scale punch
      anm({
        targets: btn,
        scale: [1, 0.96, 1.02, 1],
        duration: 380,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }, { passive: true });
  }

  // ── Anime.js: Feedback visual ao selecionar model card ───────────────────
  function setupModelCardFeedback() {
    if (!anm) return;

    const grid = document.getElementById('survey-models-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.model-card');
      if (!card) return;

      anm({
        targets: card,
        scale: [1, 0.97, 1.02, 1],
        duration: 420,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }, { passive: true });
  }

  // Anima o slide 1 imediatamente
  setTimeout(() => {
    const firstSlide = document.querySelector('.wizard-slide.active');
    animateSlideElements(firstSlide);
  }, 120);

  // Expõe para goToWizardStep usar
  window.__wizAnimateSlide = animateSlideElements;

  // Setup de ripple e feedback
  setupButtonRipple();
  setupModelCardFeedback();

  // Setup input listeners for dynamic validation
  const cycleInput = document.getElementById('survey-cycle-input');
  const endInput = document.getElementById('survey-end-input');
  const titleInput = document.getElementById('survey-title-input');
  const radioManual = document.getElementById('launch-mode-manual');
  const radioImmediate = document.getElementById('launch-mode-immediate');

  const onInputHandler = () => updateWizardValidation();
  if (cycleInput) cycleInput.addEventListener('input', onInputHandler);
  if (endInput) endInput.addEventListener('change', onInputHandler);
  if (titleInput) titleInput.addEventListener('input', onInputHandler);

  const onModeChange = () => {
    const isImm = radioImmediate?.checked || false;
    document.getElementById('launch-option-immediate')?.classList.toggle('active', isImm);
    document.getElementById('launch-option-manual')?.classList.toggle('active', !isImm);
    updateLaunchButtonLabel();
  };
  if (radioManual) radioManual.addEventListener('change', onModeChange);
  if (radioImmediate) radioImmediate.addEventListener('change', onModeChange);

  const radioWeb = document.querySelector('input[name="collectionChannel"][value="web"]');
  const radioWa = document.querySelector('input[name="collectionChannel"][value="whatsapp"]');
  const cardWa = document.getElementById('channel-card-whatsapp');
  const cardWeb = document.getElementById('channel-card-web');
  const waStatusBox = document.getElementById('wizard-wa-status-box');

  let isWhatsAppConnected = false;

  async function checkAndUpdateWhatsAppConnection() {
    try {
      const res = await get('/whatsapp/status');
      isWhatsAppConnected = Boolean(res && res.connected);

      if (radioWa) {
        if (!isWhatsAppConnected) {
          radioWa.disabled = true;
          if (radioWa.checked) {
            radioWa.checked = false;
            if (radioWeb) radioWeb.checked = true;
          }
          cardWa?.classList.add('opacity-60', 'cursor-not-allowed');
          cardWa?.classList.remove('border-primary');
          cardWeb?.classList.add('border-primary');
          if (waStatusBox) {
            waStatusBox.innerHTML = `
              <div class="flex items-center gap-1 color-text-muted">
                <i class="fa-solid fa-circle-xmark color-danger" aria-hidden="true"></i>
                <span>Desconectado</span>
              </div>
              <button type="button" class="btn btn-secondary btn-xs" data-action="open-wizard-wa-modal">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Conectar Aparelho
              </button>
            `;
          }
        } else {
          radioWa.disabled = false;
          cardWa?.classList.remove('opacity-60', 'cursor-not-allowed');
          if (waStatusBox) {
            waStatusBox.innerHTML = `
              <div class="flex items-center gap-1 color-success font-medium">
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
                <span>+${esc(res.phone || 'Conectado')}</span>
              </div>
              <button type="button" class="btn btn-ghost btn-xs" data-action="open-wizard-wa-modal">
                <i class="fa-solid fa-gear" aria-hidden="true"></i> Gerenciar
              </button>
            `;
          }
        }
      }
    } catch {
      // Falha silenciosa de checagem, mantém WhatsApp desabilitado por precaução
      if (radioWa) {
        radioWa.disabled = true;
        if (radioWa.checked && radioWeb) radioWeb.checked = true;
        cardWa?.classList.add('opacity-60', 'cursor-not-allowed');
      }
    }
  }

  // Verifica status imediatamente ao abrir a tela
  checkAndUpdateWhatsAppConnection();

  const onChannelChange = () => {
    const isWa = radioWa?.checked || false;
    if (isWa && !isWhatsAppConnected) {
      if (radioWeb) radioWeb.checked = true;
      if (radioWa) radioWa.checked = false;
      cardWa?.classList.remove('border-primary');
      cardWeb?.classList.add('border-primary');
      showToast('Conecte seu WhatsApp via QR Code antes de selecionar este canal.', 'warning');
      openWizardWhatsAppWarningModal();
      return;
    }
    cardWa?.classList.toggle('border-primary', isWa);
    cardWeb?.classList.toggle('border-primary', !isWa);
    if (isWa) {
      openWizardWhatsAppWarningModal();
    }
  };

  if (cardWa) {
    cardWa.addEventListener('click', (e) => {
      if (!isWhatsAppConnected && !e.target.closest('button')) {
        showToast('WhatsApp não está conectado. Conecte o aparelho para habilitar.', 'warning');
        openWizardWhatsAppWarningModal();
      }
    });
  }

  if (radioWeb) radioWeb.addEventListener('change', onChannelChange);
  if (radioWa) radioWa.addEventListener('change', onChannelChange);
}


// ── Model Selection & Preview Logic ──

export function selectModel(modelName) {
  if (!modelName) return;

  const hiddenInput = document.getElementById('selected-model-input');
  if (hiddenInput) hiddenInput.value = modelName;

  const radios = document.querySelectorAll('input[name="model"]');
  radios.forEach(r => {
    r.checked = (r.value === modelName);
  });

  const cards = document.querySelectorAll('.model-card');
  cards.forEach(card => {
    const isTarget = card.dataset.model === modelName;
    card.classList.toggle('active', isTarget);
    card.setAttribute('aria-pressed', isTarget ? 'true' : 'false');

    const btn = card.querySelector('.model-select-btn');
    if (btn) {
      if (isTarget) {
        btn.className = 'btn btn-primary btn-sm model-select-btn';
        btn.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Selecionado';
      } else {
        btn.className = 'btn btn-secondary btn-sm model-select-btn';
        btn.textContent = 'Selecionar';
      }
    }
  });

  // Suggest title update if generic or matching another model pattern
  const titleInput = document.getElementById('survey-title-input');
  const cycleInput = document.getElementById('survey-cycle-input');
  if (titleInput) {
    const cycleVal = cycleInput ? cycleInput.value : '';
    titleInput.value = `${modelName} - ${cycleVal || 'Novo Ciclo'}`;
  }

  updateWizardValidation();
  showToast(`Modelo selecionado: ${modelName}`, 'info');
}

export function openModelPreviewModal(modelName) {
  const state = store.getState();
  const templates = state.meta?.templates || [];
  const tpl = templates.find(t => t.name === modelName);

  if (!tpl) {
    showToast('Modelo não encontrado no catálogo.', 'error');
    return;
  }

  const questions = tpl.factors
    ? tpl.factors.map((f, i) => ({ num: i + 1, factor: f[1], text: f[2] }))
    : (tpl.questions
        ? tpl.questions.map((q, i) => ({ num: i + 1, factor: 'Item de Avaliação', text: q }))
        : []);

  const content = `
    <div class="py-2">
      <div class="card bg-subtle p-3 mb-4">
        <div class="flex items-center justify-between mb-1">
          <strong class="color-primary">${esc(tpl.name)}</strong>
          <span class="badge badge-neutral">${questions.length} afirmações</span>
        </div>
        <p class="table-subtext m-0">${esc(tpl.description || '')}</p>
        ${tpl.instructions ? `<p class="table-subtext mt-2 mb-0"><strong>Instruções ao participante:</strong> ${esc(tpl.instructions)}</p>` : ''}
      </div>

      <h4 class="font-semibold mb-3">Afirmações do Instrumento:</h4>
      
      <div class="questions-preview-list">
        ${questions.map(q => `
          <div class="question-preview-item">
            <div class="question-num">${q.num}</div>
            <div class="question-body">
              <div class="question-factor">${esc(q.factor)}</div>
              <p class="question-text">${esc(q.text)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Fechar</button>
    <button type="button" class="btn btn-primary" data-action="choose-model-from-modal" data-model="${attr(tpl.name)}">
      <i class="fa-solid fa-check" aria-hidden="true"></i> Escolher Este Modelo
    </button>
  `;

  openDialog({
    title: `Pré-visualização: ${tpl.name}`,
    content,
    footer
  });
}

// ── Periodicity & Cycle Logic ──

export function setPeriodicity(period, days) {
  const pills = document.querySelectorAll('.periodicity-btn');
  pills.forEach(p => p.classList.toggle('active', p.dataset.period === period));

  const startInput = document.getElementById('survey-start-input');
  const endInput = document.getElementById('survey-end-input');
  const cycleInput = document.getElementById('survey-cycle-input');

  const startDate = startInput?.value ? new Date(startInput.value) : new Date();
  const numDays = parseInt(days, 10);

  if (numDays > 0 && endInput) {
    const endDate = new Date(startDate.getTime() + numDays * 24 * 60 * 60 * 1000);
    endInput.value = formatInputDateTime(endDate);
  }

  if (cycleInput) {
    const m = MONTH_NAMES[startDate.getMonth()];
    const y = startDate.getFullYear();
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;

    if (period === 'mensal') {
      cycleInput.value = `Ciclo Mensal - ${m}/${y}`;
    } else if (period === 'trimestral') {
      cycleInput.value = `Ciclo Trimestral - ${quarter}º Trimestre/${y}`;
    } else if (period === 'semestral') {
      cycleInput.value = `Ciclo Semestral - ${startDate.getMonth() < 6 ? '1º' : '2º'} Semestre/${y}`;
    } else if (period === 'anual') {
      cycleInput.value = `Ciclo Anual - ${y}`;
    } else if (period === 'personalizado') {
      cycleInput.value = `Ciclo Especial - ${m}/${y}`;
    }
  }

  updateWizardValidation();
}

// ── Groups & Quorum Logic ──

export function updateWizardQuorum() {
  const state = store.getState();
  const groups = state.groups || [];
  const checkedBoxes = document.querySelectorAll('#wizard-groups-container input[name="groupIds"]:checked');
  const selectedGroupIds = Array.from(checkedBoxes).map(cb => cb.value);

  // Update card selected visual states
  document.querySelectorAll('.group-picker-card').forEach(card => {
    const cb = card.querySelector('input[type="checkbox"]');
    card.classList.toggle('selected', Boolean(cb && cb.checked));
  });

  const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));
  const distinctMemberIds = new Set(selectedGroups.flatMap(g => g.memberIds || []));
  const count = distinctMemberIds.size;

  const noteContainer = document.getElementById('wizard-privacy-note');
  if (noteContainer) {
    if (count >= 5) {
      noteContainer.innerHTML = `
        <div class="privacy-note privacy-success">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <div>
            <strong>Público selecionado:</strong> <span class="num font-semibold" id="wizard-total-members-count">${count}</span> colaboradores convidados.
          </div>
        </div>
      `;
    } else {
      noteContainer.innerHTML = `
        <div class="privacy-note privacy-warning">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <div>
            <strong>Atenção:</strong> Apenas <span class="num font-semibold" id="wizard-total-members-count">${count}</span> colaboradores nos grupos selecionados. Adicione mais grupos para uma amostra representativa.
          </div>
        </div>
      `;
    }
  }

  updateWizardValidation();
}

export function selectAllWizardGroups() {
  const checkboxes = document.querySelectorAll('#wizard-groups-container input[name="groupIds"]');
  checkboxes.forEach(cb => { cb.checked = true; });
  updateWizardQuorum();
}

export function selectGeneralWizardGroup() {
  const state = store.getState();
  const groups = state.groups || [];
  const general = groups.find(g => g.name.toLowerCase() === 'geral') || groups[0];

  const checkboxes = document.querySelectorAll('#wizard-groups-container input[name="groupIds"]');
  checkboxes.forEach(cb => {
    cb.checked = general ? cb.value === general.id : true;
  });
  updateWizardQuorum();
}

// ── Submit Survey Creation ──

export async function submitSurveyCreation({ openImmediately = null } = {}) {
  const form = document.getElementById('create-survey-form');
  if (!form) return;

  // Se openImmediately não foi explicitamente fornecido, lê o modo de lançamento selecionado
  if (openImmediately === null) {
    const isImmediate = document.getElementById('launch-mode-immediate')?.checked || false;
    openImmediately = isImmediate;
  }

  const title = form.title?.value?.trim();
  const cycle = form.cycle?.value?.trim();
  const modelRadio = form.querySelector('input[name="model"]:checked');
  const modelHidden = document.getElementById('selected-model-input');
  const model = (modelRadio?.value || modelHidden?.value || form.model?.value || '').trim();
  const startsAtRaw = form.startsAt?.value;
  const endsAtRaw = form.endsAt?.value;

  const checkedBoxes = form.querySelectorAll('input[name="groupIds"]:checked');
  const groupIds = Array.from(checkedBoxes).map(cb => cb.value);

  if (!model) {
    showToast('Selecione um modelo de pesquisa.', 'error');
    return;
  }
  if (!cycle) {
    showToast('Informe o identificador do ciclo.', 'error');
    return;
  }
  if (!title) {
    showToast('Informe o título da pesquisa.', 'error');
    return;
  }
  if (groupIds.length === 0) {
    showToast('Selecione ao menos um grupo participante.', 'error');
    return;
  }
  if (!endsAtRaw) {
    showToast('Informe a data de encerramento da coleta.', 'error');
    return;
  }

  const endsAtTime = new Date(endsAtRaw).getTime();
  if (isNaN(endsAtTime) || endsAtTime <= Date.now()) {
    showToast('A data de encerramento deve ser no futuro.', 'error');
    return;
  }

  const selectedChannel = document.querySelector('input[name="collectionChannel"]:checked')?.value || 'web';

  const payload = {
    collectionChannel: selectedChannel,
    title,
    cycle,
    model,
    groupIds,
    startsAt: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
    endsAt: new Date(endsAtTime).toISOString()
  };

  const btnLaunch = document.getElementById('btn-wizard-launch');
  if (btnLaunch) {
    btnLaunch.disabled = true;
    btnLaunch.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Salvando...';
  }

  try {
    if (selectedChannel === 'whatsapp') {
      const waCheck = await get('/whatsapp/status');
      if (!waCheck || !waCheck.connected) {
        showToast('WhatsApp não está conectado. Conecte o aparelho ou escolha o canal Web.', 'error');
        if (btnLaunch) {
          btnLaunch.disabled = false;
          btnLaunch.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Iniciar Pesquisa';
        }
        openWizardWhatsAppWarningModal();
        return;
      }
    }

    const survey = await post('/surveys', payload);

    if (openImmediately) {
      if (btnLaunch) btnLaunch.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Abrindo coleta...';
      const ch = document.querySelector('input[name="collectionChannel"]:checked')?.value || 'web';
      await post(`/surveys/${survey.id}/open`, { collectionChannel: ch });
      if (ch === 'whatsapp') {
        showToast('Ciclo iniciado! Convites sendo enviados pelo WhatsApp.', 'success');
      } else {
        showToast('Ciclo iniciado! Convites com link sendo enviados por e-mail para os colaboradores.', 'success');
      }
      await store.loadSurveys();
      router.navigate(`pesquisas/${survey.id}/distribuicao`);
    } else {
      await store.loadSurveys();
      showToast('Pesquisa salva com sucesso. A coleta está pronta para ser aberta manualmente ou na data agendada.', 'success');
      router.navigate('pesquisas');
    }
  } catch (err) {
    showToast(err.message || 'Erro ao criar pesquisa.', 'error');
    if (btnLaunch) {
      btnLaunch.disabled = false;
      updateLaunchButtonLabel();
    }
  }
}

export function updateLaunchButtonLabel() {
  const isImmediate = document.getElementById('launch-mode-immediate')?.checked || false;
  const btnLaunch = document.getElementById('btn-wizard-launch');
  if (!btnLaunch) return;
  if (isImmediate) {
    btnLaunch.className = 'btn btn-primary btn-lg wizard-launch-btn';
    btnLaunch.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Criar e Iniciar Coleta Agora';
  } else {
    btnLaunch.className = 'btn btn-secondary btn-lg wizard-launch-btn';
    btnLaunch.innerHTML = '<i class="fa-regular fa-bookmark" aria-hidden="true"></i> Salvar Pesquisa (Coleta Manual)';
  }
}

/**
 * Modal de alerta e conexão segura do WhatsApp exibido durante a criação do ciclo
 */
export async function openWizardWhatsAppWarningModal() {
  openDialog({
    title: 'Aviso de Segurança & Envio via WhatsApp',
    content: `
      <div id="wizard-wa-modal-body" class="p-2">
        <div class="flex items-center justify-center p-8">
          <i class="fa-solid fa-spinner fa-spin color-primary" aria-hidden="true"></i>
          <span class="ml-2 font-medium">Verificando status do aparelho...</span>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-action="close-dialog">Entendi</button>
    `,
    size: 'lg'
  });

  const container = document.getElementById('wizard-wa-modal-body');
  if (!container) return;

  try {
    const status = await get('/whatsapp/qr');
    const isConnected = Boolean(status.connected);

    container.innerHTML = `
      <div class="wa-warning-banner">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <div class="wa-warning-title">Aviso de Responsabilidade e Diretrizes da Meta</div>
          <p class="wa-warning-desc">
            • <strong>Disparo a partir do seu número:</strong> As mensagens serão enviadas diretamente em nome do aparelho que você conectar.<br>
            • <strong>Riscos de Banimento:</strong> O WhatsApp (Meta) pune envios em massa de mensagens padronizadas. Dispare apenas para colaboradores que esperam o contato e nunca utilize chips novos sem histórico prévio.<br>
            • <strong>Coleta Confidencial:</strong> A IA e as perguntas não funcionam dentro do WhatsApp. O colaborador receberá apenas o convite fixo com link individual e seguro para responder no navegador.
          </p>
        </div>
      </div>

      <div class="card bg-surface p-4 border mb-4">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${isConnected ? 'fa-circle-check color-success' : 'fa-circle-exclamation color-warning'}" aria-hidden="true"></i>
            <span class="font-bold">Status do Aparelho:</span>
            <span class="badge ${isConnected ? 'badge-success' : 'badge-neutral'}">${isConnected ? '+' + esc(status.phone || 'Conectado') : 'Desconectado'}</span>
          </div>
          ${isConnected ? `
            <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="wizard-disconnect-wa">
              <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> Desconectar
            </button>
          ` : ''}
        </div>

        ${!isConnected ? `
          <div class="wa-qr-container my-3">
            ${status.qrDataUrl ? `
              <img src="${status.qrDataUrl}" alt="QR Code WhatsApp" class="wa-qr-image mb-3" />
              <div class="text-center">
                <h4 class="font-bold mb-1">Aponte a câmera do seu WhatsApp</h4>
                <p class="table-subtext m-0">No celular: WhatsApp &gt; Configurações/Menu &gt; Aparelhos Conectados &gt; Conectar um Aparelho</p>
              </div>
            ` : `
              <div class="text-center p-6">
                <i class="fa-solid fa-spinner fa-spin color-primary text-3xl mb-3" aria-hidden="true"></i>
                <p class="font-medium mb-1">Inicializando conexão segura...</p>
                <p class="table-subtext m-0">O QR Code aparecerá aqui em instantes.</p>
              </div>
            `}
          </div>
          <div class="flex justify-end">
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-wizard-wa-modal">
              <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Atualizar Status
            </button>
          </div>
        ` : `
          <div class="wa-message-preview-box">
            <div class="text-xs font-semibold mb-1 color-primary">Prévia da Mensagem Fixa de Envio:</div>
            Olá! O RH convida você a participar da nossa Pesquisa Confidencial sobre Condições de Trabalho: {link}

Leva menos de 3 minutos. Sua percepção é fundamental para construirmos um ambiente de trabalho mais saudável!
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state p-4">
        <i class="fa-solid fa-circle-exclamation color-danger mb-2" aria-hidden="true"></i>
        <p class="font-medium">Falha ao obter status do WhatsApp.</p>
        <p class="table-subtext">${esc(err.message || 'Erro de conexão')}</p>
      </div>
    `;
  }
}




