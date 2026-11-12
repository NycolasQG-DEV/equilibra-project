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
 * Efeito Máquina de Escrever suave e natural com animação Anime.js por caractere (sobe de baixo para cima com opacidade)
 */
function runSmoothCharTypewriter(containerEl, text, onComplete = null) {
  containerEl.innerHTML = '';
  const anm = window.anime || null;

  // Cria spans individuais para cada caractere
  const spans = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const span = document.createElement('span');
    span.className = char === ' ' ? 'dialogue-char space' : 'dialogue-char';
    span.textContent = char;
    containerEl.appendChild(span);
    spans.push(span);
  }

  let isCancelled = false;

  if (anm && spans.length > 0) {
    const animation = anm({
      targets: spans,
      opacity: [0, 1],
      translateY: [14, 0],
      duration: 380,
      delay: anm.stagger(48, { start: 100 }), // Ritmo mais lento, pausado e orgânico
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      complete: () => {
        if (!isCancelled && onComplete) onComplete();
      }
    });

    return {
      cancel: () => {
        isCancelled = true;
        try { animation.pause(); } catch { }
        spans.forEach(s => {
          s.style.opacity = '1';
          s.style.transform = 'translateY(0)';
        });
        if (onComplete) onComplete();
      }
    };
  }

  // Fallback caso Anime.js não esteja pronto
  spans.forEach(s => {
    s.style.opacity = '1';
    s.style.transform = 'translateY(0)';
  });
  if (onComplete) onComplete();
  return { cancel: () => {} };
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

    // Trava de navegador / máquina local: se já respondeu, exibe encerramento (ignorado em modo teste/dev)
    const isDevPreview = token.startsWith('dev-') || window.location.search.includes('preview=true');
    if (!isDevPreview && localStorage.getItem(`answered_${surveyId}`) === 'true') {
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
  let currentStep = -1; // -1: boas-vindas | -0.5: preparação/intro acolhedora | 0..N: perguntas
  let currentTw = null;

  const anm = window.anime || null;

  // Anime.js helper: anima entrada do dialogue-card com fade+slide
  function animateCardEntrance() {
    if (!anm) return;
    const card = container.querySelector('.dialogue-card, .dialogue-welcome-card');
    if (!card) return;
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    anm({
      targets: card,
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 620,
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      complete: () => {
        card.style.opacity = '';
        card.style.transform = '';
      }
    });
  }

  // Anime.js helper: stagger das pills de resposta (fade in subindo de baixo para cima ordenado)
  function animatePillsEntrance(delayStart = 350) {
    if (!anm) return;
    const pills = container.querySelectorAll('.dialogue-pill-option');
    if (!pills.length) return;
    pills.forEach(p => {
      p.style.opacity = '0';
      p.style.transform = 'translateY(22px)';
    });
    anm({
      targets: pills,
      opacity: [0, 1],
      translateY: [22, 0],
      duration: 520,
      delay: anm.stagger(90, { start: delayStart }), // Entrada em ordem bem perceptível e satisfatória
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      complete: () => {
        pills.forEach(p => { p.style.opacity = ''; p.style.transform = ''; });
      }
    });
  }

  // Anime.js helper: fade-out suave ao sumir elementos para avançar
  function animateCardExit(onComplete) {
    if (!anm) {
      if (onComplete) onComplete();
      return;
    }
    const card = container.querySelector('.dialogue-card');
    if (!card) {
      if (onComplete) onComplete();
      return;
    }
    anm({
      targets: card,
      opacity: [1, 0],
      translateY: [0, -18],
      duration: 280,
      easing: 'cubicBezier(0.4, 0, 0.2, 1)',
      complete: () => {
        if (onComplete) onComplete();
      }
    });
  }

  // Progress bar contínua sem reiniciar do zero
  function updateProgressLine(pct) {
    const fillEl = document.getElementById('dialogue-prog-fill');
    if (!fillEl) return;
    fillEl.style.width = `${pct}%`;
  }

  // Anime.js helper: feedback discreto ao selecionar (sem pulso grotesco)
  function animatePillSelect(clickedBtn, otherBtns) {
    if (!anm) return;
    // Sem pulso/bounce: apenas fade suave nas outras opções não escolhidas
    if (otherBtns.length > 0) {
      anm({
        targets: Array.from(otherBtns),
        opacity: [1, 0.3],
        duration: 240,
        easing: 'cubicBezier(0.4, 0, 0.2, 1)'
      });
    }
  }

  // Anime.js helper: bounce nos botões primários de boas-vindas
  function animateWelcomeButtons() {
    if (!anm) return;
    const btns = container.querySelectorAll('.dialogue-welcome-buttons .btn');
    if (!btns.length) return;
    btns.forEach(b => { b.style.opacity = '0'; b.style.transform = 'translateY(20px)'; });
    anm({
      targets: btns,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      delay: anm.stagger(80, { start: 300 }),
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      complete: () => {
        btns.forEach(b => { b.style.opacity = ''; b.style.transform = ''; });
      }
    });
  }

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

      animateCardEntrance();
      animateWelcomeButtons();

      document.getElementById('btn-dialogue-to-standard')?.addEventListener('click', () => {
        onSwitchMode('standard');
      });

      document.getElementById('btn-start-with-voice')?.addEventListener('click', () => {
        isMuted = false;
        onToggleMute(false);
        animateCardExit(() => {
          currentStep = -0.5;
          renderStep();
        });
      });

      document.getElementById('btn-start-silent')?.addEventListener('click', () => {
        isMuted = true;
        onToggleMute(true);
        animateCardExit(() => {
          currentStep = -0.5;
          renderStep();
        });
      });
      return;
    }

    // ── Etapa Intermediária: Preparação e Acolhimento Centralizado antes da 1ª Pergunta ──
    if (currentStep === -0.5) {
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
            </div>
          </header>

          <div class="dialogue-progress-line-wrap">
            <div class="dialogue-progress-line-fill" id="dialogue-prog-fill"></div>
          </div>

          <main class="dialogue-main">
            <div class="dialogue-card dialogue-intro-stage" id="dialogue-intro-box">
              <div class="dialogue-speaker-badge">
                <i class="fa-solid fa-circle-dot" aria-hidden="true"></i> Questão 0 de ${questions.length}
              </div>

              <div class="dialogue-intro-heading">
                <span id="typewriter-target"></span>
              </div>

              <p class="dialogue-intro-subtitle">
                Apresentarei algumas afirmações sobre o seu dia a dia. Responda com tranquilidade de acordo com a sua percepção real.
              </p>
            </div>
          </main>
        </div>
      `;

      updateProgressLine(0);
      animateCardEntrance();

      document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
        isMuted = !isMuted;
        onToggleMute(isMuted);
        renderStep();
      });

      const introMsg = 'Vamos começar com tranquilidade.';
      speakSpeech(introMsg, isMuted);
      const targetEl = document.getElementById('typewriter-target');

      // Avança automaticamente para a questão 1 após a mensagem de boas-vindas assentar
      currentTw = runSmoothCharTypewriter(targetEl, introMsg, () => {
        setTimeout(() => {
          animateCardExit(() => {
            currentStep = 0;
            renderStep();
          });
        }, 1600);
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
            <div class="dialogue-progress-line-fill" id="dialogue-prog-fill"></div>
          </div>

          <main class="dialogue-main">
            <div class="dialogue-card">
              <div class="dialogue-speaker-badge">
                <i class="fa-solid fa-sparkles" aria-hidden="true"></i> Maya • Conclusão
              </div>

              <div class="dialogue-typewriter-container" id="typewriter-box">
                <span id="typewriter-target"></span>
              </div>

              <div class="dialogue-options-wrap visible">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-dialogue-submit">
                  <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Enviar Minhas Respostas
                </button>
              </div>
            </div>
          </main>
        </div>
      `;

      updateProgressLine(progressPercent);
      animateCardEntrance();

      const targetEl = document.getElementById('typewriter-target');
      const cursorEl = document.getElementById('typewriter-cursor');
      const finalMsg = 'Muito obrigada pela sua dedicação! Suas respostas apoiarão melhorias fundamentais e transparentes no nosso ambiente de trabalho.';

      speakSpeech(finalMsg, isMuted);
      currentTw = runSmoothCharTypewriter(targetEl, finalMsg, () => {
        if (cursorEl) cursorEl.remove();
      });

      // Anima o botão de envio
      const submitBtn = document.getElementById('btn-dialogue-submit');
      if (submitBtn && anm) {
        submitBtn.style.opacity = '0';
        submitBtn.style.transform = 'translateY(16px)';
        anm({
          targets: submitBtn,
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 500,
          delay: 400,
          easing: 'cubicBezier(0.16, 1, 0.3, 1)'
        });
      }

      document.getElementById('btn-dialogue-submit')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-dialogue-submit');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Enviando...';
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
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Enviar Minhas Respostas';
          }
        }
      });
      return;
    }

    // ── Turno Normal: Afirmação da Pesquisa ──
    const q = questions[currentStep];
    const qIndex = currentStep + 1;
    const totalQ = questions.length;
    const progressPercent = Math.round(((currentStep + 1) / totalQ) * 100);
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
          <div class="dialogue-progress-line-fill" id="dialogue-prog-fill"></div>
        </div>

        <main class="dialogue-main">
          <div class="dialogue-card">
            <div class="dialogue-speaker-badge">
              <i class="fa-solid fa-circle-dot" aria-hidden="true"></i> Questão ${qIndex} de ${totalQ}
            </div>

            <div class="dialogue-typewriter-container typing-focus" id="typewriter-box">
              <span id="typewriter-target"></span>
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

    // Atualiza a barra de progresso suavemente contínua (sem reiniciar)
    updateProgressLine(progressPercent);

    // Entrada suave do card
    animateCardEntrance();

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
    const typewriterBox = document.getElementById('typewriter-box');
    const optionsContainer = document.getElementById('dialogue-options-container');

    function onTypingFinished() {
      // Transição fluida: reduz a fonte para o tamanho padrão e revela as opções
      if (typewriterBox) {
        typewriterBox.classList.remove('typing-focus');
      }
      if (optionsContainer) {
        optionsContainer.classList.add('visible');
        animatePillsEntrance(40);
      }
    }

    speakSpeech(q.text, isMuted);
    currentTw = runSmoothCharTypewriter(targetEl, q.text, onTypingFinished);

    // Pular animação ao clicar no box
    document.getElementById('typewriter-box')?.addEventListener('click', () => {
      if (currentTw) {
        currentTw.cancel();
        onTypingFinished();
      }
    });

    // Eventos de escolha de alternativa com fade out elegante
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

        const others = Array.from(optionBtns).filter(b => b !== btn);
        animatePillSelect(btn, others);

        const affirmations = [
          'Resposta registrada.',
          'Entendido. Avançando...',
          'Registrado. Próximo ponto.',
          'Obrigada, avançando.'
        ];
        const feedback = affirmations[Math.floor(Math.random() * affirmations.length)];
        speakSpeech(feedback, isMuted);

        // Fade-out suave do card antes de renderizar a próxima pergunta
        setTimeout(() => {
          animateCardExit(() => {
            currentStep++;
            renderStep();
          });
        }, 450);
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


