import { WidgetEngine } from './widgets.js';

// Base da API para suportar tanto acesso direto (localhost:3000) quanto portas alternativas (ex: Live Server)
const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') && window.location.port === '3000'
  ? ''
  : 'http://localhost:3000';

if (window.location.protocol === 'file:') {
  console.warn('⚠️ ATENÇÃO: Você abriu a página diretamente pelo arquivo (file://). Acesse http://localhost:3000 no navegador para o funcionamento da IA.');
}

// Estado global da aplicação do operário
const state = {
  sessionId: localStorage.getItem('equilibra_last_session') || null,
  currentStepData: null,
  stepStartTime: null,
  isTtsEnabled: true,
  currentSpokenText: '',
  linkId: null,
  linkData: null,
  // Wizard state
  wizard: {
    workerName: '',
    workerRole: '',
    sector: 'Usinagem & Torneamento',
    shift: '1º Turno (Manhã)',
    companyTime: 'Menos de 6 meses'
  }
};

// Elementos DOM
const dom = {
  invalidLinkView: document.getElementById('invalid-link-view'),
  invalidLinkMessage: document.getElementById('invalid-link-message'),
  onboardingView: document.getElementById('onboarding-view'),
  interviewView: document.getElementById('interview-view'),
  completedView: document.getElementById('completed-view'),
  campaignBadgeContainer: document.getElementById('campaign-badge-container'),
  campaignNameLabel: document.getElementById('campaign-name-label'),
  mainQuestionText: document.getElementById('main-question-text'),
  widgetContainer: document.getElementById('widget-container'),
  aiTypingIndicator: document.getElementById('ai-typing-indicator'),
  btnToggleTts: document.getElementById('btn-toggle-tts'),
};

let currentTypewriterToken = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ====================================================
 * MOTION ENGINE — Iluminação Atmosférica Otimizada por GPU (60fps)
 * ====================================================
 */
const MotionEngine = {
  isSpeaking: false,

  init() {
    // Configurações de iluminação
  },

  startSpeaking() {
    this.isSpeaking = true;
    const card = dom.interviewView;
    if (card) card.classList.add('is-speaking');
  },

  stopSpeaking() {
    this.isSpeaking = false;
    const card = dom.interviewView;
    if (card) card.classList.remove('is-speaking');
  }
};

/**
 * ====================================================
 * VOICE ENGINE — Síntese de Voz Resiliente e Natural
 * ====================================================
 * Protegido contra Garbage Collection do V8, bugs assíncronos do Chromium,
 * congelamento de 15s e restrições de autoplay.
 */
