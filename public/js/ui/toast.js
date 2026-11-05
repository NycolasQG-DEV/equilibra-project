/* Toast notifications */

import { esc } from '../domain/formatters.js';

let container = null;

function getToastContainer() {
  if (!container) {
    container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
  }
  return container;
}

export function showToast(message, type = 'info', duration = 1000) {
  const cont = getToastContainer();

  // Deduplicação: se já houver um toast ativo com a mesma mensagem, não duplica na tela
  const existingToast = Array.from(cont.querySelectorAll('.toast:not(.toast-leave)')).find(
    (el) => el.textContent.trim().includes(message.trim())
  );
  if (existingToast) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const icon = type === 'error'
    ? '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>'
    : type === 'success'
      ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';

  toast.innerHTML = `${icon} <span>${esc(message)}</span>`;
  cont.appendChild(toast);

  function dismiss() {
    if (toast.classList.contains('toast-leave')) return;
    toast.classList.add('toast-leave');
    toast.addEventListener('animationend', () => {
      toast.remove();
    }, { once: true });
    // Garantia de remoção caso animationend não dispare
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 450);
  }

  const timer = setTimeout(dismiss, duration);

  // Permite fechar imediatamente com a mesma animação translúcida ao clicar
  toast.style.cursor = 'pointer';
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
}
