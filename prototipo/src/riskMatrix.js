/**
 * Matriz de Riscos e Fatores de Conformidade NR-1 (GRO / PGR)
 * Padrão 5x5: Probabilidade (1-5) x Severidade (1-5) = Risco (1-25)
 */

export const NR1_DIMENSIONS = {
  demandas_psicologicas: {
    id: 'demandas_psicologicas',
    name: 'Demandas Psicológicas & Sobrecarga Cognitiva',
    description: 'Pressão por metas/prazos difíceis ou impossíveis, decisões complexas com ansiedade, interrupções frequentes e repressão de emoções',
    legalFramework: 'NR-1 item 1.5.3.2, Portaria MTE nº 1.419/2024 e ISO 45003',
    icon: 'fa-brain'
  },
  organizacao_gestao: {
    id: 'organizacao_gestao',
    name: 'Organização e Gestão do Trabalho',
    description: 'Horas extras imprevistas/abusivas, alterações repentinas de turno afetando família/descanso e indefinição de atribuições/orientações',
    legalFramework: 'NR-1 item 1.5.4, CLT Art. 59 e Portaria MTE nº 1.419/2024',
    icon: 'fa-sitemap'
  },
  trabalho_ativo_competencias: {
    id: 'trabalho_ativo_competencias',
    name: 'Trabalho Ativo, Autonomia & Pausas',
    description: 'Falta de voz/sugestões sobre atividades, tempo insuficiente para pausas reais de descanso e bloqueio de melhorias no posto',
    legalFramework: 'NR-17 (Portaria MTP nº 423/2021) e ISO 10075',
    icon: 'fa-hand-paper'
  },
  apoio_social_lideranca: {
    id: 'apoio_social_lideranca',
    name: 'Apoio Social & Qualidade da Liderança',
    description: 'Desrespeito (gritos, humilhações, corte de fala, menosprezo), falta de suporte da chefia, omissão em conflitos e isolamento entre colegas',
    legalFramework: 'NR-1 item 1.5.3.3, NR-5 e Convenção 155 da OIT',
    icon: 'fa-comments'
  },
  compensacao_reconhecimento: {
    id: 'compensacao_reconhecimento',
    name: 'Compensação & Reconhecimento',
    description: 'Ameaças explícitas/veladas de demissão, sugestões de transferência contra a vontade e ausência de reconhecimento pelo trabalho',
    legalFramework: 'NR-1 item 1.5.3.1, CLT Art. 468 e ISO 45003',
    icon: 'fa-award'
  },
  dupla_presenca_familia: {
    id: 'dupla_presenca_familia',
    name: 'Dupla Presença: Conflito Trabalho-Família',
    description: 'Exigência de tarefas em casa fora do expediente ou cancelamento impositivo de folgas para cuidados familiares ou médicos',
    legalFramework: 'CLT Art. 6º, Portaria MTE nº 1.419/2024 e ISO 45003 item 6.1.2',
    icon: 'fa-house-laptop'
  },
  assedio_moral_sexual: {
    id: 'assedio_moral_sexual',
    name: 'Prevenção de Assédio Moral e Sexual',
    description: 'Ocorrência ou testemunho de assédio sexual (insinuações, toques, comentários) ou assédio moral (humilhações públicas, isolamento, ameaças)',
    legalFramework: 'Lei Federal nº 14.457/2022 (CIPA + Assédio), Art. 216-A do CP e NR-1',
    icon: 'fa-shield-halved'
  }
};

/**
 * Ordem de Prioridade Normativa para Medidas de Prevenção (NR-01 Item 1.4.1, alínea 'g')
 */
export const NR1_PREVENTION_HIERARCHY = {
  1: { level: 1, label: '1º Eliminação do Fator de Risco', legalBase: 'NR-01 Item 1.4.1 "g" I', tag: 'ELIMINAÇÃO' },
  2: { level: 2, label: '2º Medida de Proteção Coletiva', legalBase: 'NR-01 Item 1.4.1 "g" II', tag: 'PROTEÇÃO COLETIVA' },
  3: { level: 3, label: '3º Organização do Trabalho & Administrativo (NR-17)', legalBase: 'NR-01 Item 1.4.1 "g" III', tag: 'ORGANIZAÇÃO DO TRABALHO' },
  4: { level: 4, label: '4º Proteção Individual (EPI)', legalBase: 'NR-01 Item 1.4.1 "g" IV', tag: 'PROTEÇÃO INDIVIDUAL' }
};

/**
 * Calcula o nível de risco e classificação de acordo com a matriz NR-1
 * @param {number} probability 1 a 5
 * @param {number} severity 1 a 5
 */
export function calculateRisk(probability, severity) {
  const p = Math.max(1, Math.min(5, Math.round(probability || 1)));
  const s = Math.max(1, Math.min(5, Math.round(severity || 1)));
  const score = p * s;

  let level = 'Trivial';
  let category = 'low';
  let actionRequired = 'Monitoramento de rotina e manutenção das medidas existentes.';
  let color = '#10b981'; // verde

  if (score >= 20) {
    level = 'Crítico / Intolerável';
    category = 'critical';
    actionRequired = 'Intervenção imediata. Não iniciar ou continuar o trabalho até que o risco seja reduzido.';
    color = '#ef4444'; // vermelho intenso
  } else if (score >= 12) {
    level = 'Substancial / Alto';
    category = 'high';
    actionRequired = 'Ação corretiva prioritária com prazo definido. Implementar controles de engenharia.';
    color = '#f97316'; // laranja
  } else if (score >= 6) {
    level = 'Moderado';
    category = 'medium';
    actionRequired = 'Esforços necessários para reduzir o risco. Ações preventivas no plano do PGR.';
    color = '#eab308'; // amarelo
  } else if (score >= 3) {
    level = 'Tolerável / Baixo';
    category = 'low';
    actionRequired = 'Controle periódico. Nenhuma ação adicional urgente necessária.';
    color = '#06b6d4'; // ciano
  }

  return {
    probability: p,
    severity: s,
    score,
    level,
    category,
    actionRequired,
    color
  };
}

export function calculateConfidenceScore(history) {
  if (!history || history.length === 0) return 50;

  let totalPoints = 100;
  let deductions = 0;
  let evasiveOpenAnswersCount = 0;

  history.forEach(item => {
    const text = String(item.userAnswer || '').trim().toLowerCase();
    const widget = item.widgetType || 'text_input';

    // Apenas penaliza respostas abertas (text_input) que foram vazias ou evasivas ("sei lá", "nada", ".")
    if (widget === 'text_input') {
      if (['sei lá', 'sei la', 'nada', 'sei nao', 'tanto faz', '.'].includes(text) || text.length < 3) {
        evasiveOpenAnswersCount++;
      }
    }
  });

  // Se o colaborador foi evasivo em várias perguntas abertas dissertativas
  if (evasiveOpenAnswersCount >= 2) {
    deductions += 15;
  }

  // Bônus se tiver variedade de dimensões cobertas com respostas válidas
  const uniqueDimensions = new Set(history.map(h => h.dimensionTarget).filter(Boolean));
  if (uniqueDimensions.size >= 4) {
    totalPoints += 5;
  }

  const finalScore = Math.max(40, Math.min(98, totalPoints - deductions));
  return finalScore;
}