const VoiceEngine = {
  activeUtterances: new Set(),
  keepAliveInterval: null,
  isUnlocked: false,
  cachedVoices: [],

  init() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.refreshVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.refreshVoices();
      }

      // Destravamento de áudio universal no primeiro gesto de interação
      const unlockAudioHandler = () => {
        this.unlockAudio();
        window.removeEventListener('pointerdown', unlockAudioHandler);
        window.removeEventListener('click', unlockAudioHandler);
        window.removeEventListener('keydown', unlockAudioHandler);
        window.removeEventListener('touchstart', unlockAudioHandler);
      };
      window.addEventListener('pointerdown', unlockAudioHandler, { passive: true });
      window.addEventListener('click', unlockAudioHandler, { passive: true });
      window.addEventListener('keydown', unlockAudioHandler, { passive: true });
      window.addEventListener('touchstart', unlockAudioHandler, { passive: true });
    }
  },

  refreshVoices() {
    if (!('speechSynthesis' in window)) return [];
    this.cachedVoices = window.speechSynthesis.getVoices() || [];
    return this.cachedVoices;
  },

  unlockAudio() {
    if (this.isUnlocked || !('speechSynthesis' in window)) return;
    this.isUnlocked = true;
    try {
      window.speechSynthesis.resume();
      const unlockUtterance = new SpeechSynthesisUtterance('.');
      unlockUtterance.volume = 0.01;
      unlockUtterance.rate = 10;
      unlockUtterance.onend = () => {
        this.activeUtterances.delete(unlockUtterance);
      };
      unlockUtterance.onerror = () => {
        this.activeUtterances.delete(unlockUtterance);
      };
      this.activeUtterances.add(unlockUtterance);
      window.speechSynthesis.speak(unlockUtterance);
    } catch (err) {
      console.warn('VoiceEngine unlock warning:', err);
    }
  },

  getBestVoice() {
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : this.refreshVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Filtra vozes em Português do Brasil (pt-BR)
    const ptBrVoices = voices.filter(v => 
      v.lang && (v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.toLowerCase().replace('_', '-').includes('pt-br'))
    );

    // Prioridade para vozes brasileiras femininas e naturais
    const femaleKeywords = [
      'francisca', 'thalita', 'maria', 'leticia', 'luciana', 'yeda', 'fernanda', 
      'google português do brasil', 'female', 'mulher', 'natural', 'neural'
    ];

    for (const kw of femaleKeywords) {
      const found = ptBrVoices.find(v => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    if (ptBrVoices.length > 0) return ptBrVoices[0];

    // 2. Qualquer voz em português
    const anyPt = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('pt'));
    if (anyPt) return anyPt;

    return null;
  },

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        this.stopKeepAlive();
      }
    }, 5000);
  },

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  },

  async speak(text, onStartCallback, onEndCallback) {
    if (!state.isTtsEnabled || !('speechSynthesis' in window)) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return Promise.resolve();
    }

    const naturalText = cleanTextForSpeech(text);
    if (!naturalText) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return Promise.resolve();
    }

    this.unlockAudio();

    // Se houver fala anterior, cancela e aguarda o microtask do Chromium para não cancelar a nova
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      await sleep(60);
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    return new Promise((resolve) => {
      let started = false;
      let finished = false;

      const utterance = new SpeechSynthesisUtterance(naturalText);
      this.activeUtterances.add(utterance);
      window._activeSpeechUtterance = utterance;

      const voice = this.getBestVoice();
      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.04;
      utterance.volume = 1.0;

      const handleStart = () => {
        if (!started) {
          started = true;
          MotionEngine.startSpeaking();
          this.startKeepAlive();
          if (onStartCallback) onStartCallback();
        }
      };

      const handleEnd = () => {
        if (!finished) {
          finished = true;
          this.activeUtterances.delete(utterance);
          MotionEngine.stopSpeaking();
          this.stopKeepAlive();
          if (onEndCallback) onEndCallback();
          resolve(true);
        }
      };

      const handleError = (e) => {
        console.warn('VoiceEngine notice (evento/interrupção):', e.error || e);
        this.activeUtterances.delete(utterance);
        handleStart();
        handleEnd();
      };

      utterance.onstart = handleStart;
      utterance.onend = handleEnd;
      utterance.onerror = handleError;

      // Fallback de segurança para não bloquear a interface se o browser atrasar onstart
      setTimeout(() => {
        handleStart();
      }, 700);

      try {
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.error('VoiceEngine speak error:', err);
        handleStart();
        handleEnd();
      }
    });
  },

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterances.clear();
    this.stopKeepAlive();
    MotionEngine.stopSpeaking();
  }
};

/**
 * Orquestração em sincronia estrita: O texto é digitado enquanto
 * a voz neural é reproduzida suavemente.
 */
