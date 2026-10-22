/* Accessible empty state component */

import { esc } from '../domain/formatters.js';

export function emptyState({
  title,
  description = '',
  icon = 'inbox',
  actionHtml = ''
}) {
  return `
    <section class="empty-state" role="status">
      <div class="empty-icon">
        <i class="fa-solid fa-${attr(icon)}" aria-hidden="true"></i>
      </div>
      <h2 class="empty-title">${esc(title)}</h2>
      ${description ? `<p class="empty-text">${esc(description)}</p>` : ''}
      ${actionHtml ? `<div class="empty-actions mt-4">${actionHtml}</div>` : ''}
    </section>
  `;
}
