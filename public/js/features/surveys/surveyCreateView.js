/* Survey creation wizard with models catalog, cycle & periodicity setup, and N >= 5 quorum checks */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { router } from '../../core/router.js';
import { store } from '../../core/store.js';
import { post } from '../../core/api.js';

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
          <span class="wizard-stepper-label">Público & Quórum</span>
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
                          
                          <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm model-select-btn" data-action="select-model-card" data-model="${attr(tpl.name)}">
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
                        Selecione os grupos e verifique a conformidade com a regra de anonimato psicossocial (N ≥ 5).
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
                        <strong>Quórum Protegido:</strong> <span class="num font-semibold" id="wizard-total-members-count">${initialMembersCount}</span> colaboradores nos grupos selecionados. Atende plenamente à diretriz de anonimato psicossocial (mínimo de 5 respostas para emissão de relatório).
                      </div>
                    </div>
                  ` : `
                    <div class="privacy-note privacy-warning">
                      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                      <div>
                        <strong>Atenção ao Quórum:</strong> Apenas <span class="num font-semibold" id="wizard-total-members-count">${initialMembersCount}</span> colaboradores selecionados. Para proteger o anonimato dos respondentes, a plataforma só consolida resultados com ao menos 5 participantes respondentes.
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
                    <label class="channel-card cursor-pointer border-2 border-primary rounded-xl p-4 flex flex-col justify-between bg-surface" id="channel-card-whatsapp">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="collectionChannel" value="whatsapp" checked class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-brands fa-whatsapp color-success text-xl" aria-hidden="true"></i> WhatsApp Bot Interativo
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            Dispara as perguntas individualmente no WhatsApp de cada colaborador participante.
                          </p>
                        </div>
                      </div>
                      <div class="mt-3 pt-3 border-t text-xs flex items-center justify-between" id="wizard-wa-status-box">
                        <span id="wizard-wa-status-badge"><i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Conectar Aparelho</span>
                        <a href="/wa/connect" target="_blank" class="btn btn-ghost btn-xs">
                          <i class="fa-solid fa-qrcode" aria-hidden="true"></i> Ver QR Code
                        </a>
                      </div>
                    </label>

                    <label class="channel-card cursor-pointer border-2 rounded-xl p-4 flex flex-col justify-between bg-surface" id="channel-card-web">
                      <div class="flex items-start gap-3">
                        <input type="radio" name="collectionChannel" value="web" class="mt-1" />
                        <div>
                          <div class="font-bold text-base flex items-center gap-2">
                            <i class="fa-solid fa-globe color-primary text-xl" aria-hidden="true"></i> Link Web Anônimo
                          </div>
                          <p class="text-sm table-subtext mt-1 mb-0">
                            Gera links únicos e link de acesso geral para preenchimento direto no navegador.
                          </p>
                        </div>
                      </div>
                      <div class="mt-3 pt-3 border-t text-xs table-subtext">
                        Ideal para envio por e-mail ou totens na empresa.
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
              <button type="button" class="btn btn-primary btn-lg wizard-launch-btn hidden" id="btn-wizard-launch" data-action="submit-create-survey-btn">
                <i class="fa-solid fa-rocket" aria-hidden="true"></i> Iniciar Ciclo & Abrir Coleta
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
  3: 'Etapa 3 de 4: Público & Quórum',
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

  if (track) {
    track.dataset.currentStep = String(s);
  }
  if (footer) {
    footer.dataset.step = String(s);
  }
  if (stepTitle) {
    stepTitle.textContent = STEP_TITLES[s] || `Etapa ${s} de 4`;
  }
  if (stepPct) {
    stepPct.textContent = STEP_PCTS[s] || `${s * 25}%`;
  }

  // Update slide classes
  document.querySelectorAll('.wizard-slide').forEach(slide => {
    const slideStep = parseInt(slide.dataset.slideStep, 10);
    slide.classList.toggle('active', slideStep === s);
  });

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

  // Setup input listeners for dynamic validation
  const cycleInput = document.getElementById('survey-cycle-input');
  const endInput = document.getElementById('survey-end-input');
  const titleInput = document.getElementById('survey-title-input');

  const onInputHandler = () => updateWizardValidation();
  if (cycleInput) cycleInput.addEventListener('input', onInputHandler);
  if (endInput) endInput.addEventListener('change', onInputHandler);
  if (titleInput) titleInput.addEventListener('input', onInputHandler);
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
            <strong>Quórum Protegido:</strong> <span class="num font-semibold" id="wizard-total-members-count">${count}</span> colaboradores convidados. Atende à diretriz de anonimato psicossocial (mínimo de 5 respostas para emissão de relatório).
          </div>
        </div>
      `;
    } else {
      noteContainer.innerHTML = `
        <div class="privacy-note privacy-warning">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <div>
            <strong>Atenção ao Quórum:</strong> Apenas <span class="num font-semibold" id="wizard-total-members-count">${count}</span> colaboradores nos grupos selecionados. Para proteger a confidencialidade dos colaboradores, a plataforma exige quórum mínimo de 5 respondentes.
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

export async function submitSurveyCreation({ openImmediately = true } = {}) {
  const form = document.getElementById('create-survey-form');
  if (!form) return;

  const title = form.title?.value?.trim();
  const cycle = form.cycle?.value?.trim();
  const modelRadio = form.querySelector('input[name="model"]:checked');
  const modelHidden = document.getElementById('selected-model-input');
  const model = (modelRadio?.value || modelHidden?.value || form.model?.value || '').trim();
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

  const payload = {
    collectionChannel: (document.querySelector('input[name="collectionChannel"]:checked')?.value || 'whatsapp'),
    title,
    cycle,
    model,
    groupIds,
    endsAt: new Date(endsAtTime).toISOString()
  };

  const btnLaunch = document.getElementById('btn-launch-survey');
  if (btnLaunch) {
    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Salvando ciclo...';
  }

  try {
    const survey = await post('/surveys', payload);

    if (openImmediately) {
      if (btnLaunch) btnLaunch.textContent = 'Abrindo coleta e gerando links...';
      const ch = document.querySelector('input[name="collectionChannel"]:checked')?.value || 'whatsapp';
      await post(`/surveys/${survey.id}/open`, { collectionChannel: ch });
      if (ch === 'whatsapp') {
        showToast('Ciclo iniciado! Convites sendo enviados pelo WhatsApp.', 'success');
      }
      await store.loadSurveys();
      showToast('Ciclo de pesquisa iniciado com sucesso! Coleta aberta.', 'success');
      router.navigate(`pesquisas/${survey.id}/distribuicao`);
    } else {
      await store.loadSurveys();
      showToast('Rascunho de pesquisa salvo com sucesso.', 'success');
      router.navigate('pesquisas');
    }
  } catch (err) {
    showToast(err.message || 'Erro ao criar pesquisa.', 'error');
    if (btnLaunch) {
      btnLaunch.disabled = false;
      btnLaunch.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Iniciar Ciclo & Abrir Coleta';
    }
  }
}