async function speakAndType(text, token, baseSpeed = 36) {
  dom.mainQuestionText.innerHTML = '';
  
  const textSpan = document.createElement('span');
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'typewriter-cursor';
  
  dom.mainQuestionText.appendChild(textSpan);
  dom.mainQuestionText.appendChild(cursorSpan);

  // 1. Inicia áudio via VoiceEngine
  let speechPromise = null;
  if (state.isTtsEnabled) {
    speechPromise = VoiceEngine.speak(text);
  } else {
    MotionEngine.startSpeaking();
  }

  // 2. DIGITAÇÃO: Executada de forma fluida
  for (let i = 0; i < text.length; i++) {
    if (token !== currentTypewriterToken) {
      VoiceEngine.stop();
      return false;
    }
    
    const char = text[i];
    const nextChar = text[i + 1] || '';
    const prevChar = text[i - 1] || '';

    if (char === ' ') {
      textSpan.appendChild(document.createTextNode(' '));
    } else {
      const charSpan = document.createElement('span');
      charSpan.className = 'char-pop';
      charSpan.textContent = char;
      textSpan.appendChild(charSpan);
    }

    let delay = baseSpeed + (Math.floor(Math.random() * 8) - 4);
    if (delay < 20) delay = 20;

    if (['.', '!', '?'].includes(char)) {
      if (nextChar !== '.' && nextChar !== '!' && nextChar !== '?') {
        delay = 240;
      } else {
        delay = 120;
      }
    } else if ([',', ';', ':', '—', '-'].includes(char)) {
      delay = 150;
    } else if (char === ' ' && [',', '.', '!', '?', ';'].includes(prevChar)) {
      delay = baseSpeed + 20;
    }

    await sleep(delay);
  }

  if (cursorSpan.parentNode) {
    await sleep(150);
    if (cursorSpan.parentNode) {
      cursorSpan.parentNode.removeChild(cursorSpan);
    }
  }

  // Se o áudio ainda estiver reproduzindo, aguarda o término
  if (speechPromise) {
    await Promise.race([speechPromise, sleep(9000)]);
  }

  MotionEngine.stopSpeaking();
  return token === currentTypewriterToken;
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  VoiceEngine.init();
  await checkSurveyLinkFromUrl();
  loadDpoInfo();
  MotionEngine.init();
  WidgetEngine.init(dom.widgetContainer, handleUserAnswer);
  updateTtsButtonUi();
});

