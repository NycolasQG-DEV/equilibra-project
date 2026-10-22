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

export function showToast(message, type = 'info', duration = 4500) {
  const cont = getToastContainer();
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

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 250ms ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
