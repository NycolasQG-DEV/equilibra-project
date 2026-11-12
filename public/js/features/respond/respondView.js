/* Confidential Survey Respondent Interface: Dual-Mode (Objective Form & Immersive AI Dialogue) */

import { esc, attr } from '../../domain/formatters.js';
import { get, post } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';

/**
 * Síntese de voz nativa PT-BR (Web Speech API)
 */
let cachedVoice = null;
function getPtBrVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.startsWith('pt')) || voices[0] || null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = getPtBrVoice();
  };
  cachedVoice = getPtBrVoice();
}

function speakSpeech(text, isMuted) {
  if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]+>/g, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    if (cachedVoice) utterance.voice = cachedVoice;
    window.speechSynthesis.speak(utterance);
  } catch { }
}

function stopSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch { }
  }
}

/**
 * Efeito Máquina de Escrever suave e natural (cadência humana, pausas de pontuação e jitter orgânico)
 */
function runTypewriter(element, text, speed = 36, onComplete = null) {
  element.textContent = '';
  let i = 0;
  let isCancelled = false;
  let timerId = null;

  function typeNext() {
    if (isCancelled) return;
    if (i < text.length) {
      const char = text.charAt(i);
      element.textContent += char;
      i++;

      let delay = speed;
      // Pausa orgânica de respiração em pontuações
      if (char === ',' || char === ';') {
        delay += 95;
      } else if (char === '.' || char === '!' || char === '?') {
        delay += 180;
      } else if (char === ' ') {
        delay += 15;
      } else {
        // Micro-jitter sutil (+-8ms) para sensação orgânica de digitação humana
        delay += Math.floor(Math.random() * 17) - 8;
      }

      timerId = setTimeout(typeNext, Math.max(20, delay));
    } else {
      if (onComplete) onComplete();
    }
  }

  // Respiro inicial para o card e a interface assentarem
  timerId = setTimeout(typeNext, 140);

  return {
    cancel: () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      element.textContent = text;
      if (onComplete) onComplete();
    }
  };
}

export async function renderRespondent({ params }) {
  const token = params.token;
  const container = document.querySelector('#app');

  container.innerHTML = `
    <div class="center-page-wrap">
      <div class="card p-8 text-center max-w-md">
        <i class="fa-solid fa-spinner fa-spin color-primary mb-4 text-3xl" aria-hidden="true"></i>
        <h1 class="card-title">Carregando questionário confidencial...</h1>
      </div>
    </div>
  `;

  try {
    const surveyData = await get(`/responder/${token}`);
    const surveyId = surveyData.id || surveyData.surveyId || token;

    // Trava de navegador / máquina local: se já respondeu, exibe encerramento
    if (localStorage.getItem(`answered_${surveyId}`) === 'true') {
      renderAlreadyAnsweredScreen(container);
      return;
    }

    const rawFactors = surveyData.factors || [];
    const questions = rawFactors.length > 0
      ? rawFactors.map((f, idx) => ({
          id: f.key,
          label: f.label,
          text: f.question,
          options: Array.isArray(surveyData.options?.[idx])
            ? surveyData.options[idx]
            : (Array.isArray(surveyData.options) && typeof surveyData.options[0] === 'string'
                ? surveyData.options
                : ['Discordo totalmente', 'Discordo', 'Neutro / Não se aplica', 'Concordo', 'Concordo totalmente'])
        }))
      : (surveyData.instrument?.questions || []);

    const surveyTitle = surveyData.title || surveyData.survey?.title || 'Pesquisa de Fatores Psicossociais';
    const draftKey = `equilibra_draft_${token}`;
    let savedAnswers = {};
    try {
      savedAnswers = JSON.parse(localStorage.getItem(draftKey) || '{}');
    } catch { }

    // Preferência de modo persistida (padrão: diálogo imersivo)
    let currentMode = localStorage.getItem(`survey_pref_mode_${token}`) || 'dialogue';
    let isMuted = localStorage.getItem('survey_audio_muted') === 'true';

    function renderCurrentView() {
      if (currentMode === 'dialogue') {
        renderDialogueView({
          container,
          token,
          surveyId,
          surveyTitle,
          surveyData,
          questions,
          savedAnswers,
          draftKey,
          isMuted,
          onSwitchMode: (newMode) => {
            currentMode = newMode;
            localStorage.setItem(`survey_pref_mode_${token}`, newMode);
            stopSpeech();
            renderCurrentView();
          },
          onToggleMute: (muted) => {
            isMuted = muted;
            localStorage.setItem('survey_audio_muted', String(muted));
          }
        });
      } else {
        renderStandardView({
          container,
          token,
          surveyId,
          surveyTitle,
          surveyData,
          questions,
          savedAnswers,
          draftKey,
          onSwitchMode: (newMode) => {
            currentMode = newMode;
            localStorage.setItem(`survey_pref_mode_${token}`, newMode);
            renderCurrentView();
          }
        });
      }
    }

    renderCurrentView();

  } catch (err) {
    container.innerHTML = `
      <div class="center-page-wrap">
        <div class="card p-8 text-center max-w-md">
          <div class="auth-logo color-warning mb-3">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          </div>
          <h1 class="card-title mb-2">Link Indisponível ou Já Utilizado</h1>
          <p class="view-subtitle">
            ${esc(err.message || 'Este convite já foi utilizado ou a pesquisa foi encerrada.')}
          </p>
        </div>
      </div>
    `;
  }
}

