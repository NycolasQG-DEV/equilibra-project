/**
 * Formatadores e utilitários de exibição tipados
 */

export function esc(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function attr(str: unknown): string {
  return esc(str);
}

export function fmt(num: number | null | undefined, decimals = 1): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '—';
  return Number(num).toFixed(decimals).replace('.', ',');
}

export function fmtPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || isNaN(Number(ratio))) return '0%';
  return `${Math.round(Number(ratio) * 100)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
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

export function bandForMean(mean: number, isDirectScore = true): 'adequado' | 'cuidado' | 'atencao' | 'unclassified' {
  if (typeof mean !== 'number' || isNaN(mean)) return 'unclassified';
  if (!isDirectScore) return 'unclassified';
  if (mean >= 3.6) return 'adequado';
  if (mean >= 2.8) return 'cuidado';
  return 'atencao';
}
