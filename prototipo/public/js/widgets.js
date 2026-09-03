/**
 * Renderizador de Widgets Dinâmicos e Adaptativos
 * Suporta: text_input (padrão dissertativo principal), slider_0_10, emoji_scale, choice_chips, binary_cards
 */

export const WidgetEngine = {
  container: null,
  onSubmitCallback: null,
  recognition: null,
  isRecording: false,

  init(containerElement, onSubmitCallback) {
    this.container = containerElement;
    this.onSubmitCallback = onSubmitCallback;
    this.setupSpeechRecognition();
  },

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'pt-BR';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }
  },

  render(widgetType, options = {}, onSubmit) {
    if (onSubmit) this.onSubmitCallback = onSubmit;
    this.container.innerHTML = '';

    switch (widgetType) {
      case 'slider_0_10':
        this.renderSlider(options);
        break;
      case 'stars_rating':
        this.renderStarsRating(options);
        break;
      case 'emoji_scale':
        this.renderEmojiScale(options);
        break;
      case 'choice_chips':
        this.renderChoiceChips(options);
        break;
      case 'binary_cards':
        this.renderBinaryCards(options);
        break;
      case 'text_input':
      default:
        this.renderTextInput(options);
        break;
    }
  },

  // --- 1. WIDGET: TEXT_INPUT DISSERTATIVO (PADRÃO PRINCIPAL) ---
  renderTextInput(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-text-container';

    const card = document.createElement('div');
    card.className = 'text-input-card';

    // Header do campo
    const header = document.createElement('div');
    header.className = 'text-input-header';
    header.style.justifyContent = 'flex-end';
    header.innerHTML = `
      <span class="char-counter" id="char-counter">0 caracteres</span>
    `;
    card.appendChild(header);

    // Textarea com expansão automática
    const textarea = document.createElement('textarea');
    textarea.className = 'text-input-area';
    textarea.rows = 3;
    textarea.placeholder = options.placeholder || 'Conte com calma e detalhes sobre o seu dia a dia no setor...';

    // Auto-ajuste de altura
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
      
      const count = textarea.value.trim().length;
      const counterEl = document.getElementById('char-counter');
      if (counterEl) counterEl.textContent = `${count} caracteres`;
      
      submitBtn.disabled = count === 0;
    });

    card.appendChild(textarea);

    // Rodapé do campo com botão de microfone
    const footer = document.createElement('div');
    footer.className = 'text-input-footer';

    const micBtn = document.createElement('button');
    micBtn.type = 'button';
    micBtn.className = 'voice-mic-btn';
    micBtn.title = 'Gravar resposta por voz';
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Falar resposta</span>';

    if (this.recognition) {
      micBtn.addEventListener('click', () => {
        if (!this.isRecording) {
          try {
            this.recognition.start();
            this.isRecording = true;
            micBtn.classList.add('recording');
            micBtn.innerHTML = '<i class="fa-solid fa-circle-dot"></i> <span>Ouvindo...</span>';
          } catch (e) {
            console.warn('Microfone já ativo');
          }
        } else {
          this.recognition.stop();
          this.isRecording = false;
          micBtn.classList.remove('recording');
          micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Falar resposta</span>';
        }
      });

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textarea.value = (textarea.value ? textarea.value + ' ' : '') + transcript;
        textarea.dispatchEvent(new Event('input'));
        this.isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Falar resposta</span>';
      };

      this.recognition.onerror = () => {
        this.isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Falar resposta</span>';
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Falar resposta</span>';
      };
    } else {
      micBtn.style.display = 'none';
    }

    footer.appendChild(micBtn);

    const shortcutHint = document.createElement('span');
    shortcutHint.style.fontSize = '0.75rem';
    shortcutHint.style.color = '#64748b';
    shortcutHint.innerHTML = '<kbd style="background: rgba(255,255,255,0.06); padding: 2px 5px; border-radius: 3px;">Enter</kbd> para enviar';
    footer.appendChild(shortcutHint);

    card.appendChild(footer);
    wrapper.appendChild(card);

    // Botão de envio principal aprimorado
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn-submit-answer';
    submitBtn.innerHTML = '<span>Enviar Resposta</span> <i class="fa-solid fa-paper-plane"></i>';
    submitBtn.disabled = true;

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
        e.preventDefault();
        this.submit(textarea.value.trim(), 'text_input');
      }
    });

    submitBtn.addEventListener('click', () => {
      if (textarea.value.trim()) {
        this.submit(textarea.value.trim(), 'text_input');
      }
    });

    wrapper.appendChild(submitBtn);
    this.container.appendChild(wrapper);

    setTimeout(() => textarea.focus(), 150);
  },

  // --- 2. WIDGET: SLIDER DE 0 A 10 (FACILITADOR) ---
  renderSlider(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-slider-container';

    let currentValue = 5;

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'slider-value-display';
    const numberBadge = document.createElement('div');
    numberBadge.className = 'slider-number-badge';
    numberBadge.textContent = currentValue;
    valueDisplay.appendChild(numberBadge);
    wrapper.appendChild(valueDisplay);

    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'slider-track-wrapper';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '10';
    slider.value = currentValue;
    slider.className = 'custom-range-slider';

    const endpoints = document.createElement('div');
    endpoints.className = 'slider-endpoints';
    endpoints.innerHTML = `
      <span>${options.min_label || '0 - Mínimo'}</span>
      <span>${options.max_label || '10 - Máximo'}</span>
    `;

    slider.addEventListener('input', (e) => {
      currentValue = e.target.value;
      numberBadge.textContent = currentValue;
    });

    trackWrapper.appendChild(slider);
    trackWrapper.appendChild(endpoints);
    wrapper.appendChild(trackWrapper);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn-submit-answer';
    submitBtn.innerHTML = `<span>Confirmar Nota (${currentValue})</span> <i class="fa-solid fa-check"></i>`;

    slider.addEventListener('input', () => {
      submitBtn.innerHTML = `<span>Confirmar Nota (${currentValue})</span> <i class="fa-solid fa-check"></i>`;
    });

    submitBtn.addEventListener('click', () => {
      const summaryText = `Nota ${currentValue} de 10 (${options.min_label || '0'} a ${options.max_label || '10'})`;
      this.submit(summaryText, 'slider_0_10');
    });

    wrapper.appendChild(submitBtn);
    this.container.appendChild(wrapper);
  },

  // --- 2.5. WIDGET: STARS RATING (1 A 5 ESTRELAS) ---
  renderStarsRating(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-stars-container';

    const starsBox = document.createElement('div');
    starsBox.className = 'stars-interactive-box';

    const starLabels = [
      '1 - Muito Crítico / Péssimo',
      '2 - Ruim / Precisa Atenção',
      '3 - Regular / Tolerável',
      '4 - Bom / Seguro',
      '5 - Excelente / Muito Seguro'
    ];

    const labelDisplay = document.createElement('div');
    labelDisplay.className = 'stars-live-label';
    labelDisplay.textContent = 'Toque nas estrelas para avaliar';

    for (let i = 1; i <= 5; i++) {
      const starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = 'star-rate-btn';
      starBtn.dataset.value = i;
      starBtn.innerHTML = '<i class="fa-solid fa-star"></i>';

      starBtn.addEventListener('mouseenter', () => {
        highlightStars(i);
        labelDisplay.textContent = starLabels[i - 1];
      });

      starBtn.addEventListener('mouseleave', () => {
        resetStars();
      });

      starBtn.addEventListener('click', () => {
        const ratingText = `${i} de 5 estrelas (${starLabels[i - 1]})`;
        this.submit(ratingText, 'stars_rating');
      });

      starsBox.appendChild(starBtn);
    }

    function highlightStars(val) {
      starsBox.querySelectorAll('.star-rate-btn').forEach((b, idx) => {
        if (idx < val) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    }

    function resetStars() {
      starsBox.querySelectorAll('.star-rate-btn').forEach(b => b.classList.remove('active'));
      labelDisplay.textContent = 'Toque nas estrelas para avaliar';
    }

    wrapper.appendChild(starsBox);
    wrapper.appendChild(labelDisplay);
    this.container.appendChild(wrapper);
  },

  // --- 3. WIDGET: EMOJI SCALE (FACILITADOR) ---
  renderEmojiScale(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-emoji-container';

    const levels = [
      { value: 1, emoji: '😫', label: 'Muito Ruim' },
      { value: 2, emoji: '😟', label: 'Desconfortável' },
      { value: 3, emoji: '😐', label: 'Neutro' },
      { value: 4, emoji: '🙂', label: 'Adequado' },
      { value: 5, emoji: '😄', label: 'Excelente' }
    ];

    levels.forEach(lvl => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-rating-btn';
      btn.innerHTML = `
        <span class="emoji-icon">${lvl.emoji}</span>
        <span class="emoji-label">${lvl.label}</span>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        setTimeout(() => {
          this.submit(`${lvl.emoji} ${lvl.label} (Nível ${lvl.value}/5)`, 'emoji_scale');
        }, 200);
      });

      wrapper.appendChild(btn);
    });

    this.container.appendChild(wrapper);
  },

  // --- 4. WIDGET: CHOICE CHIPS (FACILITADOR COM SUPORTE A "OUTRO") ---
  renderChoiceChips(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-chips-container';

    const choices = options.choices || ['Sim, com certeza', 'Mais ou menos', 'Não, raramente'];

    choices.forEach(choiceText => {
      const isOtherOption = /^(outro|outra|outros|outras)/i.test(choiceText.trim());

      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'choice-chip-wrapper';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-chip-btn';
      btn.innerHTML = `
        <span>${choiceText}</span>
        <i class="fa-solid ${isOtherOption ? 'fa-pen-to-square' : 'fa-chevron-right'} choice-chip-icon"></i>
      `;

      itemWrapper.appendChild(btn);

      if (isOtherOption) {
        const otherBox = document.createElement('div');
        otherBox.className = 'choice-other-box';
        otherBox.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'choice-other-input';
        input.placeholder = 'Digite e especifique com suas palavras...';

        const actions = document.createElement('div');
        actions.className = 'choice-other-actions';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn-confirm-other';
        confirmBtn.innerHTML = '<span>Confirmar</span> <i class="fa-solid fa-check"></i>';

        const submitOther = () => {
          const val = input.value.trim();
          const finalAnswer = val ? `Outro: ${val}` : choiceText;
          this.submit(finalAnswer, 'choice_chips');
        };

        confirmBtn.addEventListener('click', submitOther);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitOther();
          }
        });

        actions.appendChild(confirmBtn);
        otherBox.appendChild(input);
        otherBox.appendChild(actions);
        itemWrapper.appendChild(otherBox);

        btn.addEventListener('click', () => {
          document.querySelectorAll('.choice-chip-btn').forEach(b => b.classList.remove('selected'));
          document.querySelectorAll('.choice-other-box').forEach(box => {
            if (box !== otherBox) box.style.display = 'none';
          });

          btn.classList.add('selected');
          otherBox.style.display = 'flex';
          setTimeout(() => input.focus(), 100);
        });
      } else {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.choice-chip-btn').forEach(b => b.classList.remove('selected'));
          document.querySelectorAll('.choice-other-box').forEach(box => box.style.display = 'none');
          btn.classList.add('selected');

          setTimeout(() => {
            this.submit(choiceText, 'choice_chips');
          }, 180);
        });
      }

      wrapper.appendChild(itemWrapper);
    });

    this.container.appendChild(wrapper);
  },

  // --- 5. WIDGET: BINARY CARDS (FACILITADOR) ---
  renderBinaryCards(options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-binary-container';

    const left = options.card_left || { label: 'Sim / Concordo', icon: 'fa-thumbs-up' };
    const right = options.card_right || { label: 'Não / Discordo', icon: 'fa-triangle-exclamation' };

    const cards = [
      { ...left, id: 'left' },
      { ...right, id: 'right' }
    ];

    cards.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'binary-card-btn';
      btn.innerHTML = `
        <div class="binary-icon"><i class="fa-solid ${c.icon || 'fa-check'}"></i></div>
        <div class="binary-label">${c.label}</div>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.binary-card-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        setTimeout(() => {
          this.submit(c.label, 'binary_cards');
        }, 200);
      });

      wrapper.appendChild(btn);
    });

    this.container.appendChild(wrapper);
  },

  submit(answer, widgetType) {
    if (this.onSubmitCallback) {
      this.onSubmitCallback(answer, widgetType);
    }
  }
};