/**
 * ESTILO 1: FORMULÁRIO OBJETIVO TRADICIONAL (1 A 5)
 */
function renderStandardView({ container, token, surveyId, surveyTitle, surveyData, questions, savedAnswers, draftKey, onSwitchMode }) {
  const questionsHtml = questions.map((q, idx) => {
    const qNum = idx + 1;
    const currentVal = savedAnswers[q.id] || null;
    const labels = q.options || ['Discordo totalmente', 'Discordo', 'Neutro / Não se aplica', 'Concordo', 'Concordo totalmente'];

    return `
      <fieldset class="card respondent-question-card mb-4">
        <legend class="respondent-question-legend">
          ${qNum}. ${esc(q.text)}
        </legend>
        <div class="flex items-center justify-between gap-2 flex-wrap">
          ${labels.map((lbl, valIdx) => {
            const val = valIdx + 1;
            const isChecked = String(currentVal) === String(val);

            return `
              <label class="form-check likert-option">
                <input type="radio" name="q_${attr(q.id)}" value="${val}" ${isChecked ? 'checked' : ''} class="mb-1" required>
                <span class="likert-num">${val}</span>
                <span class="likert-label">${esc(lbl)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </fieldset>
    `;
  }).join('');

  container.innerHTML = `
    <div class="p-6">
      <div class="respondent-container">
        <div class="flex items-center justify-between mb-4">
          <div class="dialogue-brand">
            <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Equilibra Escuta
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-switch-to-dialogue">
            <i class="fa-solid fa-comments color-primary" aria-hidden="true"></i> Mudar para Diálogo Guiado
          </button>
        </div>

        <header class="mb-6 text-center">
          <h1 class="view-title mb-2">${esc(surveyTitle)}</h1>
          <p class="view-subtitle">
            Suas respostas são analisadas de forma coletiva.
          </p>
          ${surveyData.instructions ? `
            <div class="card bg-subtle p-3 my-4 text-left">
              <p class="table-subtext m-0"><strong>Instruções do instrumento:</strong> ${esc(surveyData.instructions)}</p>
            </div>
          ` : ''}
        </header>

        <form id="respondent-form">
          ${questionsHtml}

          <div class="card mt-6 p-5 text-center bg-surface">
            <button type="submit" class="btn btn-primary btn-lg w-full max-w-md">
              Enviar Respostas
            </button>
            <p class="table-subtext mt-2 mb-0">
              Após o envio, este link será permanentemente desativado.
            </p>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-switch-to-dialogue')?.addEventListener('click', () => {
    onSwitchMode('dialogue');
  });

  const form = document.getElementById('respondent-form');
  form.addEventListener('change', (e) => {
    if (e.target.name && e.target.value) {
      const qId = e.target.name.replace(/^q_/, '');
      savedAnswers[qId] = Number(e.target.value);
      try {
        localStorage.setItem(draftKey, JSON.stringify(savedAnswers));
      } catch { }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const answers = {};
    let missing = false;

    for (const q of questions) {
      const selected = form.querySelector(`input[name="q_${q.id}"]:checked`);
      if (!selected) {
        missing = true;
        break;
      }
      answers[q.id] = Number(selected.value);
    }

    if (missing) {
      showToast('Por favor, responda a todas as questões antes de enviar.', 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    try {
      await post(`/responder/${token}`, { answers });
      try {
        localStorage.removeItem(draftKey);
        localStorage.setItem(`answered_${surveyId}`, 'true');
      } catch { }
      renderSuccessScreen(container);
    } catch (err) {
      showToast(err.message || 'Erro ao enviar respostas.', 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/**
 * ESTILO 2: DIÁLOGO CONVERSACIONAL IMERSIVO (IA, TYPEWRITER & NARRAÇÃO)
 */
function renderDialogueView({ container, token, surveyId, surveyTitle, surveyData, questions, savedAnswers, draftKey, isMuted: initialMuted, onSwitchMode, onToggleMute }) {
  let isMuted = initialMuted;
  let currentStep = -1; // -1: tela de boas-vindas / início de som
  let currentTw = null;

  function renderStep() {
    stopSpeech();

    // ── Tela Inicial de Acolhimento & Permissão de Som ──
    if (currentStep === -1) {
      container.innerHTML = `
        <div class="dialogue-viewport">
          <header class="dialogue-top-bar">
            <div class="dialogue-brand">
              <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Equilibra
            </div>
            <div class="dialogue-top-actions">
              <button type="button" class="btn btn-ghost btn-sm" id="btn-dialogue-to-standard">
                <i class="fa-solid fa-list-check" aria-hidden="true"></i> Modo Formulário Rápido
              </button>
            </div>
          </header>

          <main class="dialogue-main">
            <div class="dialogue-welcome-card text-center">
              <div class="dialogue-welcome-icon">
                <i class="fa-solid fa-comments" aria-hidden="true"></i>
              </div>
              <h1 class="dialogue-welcome-title">${esc(surveyTitle)}</h1>
              <p class="dialogue-welcome-text">
                Olá! Eu sou a <strong>Maya</strong>, facilitadora de escuta da Equilibra. Conduzirei esta conversa sobre o seu dia a dia e suas condições de trabalho. Suas respostas são coletivas e contribuem para melhorias reais no ambiente de trabalho.
              </p>

              <div class="dialogue-welcome-buttons">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-start-with-voice">
                  <i class="fa-solid fa-volume-high" aria-hidden="true"></i> Iniciar Diálogo com Narração de Voz
                </button>
                <button type="button" class="btn btn-secondary btn-lg w-full" id="btn-start-silent">
                  <i class="fa-solid fa-volume-xmark" aria-hidden="true"></i> Iniciar em Silêncio (Apenas Leitura)
                </button>
              </div>
            </div>
          </main>
        </div>
      `;

      document.getElementById('btn-dialogue-to-standard')?.addEventListener('click', () => {
        onSwitchMode('standard');
      });

      document.getElementById('btn-start-with-voice')?.addEventListener('click', () => {
        isMuted = false;
        onToggleMute(false);
        currentStep = 0;
        renderStep();
      });

      document.getElementById('btn-start-silent')?.addEventListener('click', () => {
        isMuted = true;
        onToggleMute(true);
        currentStep = 0;
        renderStep();
      });
      return;
    }

    // ── Respostas Concluídas: Pergunta Aberta Opcional e Envio ──
    if (currentStep >= questions.length) {
      const progressPercent = 100;
      container.innerHTML = `
        <div class="dialogue-viewport">
          <header class="dialogue-top-bar">
            <div class="dialogue-brand">
              <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Equilibra
            </div>
            <div class="dialogue-top-actions">
              <span class="badge badge-success">Todas as questões respondidas</span>
            </div>
          </header>
          <div class="dialogue-progress-line-wrap">
            <div class="dialogue-progress-line-fill" data-progress="${progressPercent}"></div>
          </div>

          <main class="dialogue-main">
            <div class="dialogue-card">
              <div class="dialogue-speaker-badge">
                <i class="fa-solid fa-sparkles" aria-hidden="true"></i> Maya • Conclusão
              </div>

              <div class="dialogue-typewriter-container">
                <span id="typewriter-target"></span><span class="dialogue-cursor" id="typewriter-cursor"></span>
              </div>

              <div class="dialogue-options-wrap">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-dialogue-submit">
                  <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Enviar Minhas Respostas
                </button>
              </div>
            </div>
          </main>
        </div>
      `;

      const targetEl = document.getElementById('typewriter-target');
      const cursorEl = document.getElementById('typewriter-cursor');
      const finalMsg = 'Muito obrigada pela sua dedicação! Suas respostas apoiarão melhorias fundamentais e transparentes no nosso ambiente de trabalho.';

      speakSpeech(finalMsg, isMuted);
      currentTw = runTypewriter(targetEl, finalMsg, 34, () => {
        if (cursorEl) cursorEl.remove();
      });

      document.getElementById('btn-dialogue-submit')?.addEventListener('click', async () => {
        const submitBtn = document.getElementById('btn-dialogue-submit');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Enviando...';
        }

        try {
          await post(`/responder/${token}`, { answers: savedAnswers });
          try {
            localStorage.removeItem(draftKey);
            localStorage.setItem(`answered_${surveyId}`, 'true');
          } catch { }
          renderSuccessScreen(container);
        } catch (err) {
          showToast(err.message || 'Erro ao enviar respostas.', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Enviar Minhas Respostas';
          }
        }
      });
      return;
    }

    // ── Turno Normal: Afirmação da Pesquisa ──
    const q = questions[currentStep];
    const qIndex = currentStep + 1;
    const totalQ = questions.length;
    const progressPercent = Math.round((currentStep / totalQ) * 100);
    const options = q.options || ['Discordo totalmente', 'Discordo', 'Neutro / Não se aplica', 'Concordo', 'Concordo totalmente'];
    const selectedVal = savedAnswers[q.id] || null;

    container.innerHTML = `
      <div class="dialogue-viewport">
        <header class="dialogue-top-bar">
          <div class="dialogue-brand">
            <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Equilibra
          </div>
          <div class="dialogue-top-actions">
            <button type="button" class="dialogue-audio-btn ${!isMuted ? 'active' : ''}" id="btn-toggle-audio">
              <i class="fa-solid ${!isMuted ? 'fa-volume-high' : 'fa-volume-xmark'}" aria-hidden="true"></i>
              <span>${!isMuted ? 'Voz Ativa' : 'Mudo'}</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-dialogue-to-standard">
              <i class="fa-solid fa-list-check" aria-hidden="true"></i> Formulário
            </button>
          </div>
        </header>

        <div class="dialogue-progress-line-wrap">
          <div class="dialogue-progress-line-fill" data-progress="${progressPercent}"></div>
        </div>

        <main class="dialogue-main">
          <div class="dialogue-card">
            <div class="dialogue-speaker-badge">
              <i class="fa-solid fa-circle-dot" aria-hidden="true"></i> Questão ${qIndex} de ${totalQ} ${q.label ? `• ${esc(q.label)}` : ''}
            </div>

            <div class="dialogue-typewriter-container" id="typewriter-box">
              <span id="typewriter-target"></span><span class="dialogue-cursor" id="typewriter-cursor"></span>
            </div>

            <div class="dialogue-options-wrap" id="dialogue-options-container">
              ${options.map((optText, optIdx) => {
                const val = optIdx + 1;
                const isSelected = selectedVal === val;
                return `
                  <button type="button" class="dialogue-pill-option ${isSelected ? 'selected' : ''}" data-score="${val}">
                    <span class="dialogue-pill-score">${val}</span>
                    <span class="dialogue-pill-text">${esc(optText)}</span>
                    <i class="fa-solid fa-check color-primary" aria-hidden="true"></i>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </main>
      </div>
    `;

    // Atualiza largura da linha de progresso sem inline style
    const fillEl = container.querySelector('.dialogue-progress-line-fill');
    if (fillEl) {
      fillEl.style.width = `${progressPercent}%`;
    }

    document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
      isMuted = !isMuted;
      onToggleMute(isMuted);
      if (isMuted) stopSpeech();
      else speakSpeech(q.text, false);
      renderStep();
    });

    document.getElementById('btn-dialogue-to-standard')?.addEventListener('click', () => {
      onSwitchMode('standard');
    });

    const targetEl = document.getElementById('typewriter-target');
    const cursorEl = document.getElementById('typewriter-cursor');

    speakSpeech(q.text, isMuted);
    currentTw = runTypewriter(targetEl, q.text, 36, () => {
      if (cursorEl) cursorEl.remove();
    });

    // Permite clicar na caixa de texto para pular o efeito de digitação
    document.getElementById('typewriter-box')?.addEventListener('click', () => {
      if (currentTw) currentTw.cancel();
    });

    // Eventos de escolha de alternativa
    const optionBtns = container.querySelectorAll('.dialogue-pill-option');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const score = Number(btn.dataset.score);
        savedAnswers[q.id] = score;
        try {
          localStorage.setItem(draftKey, JSON.stringify(savedAnswers));
        } catch { }

        optionBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // Frases acolhedoras curtas de transição
        const affirmations = [
          'Resposta registrada.',
          'Entendido. Avançando...',
          'Registrado. Avançando...',
          'Obrigada, próximo ponto.'
        ];
        const feedback = affirmations[Math.floor(Math.random() * affirmations.length)];
        speakSpeech(feedback, isMuted);

        setTimeout(() => {
          currentStep++;
          renderStep();
        }, 360);
      });
    });
  }

  renderStep();
}

/**
 * TELA DE AGRADECIMENTO / CONFIRMAÇÃO DE ENVIO
 */
function renderSuccessScreen(container) {
  stopSpeech();
  container.innerHTML = `
    <div class="center-page-wrap">
      <div class="card p-8 text-center max-w-md">
        <div class="status-icon-circle status-icon-circle-lg status-icon-circle-success mb-4">
          <i class="fa-solid fa-check" aria-hidden="true"></i>
        </div>
        <h1 class="view-title mb-2">Resposta Enviada com Sucesso</h1>
        <p class="view-subtitle mb-4">
          Obrigado por dedicar seu tempo e compartilhar sua percepção. Suas respostas contribuem para melhorias concretas nas condições de trabalho.
        </p>
        <span class="badge badge-neutral"><i class="fa-solid fa-check" aria-hidden="true"></i> Obrigado pela sua participação!</span>
      </div>
    </div>
  `;
}

/**
 * TELA PARA QUEM JÁ RESPONDEU NESTE NAVEGADOR / DISPOSITIVO
 */
function renderAlreadyAnsweredScreen(container) {
  container.innerHTML = `
    <div class="center-page-wrap">
      <div class="card p-8 text-center max-w-md">
        <div class="status-icon-circle status-icon-circle-lg status-icon-circle-success mb-4">
          <i class="fa-solid fa-clipboard-check" aria-hidden="true"></i>
        </div>
        <h1 class="view-title mb-2">Resposta Já Registrada</h1>
        <p class="view-subtitle mb-4">
          Você já participou deste ciclo de pesquisa neste dispositivo. Cada colaborador envia apenas uma resposta por ciclo.
        </p>
        <span class="badge badge-neutral"><i class="fa-solid fa-heart" aria-hidden="true"></i> Agradecemos sua colaboração!</span>
      </div>
    </div>
  `;
}


