/**
 * Formatadores e utilitários de exibição tipados
 */

import { bandLabels, actionStatusLabels, surveyStatusLabels } from './labels.ts';

export function esc(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attr(str: unknown): string {
  return esc(str);
}

export function fmt(num: number | null | undefined, decimals = 1): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(num));
}

export function fmtPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || isNaN(Number(ratio))) return '0%';
  return `${Math.round(Number(ratio) * 100)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '—';
  }
}

export interface ParticipationBand {
  band: 'adequada' | 'media' | 'baixa';
  label: string;
  class: string;
}

export function getBand(rate: number | null | undefined): ParticipationBand {
  if (rate === null || rate === undefined || isNaN(Number(rate))) {
    return { band: 'baixa', label: 'Baixa adesão (< 50%)', class: 'badge-danger' };
  }
  const r = Number(rate);
  if (r >= 0.70) return { band: 'adequada', label: 'Adesão adequada (≥ 70%)', class: 'badge-success' };
  if (r >= 0.50) return { band: 'media', label: 'Adesão intermediária (50%–69%)', class: 'badge-warning' };
  return { band: 'baixa', label: 'Baixa adesão (< 50%)', class: 'badge-danger' };
}

export function bandForMean(mean: number | null | undefined, isDirectScore = true): 'adequado' | 'cuidado' | 'atencao' | 'unclassified' {
  if (!isDirectScore || mean === null || mean === undefined || typeof mean !== 'number' || isNaN(mean)) {
    return 'unclassified';
  }
  if (mean >= 3.6) return 'adequado';
  if (mean >= 2.8) return 'cuidado';
  return 'atencao';
}

export function factorBadge(mean: number | null | undefined, isClassifiable = true): string {
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

export function actionStatusBadge(status: string): string {
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

export function surveyStatusBadge(status: string): string {
  const label = surveyStatusLabels[status] || status;
  const toneClass = status === 'open'
    ? 'badge-success'
    : status === 'closed'
    ? 'badge-neutral'
    : 'badge-warning';

  return `<span class="badge ${toneClass}">${esc(label)}</span>`;
}
