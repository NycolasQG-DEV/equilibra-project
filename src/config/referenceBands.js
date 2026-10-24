// Faixas de referência operacional da plataforma.
// IMPORTANTE: Conforme diretrizes metodológicas da plataforma, estes pontos de corte
// NÃO constituem normas clínicas nem pontos de corte validados para o Brasil.
// São referências operacionais internas para orientar investigações ergonômicas e de SST.

const REFERENCE_BANDS_CONFIG = {
  version: 1,
  disclaimer: 'referência operacional da plataforma, não ponto de corte validado',
  toleranceDelta: 0.10, // Tolerância para direção de tendência (+-0.10)
  bands: {
    adequado: {
      code: 'adequado',
      label: 'Adequado',
      icon: '✓',
      min: 3.6,
      max: 5.0,
      description: 'Média de percepção favorável na escala operacional.'
    },
    cuidado: {
      code: 'cuidado',
      label: 'Cuidado',
      icon: '⚠️',
      min: 2.8,
      max: 3.6,
      description: 'Média intermediária; sugere atenção preventiva.'
    },
    atencao: {
      code: 'atencao',
      label: 'Atenção',
      icon: '❗',
      min: 1.0,
      max: 2.8,
      description: 'Média desfavorável; prioritária para investigação e ações de melhoria.'
    }
  }
};

/**
 * Classifica um valor médio em relação às faixas de referência.
 * @param {number|null} average Média calculada (escala 1 a 5)
 * @param {string} [direction='higher_is_better'] Direção metodológica do fator
 * @returns {object|null} Classificação com nível, rótulo, ícone e aviso
 */
function classifyFactor(average, direction = 'higher_is_better') {
  if (average === null || average === undefined || Number.isNaN(average)) return null;

  // Se a direção for ambígua ou não declarada, não classificar (exibir sem faixa)
  if (!direction || direction === 'ambiguous' || direction === 'none') {
    return {
      level: 'unclassified',
      label: 'Sem faixa de referência para este fator',
      icon: '—',
      disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
    };
  }

  if (direction === 'higher_is_better') {
    if (average >= REFERENCE_BANDS_CONFIG.bands.adequado.min) {
      return {
        level: 'adequado',
        label: REFERENCE_BANDS_CONFIG.bands.adequado.label,
        icon: REFERENCE_BANDS_CONFIG.bands.adequado.icon,
        disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
      };
    }
    if (average >= REFERENCE_BANDS_CONFIG.bands.cuidado.min) {
      return {
        level: 'cuidado',
        label: REFERENCE_BANDS_CONFIG.bands.cuidado.label,
        icon: REFERENCE_BANDS_CONFIG.bands.cuidado.icon,
        disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
      };
    }
    return {
      level: 'atencao',
      label: REFERENCE_BANDS_CONFIG.bands.atencao.label,
      icon: REFERENCE_BANDS_CONFIG.bands.atencao.icon,
      disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
    };
  }

  // Caso houvesse algum fator com menor = melhor
  if (direction === 'lower_is_better') {
    if (average <= 2.4) {
      return {
        level: 'adequado',
        label: REFERENCE_BANDS_CONFIG.bands.adequado.label,
        icon: REFERENCE_BANDS_CONFIG.bands.adequado.icon,
        disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
      };
    }
    if (average <= 3.2) {
      return {
        level: 'cuidado',
        label: REFERENCE_BANDS_CONFIG.bands.cuidado.label,
        icon: REFERENCE_BANDS_CONFIG.bands.cuidado.icon,
        disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
      };
    }
    return {
      level: 'atencao',
      label: REFERENCE_BANDS_CONFIG.bands.atencao.label,
      icon: REFERENCE_BANDS_CONFIG.bands.atencao.icon,
      disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
    };
  }

  return {
    level: 'unclassified',
    label: 'Sem faixa de referência para este fator',
    icon: '—',
    disclaimer: REFERENCE_BANDS_CONFIG.disclaimer
  };
}

/**
 * Avalia a direção de tendência entre dois valores com tolerância de 0.10.
 * @param {number} delta Diferença (atual - anterior)
 * @param {string} [direction='higher_is_better'] Direção do fator
 * @returns {'melhorou'|'piorou'|'estavel'}
 */
function evaluateTrend(delta, direction = 'higher_is_better') {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return 'estavel';
  const tol = REFERENCE_BANDS_CONFIG.toleranceDelta;

  if (Math.abs(delta) <= tol) return 'estavel';

  if (direction === 'higher_is_better') {
    return delta > tol ? 'melhorou' : 'piorou';
  }
  if (direction === 'lower_is_better') {
    return delta < -tol ? 'melhorou' : 'piorou';
  }
  return 'estavel';
}

module.exports = {
  REFERENCE_BANDS_CONFIG,
  classifyFactor,
  evaluateTrend
};
