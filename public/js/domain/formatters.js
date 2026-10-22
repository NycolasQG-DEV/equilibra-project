/* Central formatting utilities */

import { bandLabels, actionStatusLabels, surveyStatusLabels } from './labels.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

export function attr(value) {
  return esc(value);
}

export function fmt(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function fmtPercent(rate) {
  if (rate === null || rate === undefined || isNaN(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

export function date(value) {
  if (!value) return '—';
  const d = new Date(value?.length === 10 ? `${value}T12:00:00` : value);
  return isNaN(d) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(d);
}

export function dateText(value) {
  return date(value);
}

export function timeText(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? '—' : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(d);
}

export function getBand(rate) {
  if (rate === null || rate === undefined) return { band: 'baixa', label: 'Baixa adesão (< 50%)', class: 'badge-danger' };
  if (rate >= 0.70) return { band: 'adequada', label: 'Adesão adequada (≥ 70%)', class: 'badge-success' };
  if (rate >= 0.50) return { band: 'media', label: 'Adesão intermediária (50%–69%)', class: 'badge-warning' };
  return { band: 'baixa', label: 'Baixa adesão (< 50%)', class: 'badge-danger' };
}

export function bandForMean(mean, isClassifiable = true) {
  if (!isClassifiable || mean === null || mean === undefined) {
    return 'unclassified';
  }
  if (mean >= 3.6) return 'adequado';
  if (mean >= 2.8) return 'cuidado';
  return 'atencao';
}

export function factorBadge(mean, isClassifiable = true) {
  const band = bandForMean(mean, isClassifiable);
  const label = bandLabels[band] || 'Não classificado';
  const icon = band === 'adequado'
    ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>'
    : band === 'cuidado'
    ? '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>'
    : band === 'atencao'
    ? '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>'
    : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';

  return `<span class="band-badge band-${band}">${icon} <span>${esc(label)}</span></span>`;
}

export function actionStatusBadge(status) {
  const label = actionStatusLabels[status] || status;
  const toneClass = ['effective'].includes(status)
    ? 'badge-success'
    : ['in_progress', 'implemented'].includes(status)
    ? 'badge-info'
    : ['planned'].includes(status)
    ? 'badge-warning'
    : ['ineffective', 'cancelled'].includes(status)
    ? 'badge-danger'
    : 'badge-neutral';

  return `<span class="badge ${toneClass}">${esc(label)}</span>`;
}

export function surveyStatusBadge(status) {
  const label = surveyStatusLabels[status] || status;
  const toneClass = status === 'open'
    ? 'badge-success'
    : status === 'closed'
    ? 'badge-neutral'
    : 'badge-warning';

  return `<span class="badge ${toneClass}">${esc(label)}</span>`;
}
