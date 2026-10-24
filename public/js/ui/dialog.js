/* Accessible modal dialog with focus management, trap, and Escape key handling */

import { esc } from '../domain/formatters.js';

let activeTrigger = null;

export function openDialog({
  title,
  content,
  footer = null,
  size = 'md',
  onClose = null,
  triggerElement = null
}) {
  activeTrigger = triggerElement || document.activeElement;

  // Remove any open dialog
  closeDialog();

  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.id = 'active-dialog-backdrop';

  const boxClass = size === 'lg' ? 'dialog-box dialog-box-lg' : 'dialog-box';

  backdrop.innerHTML = `
    <div class="${boxClass}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" id="active-dialog-box">
      <div class="dialog-header">
        <h2 class="dialog-title" id="dialog-title">${esc(title)}</h2>
        <button type="button" class="btn btn-ghost btn-sm btn-icon" data-action="close-dialog" aria-label="Fechar diálogo">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="dialog-body">
        ${content}
      </div>
      ${footer ? `<div class="dialog-footer">${footer}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const dialogBox = backdrop.querySelector('#active-dialog-box');

  // Focusable elements inside dialog
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusables = dialogBox.querySelectorAll(focusableSelector);
  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];

  // Initial focus
  if (firstFocusable) {
    firstFocusable.focus();
  }

  // Keydown trap
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
      if (typeof onClose === 'function') onClose();
      return;
    }

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  }

  backdrop.addEventListener('keydown', handleKeyDown);

  // Close when clicking outside box
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-action="close-dialog"]')) {
      closeDialog();
      if (typeof onClose === 'function') onClose();
    }
  });

  return backdrop;
}

export function closeDialog() {
  const backdrop = document.querySelector('#active-dialog-backdrop');
  if (backdrop) {
    backdrop.remove();
    document.body.style.overflow = '';
  }

  // Return focus to triggering element
  if (activeTrigger && typeof activeTrigger.focus === 'function') {
    activeTrigger.focus();
    activeTrigger = null;
  }
}
