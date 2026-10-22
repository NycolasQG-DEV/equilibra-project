/* Confidential Survey Respondent Interface */

import { esc, attr } from '../../domain/formatters.js';
import { get, post } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';

export async function renderRespondent({ params }) {
  const token = params.token;
  const container = document.querySelector('#app');

  container.innerHTML = `
    <div class="center-page-wrap">
      <div class="card p-8 text-center max-w-md">
        <i class="fa-solid fa-spinner fa-spin color-primary mb-4 auth-logo" aria-hidden="true"></i>
        <h1 class="card-title">Carregando questionário confidencial...</h1>
      </div>
    </div>
  `;

  try {
    const surveyData = await get(`/responder/${token}`);
    const questions = surveyData.instrument?.questions || [];
    const surveyTitle = surveyData.survey?.title || 'Pesquisa de Fatores Psicossociais';

    const draftKey = `equilibra_draft_${token}`;
    let savedAnswers = {};
    try {
      savedAnswers = JSON.parse(localStorage.getItem(draftKey) || '{}');
    } catch {}

    const questionsHtml = questions.map((q, idx) => {
      const qNum = idx + 1;
      const currentVal = savedAnswers[q.id] || null;

      return `
        <fieldset class="card respondent-question-card mb-4">
          <legend class="respondent-question-legend">
            ${qNum}. ${esc(q.text)}
          </legend>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            ${[1, 2, 3, 4, 5].map(val => {
              const labels = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'];
              const isChecked = String(currentVal) === String(val);

              return `
                <label class="form-check likert-option">
                  <input type="radio" name="q_${attr(q.id)}" value="${val}" ${isChecked ? 'checked' : ''} class="mb-1">
                  <span class="likert-num">${val}</span>
                  <span class="likert-label">${labels[val - 1]}</span>
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
          <header class="mb-6 text-center">
            <div class="auth-logo">
              <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
            </div>
            <h1 class="view-title mb-2">${esc(surveyTitle)}</h1>
            <p class="view-subtitle">
              Sua resposta é 100% confidencial. O sistema não armazena nenhuma ligação entre a sua identidade e as opções marcadas. Os dados são analisados de forma estritamente agregada (N ≥ 5).
            </p>
          </header>

          <form id="respondent-form">
            ${questionsHtml}

            <div class="card mt-6 p-5 text-center bg-surface">
              <button type="submit" class="btn btn-primary btn-lg w-full max-w-md">
                Enviar Respostas Confidenciais
              </button>
              <p class="table-subtext mt-2">
                Após o envio, este link será permanentemente desativado.
              </p>
            </div>
          </form>
        </div>
      </div>
    `;

    // Clean up that one remaining inline font-size on line 13
    const spinner = container.querySelector('.fa-spinner');
    if (spinner) spinner.style.fontSize = '';

    const form = document.getElementById('respondent-form');

    // Auto-save on change
    form.addEventListener('change', (e) => {
      if (e.target.name && e.target.value) {
        const qId = e.target.name.replace(/^q_/, '');
        savedAnswers[qId] = Number(e.target.value);
        try {
          localStorage.setItem(draftKey, JSON.stringify(savedAnswers));
        } catch {}
      }
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // Validate all answered
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
        } catch {}

        container.innerHTML = `
          <div class="center-page-wrap">
            <div class="card p-8 text-center max-w-md">
              <div class="status-icon-circle status-icon-circle-lg status-icon-circle-success">
                <i class="fa-solid fa-check" aria-hidden="true"></i>
              </div>
              <h1 class="view-title mb-2">Resposta Registrada com Sucesso</h1>
              <p class="view-subtitle mb-4">
                Obrigado pela sua participação! Suas contribuições foram agregadas aos indicadores coletivos da empresa para subsidiar melhorias contínuas nas condições de trabalho.
              </p>
              <span class="badge badge-success">Sua privacidade foi preservada</span>
            </div>
          </div>
        `;
      } catch (err) {
        showToast(err.message || 'Erro ao enviar respostas.', 'error');
        if (submitBtn) submitBtn.disabled = false;
      }
    });

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
