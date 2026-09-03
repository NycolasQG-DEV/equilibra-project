/**
 * Matriz de Riscos e Fatores de Conformidade NR-1 (GRO / PGR)
 * Padrão 5x5: Probabilidade (1-5) x Severidade (1-5) = Risco (1-25)
 */

export interface DimensionInfo {
  id: string;
  name: string;
  description: string;
  legalFramework: string;
  icon: string;
}

export const NR1_DIMENSIONS: Record<string, DimensionInfo> = {
  demandas_psicologicas: {
    id: 'demandas_psicologicas',
    name: 'Demandas Psicológicas & Sobrecarga Cognitiva',
    description: 'Pressão por metas/prazos difíceis ou impossíveis, decisões complexas com ansiedade, interrupções frequentes e repressão de emoções',
    legalFramework: 'NR-1 item 1.5.3.2, Portaria MTE nº 1.419/2024 e ISO 45003',
    icon: 'psychology'
  },
  organizacao_gestao: {
    id: 'organizacao_gestao',
    name: 'Organização e Gestão do Trabalho',
    description: 'Horas extras imprevistas/abusivas, alterações repentinas de turno afetando família/descanso e indefinição de atribuições/orientações',
    legalFramework: 'NR-1 item 1.5.4, CLT Art. 59 e Portaria MTE nº 1.419/2024',
    icon: 'schema'
  },
  trabalho_ativo_competencias: {
    id: 'trabalho_ativo_competencias',
    name: 'Trabalho Ativo, Autonomia & Pausas',
    description: 'Falta de voz/sugestões sobre atividades, tempo insuficiente para pausas reais de descanso e bloqueio de melhorias no posto',
    legalFramework: 'NR-17 (Portaria MTP nº 423/2021) e ISO 10075',
    icon: 'pause_circle'
  },
  apoio_social_lideranca: {
    id: 'apoio_social_lideranca',
    name: 'Apoio Social & Qualidade da Liderança',
    description: 'Desrespeito (gritos, humilhações, corte de fala, menosprezo), falta de suporte da chefia, omissão em conflitos e isolamento entre colegas',
    legalFramework: 'NR-1 item 1.5.3.3, NR-5 e Convenção 155 da OIT',
    icon: 'group'
  },
  compensacao_reconhecimento: {
    id: 'compensacao_reconhecimento',
    name: 'Compensação & Reconhecimento',
    description: 'Ameaças explícitas/veladas de demissão, sugestões de transferência contra a vontade e ausência de reconhecimento pelo trabalho',
    legalFramework: 'NR-1 item 1.5.3.1, CLT Art. 468 e ISO 45003',
    icon: 'workspace_premium'
  },
  dupla_presenca_familia: {
    id: 'dupla_presenca_familia',
    name: 'Dupla Presença: Conflito Trabalho-Família',
    description: 'Exigência de tarefas em casa fora do expediente ou cancelamento impositivo de folgas para cuidados familiares ou médicos',
    legalFramework: 'CLT Art. 6º, Portaria MTE nº 1.419/2024 e ISO 45003 item 6.1.2',
    icon: 'home_work'
  },
  assedio_moral_sexual: {
    id: 'assedio_moral_sexual',
    name: 'Prevenção de Assédio Moral e Sexual',
    description: 'Ocorrência ou testemunho de assédio sexual (insinuações, toques, comentários) ou assédio moral (humilhações públicas, isolamento, ameaças)',
    legalFramework: 'Lei Federal nº 14.457/2022 (CIPA + Assédio), Art. 216-A do CP e NR-1',
    icon: 'shield'
  }
};

export interface RiskCalculation {
  probability: number;
  severity: number;
  score: number;
  level: string;
  category: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: string;
  color: string;
  complianceStatus: 'regular' | 'warning' | 'non_compliant';
}

export function calculateRisk(probability: number, severity: number): RiskCalculation {
  const p = Math.max(1, Math.min(5, Math.round(probability || 1)));
  const s = Math.max(1, Math.min(5, Math.round(severity || 1)));
  const score = p * s;

  let level = 'Trivial';
  let category: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let actionRequired = 'Monitoramento de rotina e manutenção das medidas existentes.';
  let color = '#10b981';

  if (score >= 20) {
    level = 'Crítico / Intolerável';
    category = 'critical';
    actionRequired = 'Intervenção imediata. Não iniciar ou continuar o trabalho até que o risco seja reduzido.';
    color = '#ef4444';
  } else if (score >= 12) {
    level = 'Substancial / Alto';
    category = 'high';
    actionRequired = 'Ação corretiva prioritária com prazo definido. Implementar controles de engenharia.';
    color = '#f97316';
  } else if (score >= 6) {
    level = 'Moderado';
    category = 'medium';
    actionRequired = 'Esforços necessários para reduzir o risco. Ações preventivas no plano do PGR.';
    color = '#eab308';
  } else if (score >= 3) {
    level = 'Tolerável / Baixo';
    category = 'low';
    actionRequired = 'Verificar se as medidas de controle atuais continuam eficazes.';
    color = '#3b82f6';
  }

  return {
    probability: p,
    severity: s,
    score,
    level,
    category,
    actionRequired,
    color,
    complianceStatus: score >= 12 ? 'non_compliant' : score >= 6 ? 'warning' : 'regular'
  };
}

export function calculateConfidenceScore(history: any[] = []): number {
  if (!history || history.length === 0) return 60;
  const count = history.length;
  const textAnswers = history.filter(h => h.widgetType === 'text_input' && h.userAnswer && h.userAnswer.length > 10).length;
  let score = 70 + (count * 2.5) + (textAnswers * 3);
  return Math.min(98, Math.max(70, Math.round(score)));
}