async function checkSurveyLinkFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const linkId = urlParams.get('link') || urlParams.get('linkId') || urlParams.get('campaign');

  // Se nenhum link foi informado na URL
  if (!linkId) {
    if (dom.onboardingView) dom.onboardingView.style.display = 'none';
    if (dom.invalidLinkView) {
      dom.invalidLinkView.style.display = 'block';
      if (dom.invalidLinkMessage) {
        dom.invalidLinkMessage.textContent = 'Nenhum link de pesquisa foi informado na URL. O acesso a esta avaliação exige um link exclusivo e ativo gerado pelo Administrador / SESMT da sua empresa.';
      }
    }
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/api/survey-links/verify/${encodeURIComponent(linkId)}`);
    const data = await res.json();

    if (!res.ok || !data.valid) {
      if (dom.onboardingView) dom.onboardingView.style.display = 'none';
      if (dom.invalidLinkView) {
        dom.invalidLinkView.style.display = 'block';
        if (dom.invalidLinkMessage) {
          dom.invalidLinkMessage.textContent = data.error || 'Link de pesquisa inválido, expirado ou pausado pelo administrador.';
        }
      }
      return false;
    }

    // Link 100% Válido e Ativo no Banco de Dados
    state.linkId = data.link.id;
    state.linkData = data.link;

    if (dom.invalidLinkView) dom.invalidLinkView.style.display = 'none';
    if (dom.onboardingView) dom.onboardingView.style.display = 'block';

    if (dom.campaignBadgeContainer && dom.campaignNameLabel) {
      dom.campaignBadgeContainer.style.display = 'flex';
      dom.campaignNameLabel.textContent = `${data.link.title}${data.link.adminName ? ` (${data.link.adminName})` : ''}`;
    }

    // Pre-selects the sector chip if link has a fixed sector
    if (data.link.sector && data.link.sector !== 'all') {
      state.wizard.sector = data.link.sector;
      document.querySelectorAll('[data-sector]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sector === data.link.sector);
      });
    }

    return true;
  } catch (err) {
    console.error('Erro ao verificar link no servidor:', err);
    if (dom.onboardingView) dom.onboardingView.style.display = 'none';
    if (dom.invalidLinkView) {
      dom.invalidLinkView.style.display = 'block';
      if (dom.invalidLinkMessage) {
        dom.invalidLinkMessage.textContent = 'Erro de comunicação ao validar o link de pesquisa no servidor. Verifique sua conexão e tente novamente.';
      }
    }
    return false;
  }
}

function updateTtsButtonUi() {
  if (!dom.btnToggleTts) return;
  dom.btnToggleTts.classList.toggle('active', state.isTtsEnabled);
  if (state.isTtsEnabled) {
    dom.btnToggleTts.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    dom.btnToggleTts.title = 'Voz da IA: Ativada (Clique para silenciar)';
  } else {
    dom.btnToggleTts.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    dom.btnToggleTts.title = 'Voz da IA: Silenciada (Clique para ativar)';
  }
}

async function loadDpoInfo() {
  // DPO info modal removed from new simplified UI
}

function setupEventListeners() {
  // TTS toggle
  if (dom.btnToggleTts) {
    dom.btnToggleTts.addEventListener('click', () => {
      state.isTtsEnabled = !state.isTtsEnabled;
      updateTtsButtonUi();
      if (!state.isTtsEnabled) {
        VoiceEngine.stop();
      } else {
        VoiceEngine.unlockAudio();
        VoiceEngine.speak('Áudio ativado.');
      }
    });
  }

  setupWizardListeners();
}

function setupWizardListeners() {
  // ── Etapa 1: Aceite da Política de Privacidade ──
  const consentCheck = document.getElementById('privacy-consent-check');
  const btnStep1Next = document.getElementById('btn-step-1-next');

  if (consentCheck && btnStep1Next) {
    consentCheck.addEventListener('change', () => {
      btnStep1Next.disabled = !consentCheck.checked;
      btnStep1Next.style.opacity = consentCheck.checked ? '1' : '0.5';
      btnStep1Next.style.cursor = consentCheck.checked ? 'pointer' : 'not-allowed';
    });

    btnStep1Next.addEventListener('click', () => {
      if (consentCheck.checked) {
        VoiceEngine.unlockAudio();
        goToWizardStep(2);
      }
    });
  }

  // ── Etapa 2: Nome Completo ──
  const nameInput = document.getElementById('wizard-worker-name');
  const btnStep2Next = document.getElementById('btn-step-2-next');

  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name || name.length < 2) {
        nameInput.focus();
        nameInput.style.borderColor = '#f43f5e';
        setTimeout(() => { nameInput.style.borderColor = ''; }, 2000);
        return;
      }
      state.wizard.workerName = name;
      goToWizardStep(3);
    });

    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnStep2Next.click();
    });
  }

  // ── Etapa 3: Cargo ──
  const roleInput = document.getElementById('wizard-worker-role');
  const btnStep3Next = document.getElementById('btn-step-3-next');

  if (btnStep3Next) {
    btnStep3Next.addEventListener('click', () => {
      const role = roleInput ? roleInput.value.trim() : '';
      if (!role || role.length < 2) {
        roleInput.focus();
        roleInput.style.borderColor = '#f43f5e';
        setTimeout(() => { roleInput.style.borderColor = ''; }, 2000);
        return;
      }
      state.wizard.workerRole = role;
      goToWizardStep(4);
    });

    roleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnStep3Next.click();
    });
  }

  // ── Etapa 4: Setor (chips) ──
  document.querySelectorAll('[data-sector]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sector]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wizard.sector = btn.dataset.sector;
    });
  });

  const btnStep4Next = document.getElementById('btn-step-4-next');
  if (btnStep4Next) {
    btnStep4Next.addEventListener('click', () => goToWizardStep(5));
  }

  // ── Etapa 5: Turno e Tempo de Casa ──
  document.querySelectorAll('[data-shift]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-shift]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wizard.shift = btn.dataset.shift;
    });
  });

  document.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.wizard.companyTime = btn.dataset.time;
    });
  });

  const btnStartWizard = document.getElementById('btn-start-interview-wizard');
  if (btnStartWizard) {
    btnStartWizard.addEventListener('click', async () => {
      btnStartWizard.disabled = true;
      btnStartWizard.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando...';
      await startInterviewSession();
    });
  }

  // ── Botões Voltar ──
  document.querySelectorAll('.wizard-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.dataset.back, 10);
      goToWizardStep(targetStep);
    });
  });
}

function goToWizardStep(stepNum) {
  const TOTAL_STEPS = 5;
  // Esconde todos os steps
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`wizard-step-${i}`);
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  }
  // Exibe o step desejado
  const target = document.getElementById(`wizard-step-${stepNum}`);
  if (target) { target.style.display = 'block'; target.classList.add('active'); }
  // Atualiza barra de progresso (20% por step)
  const progressFill = document.getElementById('wizard-progress-fill');
  if (progressFill) progressFill.style.width = `${(stepNum / TOTAL_STEPS) * 100}%`;
}

async function startInterviewSession() {
  if (!state.linkId) {
    if (dom.onboardingView) dom.onboardingView.style.display = 'none';
    if (dom.invalidLinkView) dom.invalidLinkView.style.display = 'block';
    return;
  }

  const { workerName, workerRole, sector, shift, companyTime } = state.wizard;

  try {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerName: workerName || 'Colaborador',
        workerRole: workerRole || 'Operacional',
        sector,
        shift,
        companyTime,
        consentGiven: true,
        linkId: state.linkId
      })
    });

    const data = await res.json();
    if (res.ok && data.success && data.session?.currentStepData) {
      state.sessionId = data.sessionId;
      localStorage.setItem('equilibra_last_session', data.sessionId);
      state.currentStepData = data.session.currentStepData;

      dom.onboardingView.style.display = 'none';
      dom.interviewView.style.display = 'block';
      dom.mainQuestionText.innerHTML = '<div class="text-loading-signal"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

      await renderCurrentStep();
    } else {
      if (data.code === 'INVALID_SURVEY_LINK' || data.code === 'LINK_REQUIRED') {
        if (dom.onboardingView) dom.onboardingView.style.display = 'none';
        if (dom.invalidLinkView) {
          dom.invalidLinkView.style.display = 'block';
          if (dom.invalidLinkMessage) dom.invalidLinkMessage.textContent = data.error;
        }
      }
      throw new Error(data.error || 'Não foi possível carregar a etapa inicial.');
    }
  } catch (err) {
    console.error('Erro ao iniciar entrevista:', err);
    const startBtn = document.getElementById('btn-start-interview-wizard');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = 'Iniciar Conversa <i class="fa-solid fa-bolt"></i>';
    }
    alert('Erro de conexão: ' + (err.message || 'Verifique se o servidor está ativo em http://localhost:3000'));
  }
}

/**
 * Divide um texto em frases individuais terminadas por pontuação (. ! ?)
 */
function splitIntoSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+(?:[.!?]+(?:\s|$)|$)/g);
  if (!matches || matches.length === 0) return [text.trim()];
  return matches.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Calcula dinamicamente o tempo de leitura de acordo com a extensão da frase
 */
function calculateReadingDelay(sentence) {
  if (!sentence) return 800;
  const words = sentence.trim().split(/\s+/).filter(Boolean).length;
  const chars = sentence.length;
  const calculated = 600 + (words * 80) + (chars * 6);
  return Math.max(700, Math.min(2600, calculated));
}

async function renderCurrentStep() {
  const step = state.currentStepData;
  if (!step) return;

  const myToken = ++currentTypewriterToken;

  state.stepStartTime = Date.now();
  dom.widgetContainer.innerHTML = '';
  if (dom.aiTypingIndicator) dom.aiTypingIndicator.style.display = 'none';

  const hasStatement = Boolean(step.bot_statement && step.bot_statement.trim());

  if (hasStatement) {
    const sentences = splitIntoSentences(step.bot_statement);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      state.currentSpokenText = sentence;

      dom.mainQuestionText.className = 'main-question-text fade-in';
      const finishedStatement = await speakAndType(sentence, myToken, 36);
      if (!finishedStatement || myToken !== currentTypewriterToken) return;

      const readingDelay = calculateReadingDelay(sentence);
      await sleep(readingDelay);
      if (myToken !== currentTypewriterToken) return;

      dom.mainQuestionText.classList.remove('fade-in');
      dom.mainQuestionText.classList.add('fade-out');
      await sleep(180);
      if (myToken !== currentTypewriterToken) return;
    }
  }

  // Apresentação da pergunta com voz e texto sincronizados
  state.currentSpokenText = step.next_question;
  dom.mainQuestionText.className = 'main-question-text fade-in';
  const finishedQuestion = await speakAndType(step.next_question, myToken, 36);
  if (!finishedQuestion || myToken !== currentTypewriterToken) return;

  // Exibe o campo de resposta (widget)
  WidgetEngine.render(step.ui_widget || 'text_input', step.widget_options || {}, handleUserAnswer);
}

async function handleUserAnswer(answer, widgetType) {
  const durationMs = state.stepStartTime ? Date.now() - state.stepStartTime : null;

  currentTypewriterToken++;
  VoiceEngine.stop();

  dom.widgetContainer.innerHTML = '';
  dom.mainQuestionText.className = 'main-question-text fade-in';
  dom.mainQuestionText.innerHTML = '<div class="text-loading-signal"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  if (dom.aiTypingIndicator) dom.aiTypingIndicator.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/sessions/${state.sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAnswer: answer,
        widgetType: widgetType,
        responseDurationMs: durationMs
      })
    });

    const data = await res.json();

    if (data.isCompleted) {
      await finishInterview();
    } else {
      state.currentStepData = data.nextStep;
      await renderCurrentStep();
    }
  } catch (err) {
    console.error('Erro ao enviar resposta:', err);
    dom.mainQuestionText.textContent = 'Houve uma oscilação na conexão. Tentando novamente...';
    alert('Houve uma oscilação na conexão com o servidor local (http://localhost:3000). Tentando novamente...');
    WidgetEngine.render(state.currentStepData.ui_widget || 'text_input', state.currentStepData.widget_options || {}, handleUserAnswer);
  }
}

async function finishInterview(closingStatement) {
  const finalThanks = closingStatement || 'Muito obrigado pela nossa conversa! Suas respostas foram salvas com total sigilo e serão fundamentais para que a CIPA e o SESMT implementem melhorias reais no seu setor (NR-01).';
  
  const myToken = ++currentTypewriterToken;
  state.currentSpokenText = finalThanks;
  dom.widgetContainer.innerHTML = '';
  dom.mainQuestionText.className = 'main-question-text fade-in';
  
  await speakAndType(finalThanks, myToken, 36);
  await sleep(1800);
  
  dom.interviewView.style.display = 'none';
  dom.completedView.style.display = 'block';
  dom.completedView.classList.add('fade-in');

  try {
    await fetch(`${API_BASE}/api/sessions/${state.sessionId}/finish`, {
      method: 'POST'
    });
  } catch (err) {
    console.error('Erro ao registrar término no servidor:', err);
  }
}

/**
 * Limpa e pré-processa foneticamente o texto para pronúncia natural e sem gaguejo
 */
function cleanTextForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/\bEquilibraAI\b/gi, 'Equilibra A I')
    .replace(/\bNR-?0?1\b/gi, 'Norma Regulamentadora 1')
    .replace(/\bNR-?17\b/gi, 'Norma Regulamentadora 17')
    .replace(/\bISTAS-?21-?BR\b/gi, 'Ístas 21 Brasil')
    .replace(/\bISTAS-?21\b/gi, 'Ístas 21')
    .replace(/\bSST\b/gi, 'Saúde e Segurança do Trabalho')
    .replace(/\bRH\b/gi, 'Recursos Humanos')
    .replace(/\bSESMT\b/gi, 'Sésmit')
    .replace(/\bLGPD\b/gi, 'L G P D')
    .replace(/\bEPIs?\b/gi, 'E P I')
    .replace(/\bPGR\b/gi, 'P G R')
    .replace(/\bGRO\b/gi, 'G R O')
    .replace(/\bCIPA\b/gi, 'Cípa')
    .replace(/\[.*?\]/g, '')
    .replace(/[*_#`~]/g, '')
    .trim();
}
